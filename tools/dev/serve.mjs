import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../', import.meta.url));
const allowedDirs = ['demo', 'package'].map((dir) => join(root, dir) + sep);
const port = Number(process.env.PORT) || 5173;
const mimeTypes = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.json': 'application/json', '.txt': 'text/plain; charset=utf-8',
};

createServer(async (request, response) => {
  try {
    if (request.method !== 'GET' && request.method !== 'HEAD') { response.writeHead(405, { allow: 'GET, HEAD' }).end(); return; }

    if (!/^(localhost|127\.0\.0\.1)(:\d+)?$/.test(request.headers.host ?? '')) { response.writeHead(403).end('Forbidden host'); return; } // blocks dns rebinding
    const { pathname } = new URL(request.url, 'http://localhost');
    if (pathname === '/') { response.writeHead(302, { location: '/demo/' }).end(); return; }
    if (pathname === '/demo') { response.writeHead(302, { location: '/demo/' }).end(); return; }
    const file = normalize(join(root, decodeURIComponent(pathname.endsWith('/') ? `${pathname}index.html` : pathname)));
    if (!allowedDirs.some((dir) => file.startsWith(dir))) { response.writeHead(403).end(); return; } // normalize already collapsed ../ above
    const body = await readFile(file);
    response.writeHead(200, { 'content-type': mimeTypes[extname(file)] ?? 'application/octet-stream', 'x-content-type-options': 'nosniff' });
    response.end(request.method === 'HEAD' ? undefined : body);
  } catch (error) {
    const isBadUrl = error instanceof URIError;
    response.writeHead(isBadUrl ? 400 : 404).end(isBadUrl ? 'Bad request' : 'Not found');
  }
}).listen(port, '127.0.0.1', () => console.log(`http://localhost:${port}/demo/`));