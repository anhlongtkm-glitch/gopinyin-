/* Kiểm tra hành vi phím sau khi sửa:
   · Space CHỈ sang mục (không bao giờ ẩn/hiện pinyin)
   · Enter là phím DUY NHẤT ẩn/hiện pinyin
   · Lưới an toàn: ô gõ đã đúng đáp án nhưng trạng thái chưa chốt → Space vẫn sang */
const { chromium } = require('playwright-core');
const URL = 'http://localhost:8099/';
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';

let pass = 0, fail = 0;
function check(name, ok, detail) {
  if (ok) { pass++; console.log('  PASS  ' + name + (detail !== undefined ? '  →  ' + JSON.stringify(detail) : '')); }
  else { fail++; console.log('  FAIL  ' + name + '  →  ' + JSON.stringify(detail)); }
}
function section(t) { console.log('\n══ ' + t + ' ══'); }

const ITEMS = [
  { zh: '批量', py: 'pī liàng', vi: 'theo lô, hàng loạt' },
  { zh: '纸箱', py: 'zhǐ xiāng', vi: 'thùng carton' },
  { zh: '纸板', py: 'zhǐ bǎn', vi: 'bìa carton' },
  { zh: '包装', py: 'bāo zhuāng', vi: 'đóng gói' },
  { zh: '运输', py: 'yùn shū', vi: 'vận chuyển' }
];

(async () => {
  const browser = await chromium.launch({ executablePath: CHROME, headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 950 } });
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });

  await page.goto(URL, { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(600);
  await page.click('#lpLoginBtn'); await page.waitForTimeout(400);
  await page.click('[data-authtab="register"]'); await page.waitForTimeout(250);
  await page.fill('#authName', 'Probe');
  await page.fill('#authEmail', 'p' + Date.now() + '@l.test');
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
        const text = JSON.stringify(isVerify ? [] : items);
        return Promise.resolve(new Response(JSON.stringify({ text }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }));
      }
      return rf(url, opt);
    };
  }, ITEMS);

  await page.evaluate(() => document.querySelector('[data-view="ai"]')?.click());
  await page.waitForTimeout(700);
  await page.selectOption('#aiKind', 'word');
  await page.waitForTimeout(250);
  await page.fill('#aiPrompt', 'từ vựng bao bì');
  await page.evaluate(() => { document.querySelector('#aiKey').value = 'fake-key'; });
  await page.click('#aiStartBtn');
  await page.waitForTimeout(2200);
  await page.click('#appModalCancel');
  await page.waitForTimeout(1600);

  const st = () => page.evaluate(() => ({
    zh: [...(document.querySelector('#chinese') || {}).textContent || ''].filter(c => /[\u3400-\u9fff]/.test(c)).join(''),
    fb: (document.querySelector('#feedback') || {}).textContent || '',
    ro: (document.querySelector('#pinyinInput') || {}).readOnly,
    prog: (document.querySelector('#progressText') || {}).textContent || '',
    py: !!document.querySelector('#chinese')?.classList.contains('show-pinyin'),
    hintBtn: (document.querySelector('#hintBtn') || {}).textContent || ''
  }));

  /* A. Space khi CHƯA gõ xong → KHÔNG bật pinyin, KHÔNG sang mục */
  section('A. Space khi chưa gõ xong');
  const a0 = await st();
  await page.keyboard.press('Space');
  await page.waitForTimeout(400);
  const a1 = await st();
  check('Space KHÔNG bật pinyin', a1.py === false, { truoc: a0.py, sau: a1.py });
  check('Space KHÔNG sang mục', a1.prog === a0.prog && a1.zh === a0.zh, { truoc: a0.prog, sau: a1.prog });
  await page.keyboard.press('Space');
  await page.waitForTimeout(300);
  check('Bấm Space lần 2 vẫn không bật pinyin', (await st()).py === false);

  /* B. Enter → ẩn/hiện pinyin */
  section('B. Enter ẩn/hiện pinyin');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(400);
  const b1 = await st();
  check('Enter BẬT pinyin', b1.py === true, b1.py);
  check('Nút 💡 đổi nhãn theo', /Ẩn Pinyin/.test(b1.hintBtn), b1.hintBtn);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(400);
  check('Enter TẮT pinyin', (await st()).py === false);
  await page.keyboard.press('Enter');   // bật lại để kiểm tra Space không tắt nó
  await page.waitForTimeout(400);
  check('Bật pinyin lại để kiểm tra Space', (await st()).py === true);

  /* C. Space khi đã gõ đúng → sang mục, KHÔNG tắt pinyin */
  section('C. Space khi đã Đúng');
  await page.focus('#pinyinInput');
  await page.keyboard.insertText('批量');
  await page.waitForTimeout(800);
  const c0 = await st();
  check('Báo Chính xác + khoá ô gõ', /Chính xác/.test(c0.fb) && c0.ro === true, { fb: c0.fb.slice(0, 40), ro: c0.ro });
  await page.keyboard.press('Space');
  await page.waitForTimeout(800);
  const c1 = await st();
  check('Space SANG mục 2', c1.prog === '1/5' && c1.zh === '纸箱', { prog: c1.prog, zh: c1.zh });
  check('Space KHÔNG tắt pinyin đang bật', c1.py === true, c1.py);

  /* D. Lưới an toàn: ô gõ đã đúng đáp án nhưng trạng thái chưa chốt */
  section('D. Lưới an toàn khi trạng thái chưa chốt');
  await page.evaluate(() => {
    const inp = document.querySelector('#pinyinInput');
    inp.readOnly = false;
    inp.value = '纸箱';          // đặt thẳng giá trị, KHÔNG phát input event
  });
  const d0 = await st();
  check('Chưa có thông báo Chính xác', !/Chính xác/.test(d0.fb), d0.fb);
  await page.keyboard.press('Space');
  await page.waitForTimeout(800);
  const d1 = await st();
  check('Space vẫn sang mục 3 (không bị nuốt)', d1.prog === '2/5' && d1.zh === '纸板', { prog: d1.prog, zh: d1.zh });

  /* E. Space ở mục cuối → không kẹt */
  section('E. Space ở mục cuối cùng');
  for (const zh of ['纸板', '包装', '运输']) {
    await page.focus('#pinyinInput');
    await page.keyboard.insertText(zh);
    await page.waitForTimeout(600);
    await page.keyboard.press('Space');
    await page.waitForTimeout(600);
  }
  const e1 = await st();
  check('Đi hết 5 mục (5/5)', e1.prog === '5/5', e1.prog);
  check('Không có lỗi console', errors.length === 0, errors.slice(0, 3));

  console.log('\n  KẾT QUẢ: ' + pass + ' pass, ' + fail + ' fail\n');
  await browser.close();
  process.exit(fail ? 1 : 0);
})();
