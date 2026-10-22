import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, relative, resolve } from 'node:path';
import rsvpHandler from '../api/rsvp.js';
import retryHandler from '../api/admin/retry-sheets.js';
import { closeDatabase } from '../api/_lib/database.js';
import eventConfig from '../api/_lib/event-config.js';

const root = resolve('dist');
const port = Number(process.env.PORT || 4173);
const types = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ttf': 'font/ttf',
  '.txt': 'text/plain; charset=utf-8',
  '.webp': 'image/webp',
};

const server = createServer(async (req, res) => {
  try {
    const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    if (pathname === '/healthz' && req.method === 'GET') {
      return sendJson(res, 200, { ok: true });
    }
    if (pathname === '/api/rsvp' || pathname === '/api/admin/retry-sheets') {
      if (pathname === '/api/rsvp' && req.method === 'POST') {
        const body = await readBody(req, 32 * 1024);
        if (body === null) return sendJson(res, 413, { error: 'body_too_large' });
        req.body = body;
      }
      const adapter = {
        setHeader: (...args) => res.setHeader(...args),
        status(code) { res.statusCode = code; return this; },
        json(value) { return sendJson(res, res.statusCode || 200, value); },
      };
      return await (pathname === '/api/rsvp' ? rsvpHandler(req, adapter) : retryHandler(req, adapter));
    }
    if (pathname === '/content/event.json' && req.method === 'GET') {
      res.setHeader('Cache-Control', 'no-store');
      return sendJson(res, 200, eventConfig);
    }
    return await serveStatic(req, res, pathname);
  } catch (error) {
    if (!res.headersSent) sendJson(res, 500, { error: 'internal_error' });
    console.error('HTTP request failed:', error?.message || 'unknown_error');
  }
});

server.listen(port, '0.0.0.0', () => console.log(`RSVP server listening on port ${port}`));
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.once(signal, () => server.close(() => { closeDatabase(); process.exit(0); }));
}

async function readBody(req, maxBytes) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > maxBytes) return null;
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString('utf8');
}

async function serveStatic(req, res, pathname) {
  if (req.method !== 'GET' && req.method !== 'HEAD') return sendJson(res, 405, { error: 'method_not_allowed' });
  const requested = pathname === '/' ? 'index.html' : pathname.slice(1);
  const file = resolve(root, requested);
  const pathFromRoot = relative(root, file);
  if (pathFromRoot.startsWith('..') || pathFromRoot.includes(':')) return sendJson(res, 404, { error: 'not_found' });
  try {
    const content = await readFile(file);
    res.writeHead(200, {
      'Content-Type': types[extname(file)] || 'application/octet-stream',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      'X-Robots-Tag': 'noindex, nofollow, noarchive, nosnippet',
    });
    res.end(req.method === 'HEAD' ? undefined : content);
  } catch {
    return sendJson(res, 404, { error: 'not_found' });
  }
}

function sendJson(res, status, value) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
  });
  res.end(JSON.stringify(value));
}
