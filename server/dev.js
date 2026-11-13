// Minimal local server: only files in public/ are accessible.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const search = require('../api/search');
const root = path.resolve(__dirname, '../public');
const types = { '.html':'text/html; charset=utf-8', '.css':'text/css; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.ttf':'font/ttf', '.jpg':'image/jpeg', '.png':'image/png', '.svg':'image/svg+xml' };
http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname === '/api/search') {
    res.status = code => { res.statusCode = code; return res; };
    res.json = value => { res.setHeader('Content-Type', 'application/json; charset=utf-8'); res.end(JSON.stringify(value)); };
    return search(req, res);
  }
  let pathname;
  try { pathname = decodeURIComponent(url.pathname); } catch { res.writeHead(400).end(); return; }
  const file = path.resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname));
  if (!file.startsWith(root + path.sep)) { res.writeHead(404).end(); return; }
  fs.readFile(file, (err, content) => {
    if (err) { res.writeHead(404).end('Not found'); return; }
    res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream', 'X-Content-Type-Options':'nosniff' });
    res.end(content);
  });
}).listen(process.env.PORT || 3000, '0.0.0.0', () => console.log('Speexx Solve running on port ' + (process.env.PORT || 3000)));
