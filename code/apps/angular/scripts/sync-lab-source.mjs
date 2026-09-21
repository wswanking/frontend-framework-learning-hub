import { copyFile, mkdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const manifest = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'));
const files = manifest.name.endsWith('/react') ? ['Labs.tsx', 'LabCharts.tsx', 'lab-chart.ts']
  : manifest.name.endsWith('/vue') ? ['Labs.vue', 'LabCharts.vue', 'lab-chart.ts']
    : ['labs.component.ts', 'labs.component.html', 'lab-bootstrap-candidate.component.ts', 'lab-bootstrap-candidate.component.html', 'lab-zorro-candidate.component.ts', 'lab-zorro-candidate.component.html', 'lab-charts.component.ts', 'lab-chart.ts'];
const target = join(root, 'public', 'source');
await mkdir(target, { recursive: true });
for (const file of files) await copyFile(join(root, 'src', file), join(target, file));
await copyFile(join(root, 'docs', 'lab-prd.md'), join(target, 'lab-prd.md'));
for (const name of ['lab-metrics.json', 'lab-metrics.html']) await copyFile(join(root, 'docs', name), join(target, name));
