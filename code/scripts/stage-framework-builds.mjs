import { cp, mkdir, rm, stat } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const targetRoot = fileURLToPath(new URL("../public/frameworks/", import.meta.url));
const frameworks = ["react", "vue", "angular"];

await rm(targetRoot, { recursive: true, force: true });
await mkdir(targetRoot, { recursive: true });

for (const framework of frameworks) {
  const source = `${root}/apps/${framework}/dist`;
  const target = `${targetRoot}/${framework}`;
  const info = await stat(`${source}/index.html`).catch(() => undefined);
  if (!info?.isFile()) throw new Error(`${framework} build is missing index.html`);
  await cp(source, target, { recursive: true });
}

console.log(`Staged ${frameworks.length} framework applications for the learning portal.`);
