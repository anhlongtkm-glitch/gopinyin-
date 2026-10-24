/* Kiểm tra màn luyện phát âm vừa khung ở nhiều độ phân giải + chụp ảnh */
const { chromium } = require('playwright-core');
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const URL = 'http://localhost:8099/';

const SIZES = [
  { w: 1920, h: 1080, tag: '1920x1080' },
  { w: 1440, h: 900, tag: '1440x900' },
  { w: 1366, h: 768, tag: '1366x768' },
  { w: 1280, h: 720, tag: '1280x720' },
  { w: 1024, h: 768, tag: '1024x768' }
];

(async () => {
  const browser = await chromium.launch({
    executablePath: CHROME, headless: true,
    args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream', '--autoplay-policy=no-user-gesture-required']
  });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.addInitScript(() => {
    window.__fakeTranscript = '';
    function FakeSR() { }
    FakeSR.prototype.start = function () {
      const self = this;
      setTimeout(function () {
        if (self.onresult) {
          const alt = { transcript: window.__fakeTranscript, confidence: 0.88 };
          const arr = [alt]; arr.isFinal = true;
          self.onresult({ resultIndex: 0, results: [arr] });
        }
        setTimeout(function () { if (self.onend) self.onend(); }, 40);
      }, 100);
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
  await page.fill('#authName', 'Probe');
  await page.fill('#authEmail', 'q' + Date.now() + '@l.test');
  await page.fill('#authPass', 'matkhau123');
  await page.click('#authSubmit'); await page.waitForTimeout(1500);
  await page.evaluate(() => { const m = document.querySelector('#proModal'); if (m) { m.classList.remove('show'); m.classList.add('hidden'); } });
  await page.evaluate(() => document.querySelector('[data-view="pron"]').click());
  await page.waitForTimeout(900);
  await page.evaluate(() => document.querySelector('#pronLibHsk [data-psrc="hsk:hsk1"]').click());
  await page.waitForTimeout(1100);

  /* tạo kết quả để đo cả cột phải */
  const zh = await page.evaluate(() => {
    const S = window.__pron._state; return S.items[S.order[S.index]].zh;
  });
  const chars = Array.from(zh).filter(c => /[\u3400-\u9fff]/.test(c));
  await page.evaluate(t => { window.__fakeTranscript = t; }, chars.slice(0, -1).join('') + '了');
  await page.click('#pronMicBtn'); await page.waitForTimeout(500);
  await page.click('#pronMicBtn'); await page.waitForTimeout(2600);
  await page.evaluate(() => {
    document.querySelectorAll('#toastHost .toast').forEach(t => t.remove());
    const c = document.querySelector('#confettiCanvas'); if (c) c.remove();
  });

  for (const s of SIZES) {
    await page.setViewportSize({ width: s.w, height: s.h });
    await page.waitForTimeout(450);
    const m = await page.evaluate(() => {
      const vh = window.innerHeight, vw = window.innerWidth;
      const r = (sel) => { const e = document.querySelector(sel); if (!e) return null; const b = e.getBoundingClientRect(); return { t: Math.round(b.top), b: Math.round(b.bottom), l: Math.round(b.left), r: Math.round(b.right) }; };
      const over = [];
      for (const sel of ['#pronNextBtn', '#pronMicBtn', '#pronResult', '#pronSampleBtn']) {
        const b = r(sel);
        if (!b) continue;
        if (b.b > vh + 1 || b.t < -1) over.push(sel + ':' + b.t + '..' + b.b);
      }
      return {
        vh, vw,
        pageScroll: document.documentElement.scrollHeight - vh,
        hScroll: document.documentElement.scrollWidth - vw,
        overflow: over,
        resultRight: r('#pronResult') ? r('#pronResult').r : null,
        micTop: r('#pronMicBtn') ? r('#pronMicBtn').t : null
      };
    });
    const ok = m.pageScroll <= 2 && m.overflow.length === 0;
    console.log((ok ? '  OK   ' : '  FAIL ') + s.tag + '  ' + JSON.stringify(m));
    await page.screenshot({ path: 'tests/_fit_' + s.tag + '.png' });
  }
  await browser.close();
})();
