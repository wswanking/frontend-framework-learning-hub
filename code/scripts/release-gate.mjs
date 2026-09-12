import { readFile } from "node:fs/promises";

const [mode, recordPath] = process.argv.slice(2);
if (!mode || !recordPath || !["preview", "production"].includes(mode)) {
  console.error("Usage: node scripts/release-gate.mjs <preview|production> <record.json>");
  process.exit(2);
}

const record = JSON.parse(await readFile(recordPath, "utf8"));
const failures = [];
for (const field of ["version", "environment", "commit", "summary", "owner", "acceptanceLink"]) {
  if (!String(record[field] ?? "").trim()) failures.push(`missing ${field}`);
}
for (const field of ["requirements", "tasks", "changes", "testEvidence", "knownRisks", "rollbackSteps"]) {
  if (!Array.isArray(record[field]) || record[field].length === 0) failures.push(`missing ${field}`);
}
if (record.environment !== mode) failures.push(`environment must be ${mode}`);
if (record.buildPassed !== true) failures.push("build evidence is not passing");
if (record.testsPassed !== true) failures.push("test evidence is not passing");
if (!record.rollbackVersion || !record.rollbackSteps?.length) failures.push("rollback target or steps are missing");
if (mode === "production") {
  const automatedAcceptance = record.acceptanceMode === "automated"
    && record.automatedAcceptancePassed === true
    && String(record.authorizationSource ?? "").trim().length > 0;
  if (!record.previousVerifiedVersion) failures.push("previous verified version is missing");
  if (!["通过", "豁免"].includes(record.humanReviewConclusion) && !automatedAcceptance) failures.push("neither human review nor user-authorized automated acceptance is passing");
  if (record.releaseOwnerApproval !== true && !automatedAcceptance) failures.push("release owner has not approved");
  if (Number(record.openHighSeverityIssues) !== 0) failures.push("high severity issues remain unresolved or unwaived");
}

if (failures.length) {
  console.error(`Release gate rejected (${mode}):\n- ${failures.join("\n- ")}`);
  process.exit(1);
}
console.log(`Release gate accepted: ${record.version} -> ${mode}`);
