/* Kiểm tra cảnh báo `file://` — nguyên nhân "hỏi quyền micro mỗi lần nói".

   A. Mở bằng file:// → hiện băng cảnh báo, giải thích đúng lý do.
   B. Có server nội bộ → nút chuyển sang http://localhost và GIỮ tài khoản + tiến độ.
   C. Không có server nội bộ → nút đổi thành hướng dẫn chạy start.bat, KHÔNG chuyển hướng.
   D. Mở bằng http:// → KHÔNG hiện băng cảnh báo.

   Chạy: NODE_PATH="<node_modules có playwright-core>" node tests/file_proto_warn.js
   (cần server/serve.js đang chạy ở cổng 8080 cho mục B)
*/
const { chromium } = require('playwright-core');
const CHROME = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const FILE_URL = process.env.TEST_FILE_URL || require('node:url').pathToFileURL(require('node:path').resolve(__dirname, '../dist/index.html')).href;
const HTTP_URL = process.env.TEST_URL || 'http://localhost:8080/';

let pass = 0, fail = 0;
function check(name, ok, detail) {
  if (ok) { pass++; console.log('  PASS  ' + name + (detail !== undefined ? '  →  ' + JSON.stringify(detail) : '')); }
  else { fail++; console.log('  FAIL  ' + name + '  →  ' + JSON.stringify(detail)); }
}
function section(t) { console.log('\n══ ' + t + ' ══'); }

async function login(page) {
  await page.click('#lpLoginBtn'); await page.waitForTimeout(400);
  await page.click('[data-authtab="register"]'); await page.waitForTimeout(250);
  await page.fill('#authName', 'FileTest');
  await page.fill('#authEmail', 'f' + Date.now() + '@l.test');
  await page.fill('#authPass', 'matkhau123');
  await page.click('#authSubmit'); await page.waitForTimeout(1600);
  await page.evaluate(() => { const m = document.querySelector('#proModal'); if (m) { m.classList.remove('show'); m.classList.add('hidden'); } });
}

