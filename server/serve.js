#!/usr/bin/env node
/* ═══════════════════════════════════════════════════════════════════════════
   GoPinyin — server tĩnh để CHẠY ĐÚNG CÁCH trong lúc phát triển / dùng thử.

   VÌ SAO CẦN FILE NÀY?
   Mở thẳng `dist/index.html` (địa chỉ `file:///...`) thì app vẫn hiển thị, nhưng
   **Chrome KHÔNG ghi nhớ quyền micro cho origin `file://`**. Hệ quả: mỗi lần
   bấm nút nói, Chrome lại hỏi "Cho phép dùng micro?" — không có cách nào sửa
   từ phía JavaScript. Chạy qua `http://localhost` thì quyền được ghi nhớ theo
   origin, nên chỉ hỏi đúng 1 lần.

   CÁCH DÙNG
     node server/serve.js                 # http://localhost:8080
     PORT=5500 node server/serve.js       # đổi cổng
     node server/serve.js --no-open       # không tự mở trình duyệt

   Không cần cài thêm gói nào (chỉ dùng http/fs/path của Node).
   ═══════════════════════════════════════════════════════════════════════════ */
'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFile } = require('child_process');

const ROOT = path.resolve(process.env.GP_PUBLIC_ROOT || path.join(__dirname, '..', 'dist'));
const PORT = Number(process.env.PORT || 8080);
const HOST = process.env.HOST || '127.0.0.1';
const NO_OPEN = process.argv.includes('--no-open') || process.env.NO_OPEN === '1';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.htm': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.ogg': 'audio/ogg',
  '.mp4': 'video/mp4',
  '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8'
};

/* Chặn thoát ra ngoài thư mục dự án (../..) */
function safeJoin(root, urlPath) {
  let clean;
  try {
    clean = decodeURIComponent(urlPath.split('?')[0].split('#')[0]);
  } catch (e) {
    /* URL percent-encoding hỏng (vd /%E0%A4%A) → trả 403.
       Trước đây lỗi này ném URIError ra ngoài handler và làm SẬP cả tiến trình. */
    return null;
  }
  if (clean.indexOf('\0') !== -1) return null;

  const p = path.normalize(path.join(root, clean));
  /* Phải so bằng dấu phân cách: "…/gopinyin" KHÔNG được khớp "…/gopinyinLEAK".
     Thiếu path.sep thì ..%2f đọc được file của thư mục anh em cùng cấp. */
  const rootSep = root.endsWith(path.sep) ? root : root + path.sep;
  return (p === root || p.startsWith(rootSep)) ? p : null;
}

/* ★ Chỉ phục vụ nội dung công khai. Chặn mã nguồn server, dữ liệu người trả tiền
   (pro-paid.json), nội dung Pro (pro-content.json), tài liệu nội bộ và ảnh test.
   Frontend KHÔNG gọi /server/* — chỉ pro-server.js đọc các file đó phía server. */
const DENY = [
  /^\/(server|tests|node_modules)(\/|$)/i,
  /^\/(package(-lock)?\.json|README\.md|KIEM_TRA[^/]*)$/i,
  /^\/(start\.(bat|sh)|\.git|\.env)/i,
  /\.(md|log|bak|env|bat|sh)$/i
];
function isDenied(p) { return DENY.some((re) => re.test(p)); }

/* token → dữ liệu localStorage chờ nhập (dùng 1 lần, hết hạn 10 phút) */
const IMPORTS = new Map();

