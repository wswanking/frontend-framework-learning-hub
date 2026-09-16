import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
const mode = process.argv[2];
if (!['capture', 'check'].includes(mode)) throw new Error('Use capture or check');
if (mode === 'check') {
  const review = JSON.parse(readFileSync('tests/visual/baseline-review.json', 'utf8')).platforms[process.platform];
  if (!review || review.status !== 'approved' || !review.reviewer?.trim() || !review.reviewedAt) {
    console.error(`VISUAL_PENDING: ${process.platform} baseline not reviewed. Capture candidates first; no visual acceptance claimed.`);
    process.exit(2);
  }
  for (const project of ['desktop', 'mobile']) for (const state of ['initial', 'invalid', 'success']) {
    const name = `${project}/${state}-${process.platform}.png`;
    const actual = createHash('sha256').update(readFileSync(`tests/visual/baselines/${name}`)).digest('hex');
    if (review.sha256?.[name] !== actual) throw new Error(`Baseline missing or changed since review: ${name}`);
  }
}
const args = ['node_modules/@playwright/test/cli.js', 'test', '--config', 'visual.config.ts'];
if (mode === 'capture') args.push('--update-snapshots=all');
const result = spawnSync(process.execPath, args, { stdio: 'inherit', env: { ...process.env, VISUAL_CANDIDATES: mode === 'capture' ? '1' : '0' } });
process.exit(result.status ?? 1);
