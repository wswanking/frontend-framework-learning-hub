# IOT-RELEASE-001 Release Runbook

## Environments

| Environment | Purpose | Allowed data | Entry condition |
| --- | --- | --- | --- |
| local | Development and targeted checks | Fixed-seed Mock API | Relevant lint and tests pass |
| preview | Product and QA review | Fixed-seed, read-only demo data | All application builds, tests, change record |
| production | Formal demonstration | Approved, read-only demo data | Human approval of REVIEW-005 and final acceptance |

## Required evidence

1. Run `npm.cmd test` in `code/`.
2. Run `npm.cmd run build:react`, `npm.cmd run build:vue`, and `npm.cmd run build:angular`.
3. Record the requirement IDs, task IDs, issues, exact commands, result, owner, and rollback target.
4. For production, a human release owner must add a REVIEW-005 decision. AI must not mark it approved.

## Rollback

1. Stop promotion when build, smoke check, or acceptance evidence fails.
2. Re-deploy the last human-verified artifact/version; do not mutate the failed record.
3. Create or update an Issue and a change record with trigger time, impact, owner, and post-rollback verification.
4. Require a new preview validation before another production attempt.

## Current readiness

The repository has local build and test evidence only. No preview URL, production artifact, human REVIEW-005 decision, or final acceptance conclusion exists; production is therefore not eligible.
