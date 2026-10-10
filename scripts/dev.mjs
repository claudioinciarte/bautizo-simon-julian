import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, relative, extname } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const args = process.argv.slice(2);
const portFlag = args.indexOf('--port');
const port = Number(portFlag >= 0 ? args[portFlag + 1] : process.env.PORT || 4173);
const publicFiles = new Set(['index.html', 'styles.css', 'app.js', 'content/event.json']);
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8', '.png': 'image/png', '.ttf': 'font/ttf', '.txt': 'text/plain; charset=utf-8' };
const server = createServer(async (req, res) => {
  try {
    const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    const requested = pathname === '/' ? 'index.html' : pathname.slice(1);
    const fullPath = resolve(root, requested);
    const rel = relative(root, fullPath).replaceAll('\\', '/');
    if (rel.startsWith('..') || (!publicFiles.has(rel) && !rel.startsWith('assets/'))) {
      res.writeHead(404).end('Not found'); return;
    }
    const content = await readFile(fullPath);
    res.writeHead(200, { 'Content-Type': types[extname(fullPath)] || 'application/octet-stream', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
    res.end(req.method === 'HEAD' ? undefined : content);
  } catch { res.writeHead(404).end('Not found'); }
});
server.listen(port, '127.0.0.1', () => console.log(`Invitación: http://127.0.0.1:${port}/`));
