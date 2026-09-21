import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
const root = resolve('dist/diagnostics/browser');
const types = { '.html':'text/html; charset=utf-8','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png' };
createServer(async (req,res) => {
  try {
    const pathname = decodeURIComponent(new URL(req.url,'http://localhost').pathname);
    const file = resolve(root,'.'+(pathname==='/'?'/index.html':pathname));
    if (!file.startsWith(root+sep)) { res.writeHead(403).end(); return; }
    let data;
    let mime = types[extname(file)] ?? 'application/octet-stream';
    try { data = await readFile(file); }
    catch {
      if (extname(file)) { res.writeHead(404).end('Not found'); return; }
      data = await readFile(resolve(root, 'index.html'));
      mime = types['.html'];
    }
    res.writeHead(200,{'content-type':mime,'cache-control':'no-store'}).end(data);
  } catch { res.writeHead(404).end('Not found'); }
}).listen(14103,'127.0.0.1');
