/* Chụp ảnh: thanh gợi ý phím mới (Space = sang mục · Enter = ẩn/hiện pinyin)
   và công tắc "Soát lại nghĩa" trong AI sinh câu. */
const { chromium } = require('playwright-core');
const CHROME = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const URL = process.env.TEST_URL || 'http://localhost:8099/';

const ITEMS = [
  { zh: '批量', py: 'pī liàng', vi: 'số lượng lớn' },
  { zh: '纸箱', py: 'zhǐ xiāng', vi: 'thùng carton' }
];

(async () => {
  const browser = await chromium.launch({ executablePath: CHROME, headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 950 }, deviceScaleFactor: 2 });
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));

  await page.goto(URL, { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(600);
  await page.click('#wsLoginBtn'); await page.waitForTimeout(400);
  await page.click('[data-authtab="register"]'); await page.waitForTimeout(250);
  await page.fill('#authName', 'Tester');
  await page.fill('#authEmail', 's' + Date.now() + '@l.test');
  await page.fill('#authPass', 'matkhau123');
  await page.click('#authSubmit'); await page.waitForTimeout(1600);
  await page.evaluate(() => {
    const m = document.querySelector('#proModal');
    if (m) { m.classList.remove('show'); m.classList.add('hidden'); }
  });

  await page.evaluate((items) => {
    window.__gpAiProxy = '/__ai_stub__';
    const rf = window.fetch.bind(window);
    window.fetch = (url, opt) => {
      if (String(url).includes('__ai_stub__')) {
        let prompt = '';
        try { prompt = JSON.parse(opt.body).prompt || ''; } catch (e) {}
        const isVerify = /CẦN SOÁT|soát lỗi NGHĨA/i.test(prompt);
        const text = JSON.stringify(isVerify
          ? [{ zh: '批量', ok: false, vi_dung: 'theo lô, hàng loạt' }, { zh: '纸箱', ok: true }]
          : items);
        return Promise.resolve(new Response(JSON.stringify({ text }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }));
      }
      return rf(url, opt);
    };
  }, ITEMS);

  /* 1) Màn AI sinh câu: công tắc "Soát lại nghĩa" */
  await page.evaluate(() => document.querySelector('[data-view="ai"]')?.click());
  await page.waitForTimeout(800);
  await page.selectOption('#aiKind', 'word');
  await page.waitForTimeout(300);
  await page.evaluate(() => { const d = document.querySelector('.aiDetails'); if (d) d.open = true; });
  await page.waitForTimeout(400);
  await page.screenshot({ path: 'tests/shot_ai_verify.png' });
  console.log('shot_ai_verify.png');

  /* 2) Màn học: thanh gợi ý phím mới */
  await page.fill('#aiPrompt', 'từ vựng ngành bao bì carton');
  await page.evaluate(() => { document.querySelector('#aiKey').value = 'fake-key'; });
  await page.click('#aiStartBtn');
  await page.waitForTimeout(2400);
  await page.click('#appModalCancel');
  await page.waitForTimeout(1800);
  await page.focus('#pinyinInput');
  await page.keyboard.insertText('批量');
  await page.waitForTimeout(900);
  await page.screenshot({ path: 'tests/shot_space_hint.png' });
  console.log('shot_space_hint.png');

  if (errors.length) console.log('LỖI:', errors);
  await browser.close();
})();