const server = http.createServer((req, res) => {
  const urlPath = req.url.split('?')[0];

  /* CORS cho các endpoint phụ: trang mở bằng file:// gọi sang localhost */
  const CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  };
  if (req.method === 'OPTIONS') {
    res.writeHead(204, CORS);
    return res.end();
  }

  /* Endpoint nhận diện: để trang mở bằng file:// biết "cổng này đúng là
     GoPinyin" trước khi tự chuyển hướng sang http://localhost. */
  if (urlPath === '/__gopinyin') {
    res.writeHead(200, Object.assign({
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store'
    }, CORS));
    return res.end(JSON.stringify({ app: 'gopinyin', ok: true, port: PORT }));
  }

  /* ── Chuyển dữ liệu file:// → http://localhost ──────────────────────────
     localStorage gắn theo origin, nên đổi địa chỉ là mất tài khoản + tiến độ.
     Trang file:// POST toàn bộ localStorage lên đây, nhận token, rồi chuyển
     sang http://localhost/?import=<token> để trang mới ghi lại. */
  if (urlPath === '/__import') {
    if (req.method === 'POST') {
      let body = '';
      let tooBig = false;
      req.on('data', (c) => {
        if (tooBig) return;
        body += c;
        if (body.length > 8 * 1024 * 1024) { tooBig = true; body = ''; }
      });
      req.on('end', () => {
        if (tooBig) { res.writeHead(413, CORS); return res.end('{}'); }
        let data = {};
        try { data = JSON.parse(body || '{}').data || {}; } catch (e) { data = {}; }
        const token = crypto.randomBytes(9).toString('hex');
        IMPORTS.set(token, { at: Date.now(), data });
        /* Dọn token cũ > 10 phút */
        for (const [k, v] of IMPORTS) if (Date.now() - v.at > 10 * 60 * 1000) IMPORTS.delete(k);
        res.writeHead(200, Object.assign({ 'Content-Type': 'application/json; charset=utf-8' }, CORS));
        res.end(JSON.stringify({ ok: true, token, keys: Object.keys(data).length }));
      });
      return;
    }
    const m = /[?&]token=([^&]+)/.exec(req.url);
    const token = m ? decodeURIComponent(m[1]) : '';
    const rec = token && IMPORTS.get(token);
    res.writeHead(rec ? 200 : 404, Object.assign({ 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }, CORS));
    if (!rec) return res.end('{}');
    IMPORTS.delete(token);   /* dùng một lần */
    return res.end(JSON.stringify({ ok: true, data: rec.data }));
  }

  /* Chặn file nội bộ / dữ liệu thanh toán / nội dung Pro trước khi chạm đĩa */
  if (isDenied(urlPath)) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    return res.end('Không tìm thấy');
  }

  let p = safeJoin(ROOT, req.url === '/' ? '/index.html' : req.url);
  if (!p) { res.writeHead(403); return res.end('Forbidden'); }

  fs.stat(p, (err, st) => {
    if (!err && st.isDirectory()) p = path.join(p, 'index.html');
    fs.readFile(p, (e2, buf) => {
      if (e2) {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        return res.end('Không tìm thấy: ' + req.url);
      }
      const ext = path.extname(p).toLowerCase();
      res.writeHead(200, {
        'Content-Type': MIME[ext] || 'application/octet-stream',
        /* Dev server: không cache để sửa file là thấy ngay */
        'Cache-Control': 'no-store',
        'Access-Control-Allow-Origin': '*'
      });
      res.end(buf);
    });
  });
});

server.on('error', (e) => {
  if (e.code === 'EADDRINUSE') {
    console.error('\n  ✗ Cổng ' + PORT + ' đang bị chương trình khác dùng.');
    console.error('    Chạy cổng khác:  PORT=8090 node server/serve.js\n');
  } else {
    console.error('  ✗ Lỗi server:', e.message);
  }
  process.exit(1);
});

async function start() {
  if (process.env.GP_BUILD_READY !== '1') {
    const { build } = await import('../scripts/build.mjs');
    await build();
  }
  server.listen(PORT, HOST, () => {
  const url = 'http://localhost:' + PORT + '/';
  console.log('\n  🐼 GoPinyin đang chạy tại:  ' + url);
  console.log('  (Ctrl+C để dừng)\n');
  console.log('  Mở qua http://localhost để Chrome GHI NHỚ quyền micro —');
  console.log('  mở thẳng file:///... thì mỗi lần nói đều phải cấp quyền lại.\n');
  if (!NO_OPEN) {
    /* Dùng execFile + mảng tham số để không phải lo quoting của cmd */
    try {
      if (process.platform === 'win32') {
        execFile('cmd', ['/c', 'start', '', url], () => { });
      } else if (process.platform === 'darwin') {
        execFile('open', [url], () => { });
      } else {
        execFile('xdg-open', [url], () => { });
      }
    } catch (e) { }
  }
  });
}
start().catch(error => {
  console.error('[GoPinyin] Không build được ứng dụng:', error.message);
  console.error('Chạy npm install trong thư mục dự án, rồi thử lại.');
  process.exitCode = 1;
});
