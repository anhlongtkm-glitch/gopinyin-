#!/usr/bin/env node
'use strict';
/* Kiểm tra nhanh một cổng có phải là GoPinyin đang chạy không.
   Dùng Node (không dùng PowerShell) để tránh:
     - lỗi phân giải localhost / IPv6 trên một số máy
     - xung đột với lệnh `timeout` của GNU (từ Git Bash) trong PATH
   Chỉ thoát 0 khi thực sự là GoPinyin (endpoint /__gopinyin trả về JSON
   chứa "gopinyin") — tránh nhầm với một server khác chiếm cùng cổng.
   Thoát 1 nếu không truy cập được hoặc không phải GoPinyin. */
const http = require('http');
const url = process.argv[2];
if (!url) { process.exit(1); }
let u;
try { u = new URL(url); } catch (e) { process.exit(1); }
const req = http.get(
  { host: u.hostname, port: u.port, path: u.pathname + u.search, timeout: 1500 },
  (res) => {
    let body = '';
    res.on('data', (c) => { body += c; if (body.length > 4096) req.destroy(); });
    res.on('end', () => {
      process.exit(res.statusCode === 200 && /gopinyin/i.test(body) ? 0 : 1);
    });
  }
);
req.on('error', () => process.exit(1));
req.on('timeout', () => { req.destroy(); process.exit(1); });
