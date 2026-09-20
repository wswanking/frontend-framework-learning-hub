import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { resolve, dirname, relative, isAbsolute, extname, sep } from 'node:path';
import ts from 'typescript';
const root = process.cwd(); const problems = [];
const manifest = JSON.parse(readFileSync('package.json', 'utf8'));
const declared = new Set(Object.keys({ ...manifest.dependencies, ...manifest.devDependencies }));
for (const [name, version] of Object.entries({ ...manifest.dependencies, ...manifest.devDependencies })) {
  if (/^(file:|link:|workspace:)/.test(version)) problems.push(`External local dependency: ${name}`);
  if (!existsSync(resolve('node_modules', name, 'package.json'))) problems.push(`Not installed locally: ${name}`);
}
const inside = target => { const rel = relative(root, target); return !isAbsolute(rel) && rel !== '..' && !rel.startsWith('..' + sep); };
function checkImport(file, spec) {
  if (spec.startsWith('.')) { if (!inside(resolve(dirname(file), spec))) problems.push(`Outside import: ${file}: ${spec}`); }
  else if (!spec.startsWith('node:')) {
    const name = spec.startsWith('@') ? spec.split('/').slice(0, 2).join('/') : spec.split('/')[0];
    if (!declared.has(name)) problems.push(`Undeclared dependency: ${file}: ${spec}`);
  }
}
function checkScript(file, source) {
  const kind = file.endsWith('.tsx') ? ts.ScriptKind.TSX : file.endsWith('.mjs') ? ts.ScriptKind.JS : ts.ScriptKind.TS;
  const tree = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, kind);
  function visit(node) {
    if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) checkImport(file, node.moduleSpecifier.text);
    if (ts.isCallExpression(node) && node.arguments.length) {
      const dynamicImport = node.expression.kind === ts.SyntaxKind.ImportKeyword;
      const requireCall = ts.isIdentifier(node.expression) && node.expression.text === 'require';
      if (dynamicImport || requireCall) {
        if (ts.isStringLiteral(node.arguments[0])) checkImport(file, node.arguments[0].text);
        else problems.push(`Nonliteral import: ${file}`);
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(tree);
}
function walk(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (['node_modules','dist','reports','.angular','coverage','.git'].includes(entry.name)) continue;
    if (entry.name === 'guards.test.mjs') continue;
    const file = resolve(dir, entry.name);
    if (entry.isSymbolicLink()) { problems.push(`Symlink forbidden: ${file}`); continue; }
    if (entry.isDirectory()) { walk(file); continue; }
    if (!['.ts','.tsx','.vue','.mjs','.css','.html'].includes(extname(file))) continue;
    const text = readFileSync(file, 'utf8');
    if (['.ts', '.tsx', '.mjs'].includes(extname(file))) checkScript(file, text);
    if (file.endsWith('.vue')) for (const script of text.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)) checkScript(file, script[1]);
    if (file.endsWith('.css')) for (const match of text.matchAll(/@import\s+['"]([^'"]+)['"]/g)) checkImport(file, match[1]);
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
