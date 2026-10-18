import { createServer } from 'node:http';
import { readFile, realpath, stat } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { sha256 } from './artifacts.mjs';
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.map': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.ico': 'image/x-icon', '.woff': 'font/woff', '.woff2': 'font/woff2', '.txt': 'text/plain; charset=utf-8' };
export async function createSite(directory, base = '/') {
  if (!/^\/(?:[a-zA-Z0-9_-]+\/)*$/.test(base)) throw new Error('Base must be a slash-delimited URL prefix');
  const root = await realpath(directory);
  const safeFile = async path => {
    const real = await realpath(path);
    if (!real.startsWith(root + sep) || !(await stat(real)).isFile()) throw Object.assign(new Error('Outside static root'), { code: 'DENIED' });
    return real;
  };
  await safeFile(resolve(root, 'index.html'));
  return createServer(async (req, res) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'no-store');
    if (!['GET', 'HEAD'].includes(req.method)) { res.writeHead(405, { Allow: 'GET, HEAD' }).end(); return; }
    try {
      const path = decodeURIComponent((req.url ?? '/').split('?')[0]);
      if (path.includes('\\') || path.includes('\0') || path.split('/').includes('..')) { res.writeHead(403).end('Forbidden'); return; }
      if (!path.startsWith(base)) { res.writeHead(404).end('Not found'); return; }
      const local = path.slice(base.length);
      let file, html = false;
      try { file = await safeFile(resolve(root, local || 'index.html')); }
      catch (error) {
        if (error.code === 'DENIED') throw error;
        const documentRequest = (req.headers.accept ?? '').includes('text/html');
        const staticNamespace = /^(assets|source|lab-candidate-styles|fonts|images)(\/|$)/.test(local);
        if (!documentRequest || staticNamespace || extname(local)) { res.writeHead(404).end('Not found'); return; }
        file = await safeFile(resolve(root, 'index.html')); html = true;
      }
      const bytes = await readFile(file); const extension = extname(file); html ||= extension === '.html';
      const immutable = !html && /-[A-Za-z0-9_-]{8}\.(js|css|woff2?)$/.test(file);
      const etag = `"${sha256(bytes)}"`;
      res.setHeader('Content-Type', mime[extension] ?? 'application/octet-stream');
      res.setHeader('Cache-Control', immutable ? 'public, max-age=31536000, immutable' : 'no-cache');
      res.setHeader('ETag', etag);
      if (req.headers['if-none-match'] === etag) { res.writeHead(304).end(); return; }
      res.setHeader('Content-Length', bytes.length); res.writeHead(200).end(req.method === 'HEAD' ? undefined : bytes);
    } catch (error) { res.writeHead(error.code === 'DENIED' ? 403 : 404).end('Not found'); }
  });
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [root, portText = '15101', base = '/'] = process.argv.slice(2); const port = Number(portText);
  if (!root || !Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('Usage: static-site.mjs <site-root> [port>=1024] [/prefix/]');
  const server = await createSite(resolve(root), base);
  server.listen(port, '127.0.0.1', () => console.log(`Local static site: http://127.0.0.1:${port}${base}`));
}