(async () => {
  const browser = await chromium.launch({
    executablePath: CHROME, headless: true,
    args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream']
  });

  /* ═══ A + B: file:// có server nội bộ ═══ */
  section('A. file:// → cảnh báo đúng lý do');
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errs = [];
  page.on('pageerror', e => errs.push(String(e)));
  page.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()); });

  await page.goto(FILE_URL, { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(500);
  await login(page);

  await page.evaluate(() => {
    localStorage.setItem('gp:pron:v1:hsk:hsk1', JSON.stringify({ v: 1, byId: { h0: { n: 3, best: 88, last: 88, good: true, at: Date.now() } }, index: 0, recent: [] }));
    localStorage.setItem('gp:marker', 'hello-from-file');
  });
  const before = await page.evaluate(() => ({ email: JSON.parse(localStorage.getItem('gp:user') || '{}').email }));

  await page.evaluate(() => document.querySelector('[data-view="pron"]').click());
  await page.waitForTimeout(1300);
  const warn = await page.evaluate(() => {
    const vis = [...document.querySelectorAll('[data-filewarn]')].filter(e => !e.classList.contains('hidden'));
    return {
      visible: vis.length,
      text: vis[0] ? vis[0].textContent.replace(/\s+/g, ' ') : '',
      btn: vis[0] ? vis[0].querySelector('[data-filewarn-go]').textContent : ''
    };
  });
  check('Mở bằng file:// → hiện băng cảnh báo', warn.visible >= 1, warn.visible);
  check('Nói rõ Chrome không nhớ quyền micro cho file://', /không ghi nhớ quyền micro|hỏi lại quyền micro/i.test(warn.text), warn.text.slice(0, 90));
  check('Có nút chuyển sang localhost', /localhost/i.test(warn.btn), warn.btn);

  section('B. Chuyển sang http://localhost — GIỮ tài khoản + tiến độ');
  await page.evaluate(() => {
    const vis = [...document.querySelectorAll('[data-filewarn]')].find(e => !e.classList.contains('hidden'));
    vis.querySelector('[data-filewarn-go]').click();
  });
  await page.waitForTimeout(2600);
  const after = await page.evaluate(() => ({
    proto: location.protocol,
    email: JSON.parse(localStorage.getItem('gp:user') || '{}').email,
    marker: localStorage.getItem('gp:marker'),
    prog: localStorage.getItem('gp:pron:v1:hsk:hsk1') || ''
  }));
  check('Đã chuyển sang http://', after.proto === 'http:', after.proto);
  check('Giữ nguyên tài khoản đăng nhập', !!before.email && after.email === before.email, { truoc: before.email, sau: after.email });
  check('Giữ nguyên dữ liệu localStorage', after.marker === 'hello-from-file', after.marker);
  check('Giữ nguyên tiến độ luyện phát âm', /h0/.test(after.prog), after.prog.slice(0, 40));
  const warnAfter = await page.evaluate(() => [...document.querySelectorAll('[data-filewarn]')].filter(e => !e.classList.contains('hidden')).length);
  check('Sau khi chuyển → KHÔNG còn cảnh báo', warnAfter === 0, warnAfter);
  await page.close();

  /* ═══ C: file:// nhưng KHÔNG có server nội bộ ═══ */
  section('C. file:// khi chưa chạy start.bat');
  const p2 = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  /* Giả lập: không có server nào ở các cổng nội bộ */
  await p2.addInitScript(() => {
    const f = window.fetch;
    window.fetch = function (u, o) {
      const s = String(u && u.url ? u.url : u);
      if (s.indexOf('/__gopinyin') >= 0) return Promise.reject(new Error('no server'));
      return f.apply(this, arguments);
    };
  });
  await p2.goto(FILE_URL, { waitUntil: 'domcontentloaded' });
  await p2.evaluate(() => localStorage.clear());
  await p2.reload({ waitUntil: 'networkidle' });
  await p2.waitForTimeout(500);
  await login(p2);
  await p2.evaluate(() => document.querySelector('[data-view="pron"]').click());
  await p2.waitForTimeout(1800);
  const noSrv = await p2.evaluate(() => {
    const vis = [...document.querySelectorAll('[data-filewarn]')].filter(e => !e.classList.contains('hidden'));
    return {
      visible: vis.length,
      btn: vis[0] ? vis[0].querySelector('[data-filewarn-go]').textContent : '',
      proto: location.protocol
    };
  });
  check('Vẫn hiện cảnh báo', noSrv.visible >= 1, noSrv.visible);
  check('Nút đổi thành hướng dẫn chạy start.bat', /start\.bat/i.test(noSrv.btn), noSrv.btn);
  check('Không tự chuyển hướng khi chưa có server', noSrv.proto === 'file:', noSrv.proto);
  await p2.close();

  /* ═══ D: http:// → không có cảnh báo ═══ */
  section('D. Mở bằng http:// → không cảnh báo');
  const p3 = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await p3.goto(HTTP_URL, { waitUntil: 'domcontentloaded' });
  await p3.evaluate(() => localStorage.clear());
  await p3.reload({ waitUntil: 'networkidle' });
  await p3.waitForTimeout(500);
  await login(p3);
  await p3.evaluate(() => document.querySelector('[data-view="pron"]').click());
  await p3.waitForTimeout(1200);
  const clean = await p3.evaluate(() => ({
    visible: [...document.querySelectorAll('[data-filewarn]')].filter(e => !e.classList.contains('hidden')).length,
    cards: document.querySelectorAll('#pronLibHsk [data-psrc]').length
  }));
  check('Không hiện cảnh báo khi chạy qua http', clean.visible === 0, clean.visible);
  check('Màn chọn bộ câu vẫn bình thường', clean.cards >= 9, clean.cards);

  const realErrors = errs.filter(e => !/Failed to load resource|501|404|NotAllowedError/i.test(e));
  check('Không có lỗi console', realErrors.length === 0, realErrors.slice(0, 3));

  console.log('\n  KẾT QUẢ: ' + pass + ' pass, ' + fail + ' fail\n');
  await browser.close();
  process.exit(fail ? 1 : 0);
})();
