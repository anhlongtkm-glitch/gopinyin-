'use strict';
// Isolated, read-only approval preview. Never serves application configuration or APIs.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../..');
const mime = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.webp': 'image/webp', '.png': 'image/png' };
const server = http.createServer((req, res) => {
  if (!['GET','HEAD'].includes(req.method)) { res.writeHead(405); return res.end(); }
  let pathname;
  try { pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname); } catch { res.writeHead(400); return res.end(); }
  let file;
  if (pathname === '/') file = path.join(__dirname, 'index.html');
  else if (/^\/(?:index\.html|review\.html|styles\.css|interactions\.js|[a-z0-9-]+\.png)$/.test(pathname)) file = path.join(__dirname, pathname.slice(1));
  else if (/^\/assets\/(?:logo-full\.png|mascot\/[a-z-]+\.webp)$/.test(pathname)) file = path.join(root, pathname.slice(1));
  if (!file) { res.writeHead(404); return res.end('Not found'); }
  fs.readFile(file, (error, data) => { if (error) { res.writeHead(404); return res.end('Not found'); } res.writeHead(200, { 'Content-Type': mime[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' }); res.end(req.method === 'HEAD' ? undefined : data); });
});
server.listen(8093, '127.0.0.1', () => console.log('Approval preview: http://localhost:8093/ — isolated from the live application.'));
