import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { resolve, dirname, relative, isAbsolute, extname, sep } from 'node:path';
const root = process.cwd(); const problems = [];
const manifest = JSON.parse(readFileSync('package.json', 'utf8'));
const declared = new Set(Object.keys({ ...manifest.dependencies, ...manifest.devDependencies }));
for (const [name, version] of Object.entries({ ...manifest.dependencies, ...manifest.devDependencies })) {
  if (/^(file:|link:|workspace:)/.test(version)) problems.push(`External local dependency: ${name}`);
  if (!existsSync(resolve('node_modules', name, 'package.json'))) problems.push(`Not installed locally: ${name}`);
}
const inside = target => { const rel = relative(root, target); return !isAbsolute(rel) && rel !== '..' && !rel.startsWith('..' + sep); };
function walk(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (['node_modules','dist','reports','.angular','coverage','.git'].includes(entry.name)) continue;
    if (entry.name === 'guards.test.mjs') continue;
    const file = resolve(dir, entry.name);
    if (entry.isSymbolicLink()) { problems.push(`Symlink forbidden: ${file}`); continue; }
    if (entry.isDirectory()) { walk(file); continue; }
    if (!['.ts','.tsx','.vue','.mjs','.css','.html'].includes(extname(file))) continue;
    const text = readFileSync(file, 'utf8');
    for (const match of text.matchAll(/(?:from\s*|import\s*\(|import\s*)['"]([^'"]+)['"]/g)) {
      const spec = match[1];
      if (spec.startsWith('.')) { if (!inside(resolve(dirname(file), spec))) problems.push(`Outside import: ${file}: ${spec}`); }
      else if (!spec.startsWith('node:')) {
        const name = spec.startsWith('@') ? spec.split('/').slice(0,2).join('/') : spec.split('/')[0];
        if (!declared.has(name)) problems.push(`Undeclared dependency: ${file}: ${spec}`);
      }
    }
    for (const match of text.matchAll(/(?:src|href)=["']([^"']+)["']|url\(["']?([^)'"\s]+)/g)) {
      const spec = match[1] || match[2];
      if (/^(https?:|\/\/)/.test(spec)) problems.push(`Remote resource: ${file}: ${spec}`);
      if (spec.startsWith('.') && !inside(resolve(dirname(file), spec))) problems.push(`Outside resource: ${file}: ${spec}`);
    }
  }
}
walk(root);
if (problems.length) { console.error(problems.join('\n')); process.exit(1); }
console.log('Isolation check passed.');
