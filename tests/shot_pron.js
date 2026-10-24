/* Chụp ảnh màn Luyện phát âm: trạng thái sẵn sàng + trạng thái có kết quả + mobile */
const { chromium } = require('playwright-core');
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const URL = 'http://localhost:8080/';

async function boot(browser, viewport) {
  const page = await browser.newPage({ viewport, deviceScaleFactor: 2 });
  page.on('pageerror', e => console.log('PAGEERROR:', String(e)));
  await page.addInitScript(() => {
    window.__fakeTranscript = '';
    window.__fakeConf = 0.9;
    function FakeSR() { }
    FakeSR.prototype.start = function () {
      const self = this;
      setTimeout(function () {
        if (self.onresult) {
          const alt = { transcript: window.__fakeTranscript, confidence: window.__fakeConf };
          const arr = [alt]; arr.isFinal = true;
          self.onresult({ resultIndex: 0, results: [arr] });
        }
        setTimeout(function () { if (self.onend) self.onend(); }, 40);
      }, 120);
    };
    FakeSR.prototype.stop = function () { const s = this; setTimeout(function () { if (s.onend) s.onend(); }, 30); };
    FakeSR.prototype.abort = function () { };
    window.SpeechRecognition = FakeSR;
    window.webkitSpeechRecognition = FakeSR;
  });
  await page.goto(URL, { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(500);
  await page.click('#lpLoginBtn'); await page.waitForTimeout(300);
  await page.click('[data-authtab="register"]'); await page.waitForTimeout(200);
  await page.fill('#authName', 'Minh Anh');
  await page.fill('#authEmail', 'p' + Date.now() + '@l.test');
  await page.fill('#authPass', 'matkhau123');
  await page.click('#authSubmit'); await page.waitForTimeout(1500);
  await page.evaluate(() => { const m = document.querySelector('#proModal'); if (m) { m.classList.remove('show'); m.classList.add('hidden'); } });
  await page.evaluate(() => document.querySelector('[data-view="pron"]').click());
  await page.waitForTimeout(1100);
  /* bỏ hiệu ứng confetti + toast chúc mừng để ảnh chụp sạch */
  await page.evaluate(() => {
    const c = document.querySelector('#confettiCanvas'); if (c) c.remove();
    document.querySelectorAll('#toastHost .toast').forEach(t => t.remove());
  });
  await page.waitForTimeout(250);
  return page;
}

/* Vào màn LUYỆN: từ màn chọn bộ, bấm thẻ HSK 1 */
async function enterStudy(page) {
  await page.evaluate(() => {
    const b = document.querySelector('#pronLibHsk [data-psrc="hsk:hsk1"]') || document.querySelector('#pronLibHsk [data-psrc]');
    b.click();
  });
  await page.waitForTimeout(1200);
}

(async () => {
  const browser = await chromium.launch({
    executablePath: CHROME, headless: true,
    args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream', '--autoplay-policy=no-user-gesture-required']
  });

  /* ── Desktop ── */
  const page = await boot(browser, { width: 1440, height: 900 });
  await page.screenshot({ path: 'tests/shot_pron_picker.png' });
  console.log('shot_pron_picker.png');
  await enterStudy(page);
  await page.screenshot({ path: 'tests/shot_pron_idle.png' });
  console.log('shot_pron_idle.png');

  /* Ghi âm một câu đúng một phần: nghe nhầm 1 chữ + thiếu 1 chữ để thấy đủ màu */
  const target = await page.evaluate(() => {
    const S = window.__pron._state;
    const it = S.items[S.order[S.index]];
    return { zh: it.zh, py: it.py };
  });
  const chars = Array.from(target.zh).filter(c => /[\u3400-\u9fff]/.test(c));
  // bỏ chữ áp chót + đổi chữ cuối thành chữ khác
  const partial = chars.slice(0, -1).join('') + '了';
  await page.evaluate(t => { window.__fakeTranscript = t; window.__fakeConf = 0.86; }, partial);
  await page.click('#pronMicBtn');
  await page.waitForTimeout(600);
  await page.screenshot({ path: 'tests/shot_pron_recording.png' });
  console.log('shot_pron_recording.png');
  await page.click('#pronMicBtn');
  await page.waitForTimeout(3200);
  await page.screenshot({ path: 'tests/shot_pron_result.png' });
  console.log('shot_pron_result.png');

  /* Popover chi tiết */
  await page.click('#pronHanzi .pronChar.st-bad, #pronHanzi .pronChar');
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'tests/shot_pron_detail.png' });
  console.log('shot_pron_detail.png');
  await page.close();

  /* ── Mobile: đăng nhập ở khổ desktop, rồi NẠP LẠI ở 390px để app khởi động
     đúng chế độ mobile (nút đăng nhập bị ẩn ở 390px nên không click được). ── */
  const m = await boot(browser, { width: 1440, height: 1000 });
  await m.setViewportSize({ width: 390, height: 844 });
  await m.reload({ waitUntil: 'networkidle' });
  await m.waitForTimeout(1200);
  await m.evaluate(() => {
    const c = document.querySelector('#confettiCanvas'); if (c) c.remove();
    document.querySelectorAll('#toastHost .toast').forEach(t => t.remove());
    document.querySelector('[data-view="pron"]')?.click();
  });
  await m.waitForTimeout(1100);
  await enterStudy(m);
  await m.evaluate(() => {
    const c = document.querySelector('#confettiCanvas'); if (c) c.remove();
    document.querySelectorAll('#toastHost .toast').forEach(t => t.remove());
  });
  await m.waitForTimeout(300);
  await m.screenshot({ path: 'tests/shot_pron_mobile.png' });
  console.log('shot_pron_mobile.png');

  await browser.close();
})();
