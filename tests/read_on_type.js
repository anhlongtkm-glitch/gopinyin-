/* Kiểm tra chức năng "Đọc khi gõ":
   - gõ từng chữ 1 → đọc từng chữ
   - gõ 1 lúc nhiều chữ (2, 3) → đọc GỘP 1 lần
   - chữ cuối cùng CŨNG được đọc
   - tắt công tắc → không đọc
*/
const { chromium } = require('playwright-core');
const URL = process.env.TEST_URL || 'http://localhost:8099/';
const CHROME = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';

let pass = 0, fail = 0;
function check(name, ok, detail) {
  if (ok) { pass++; console.log('  PASS  ' + name + (detail !== undefined ? '  →  ' + JSON.stringify(detail) : '')); }
  else { fail++; console.log('  FAIL  ' + name + '  →  ' + JSON.stringify(detail)); }
}

(async () => {
  const browser = await chromium.launch({ executablePath: CHROME, headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });

  await page.goto(URL, { waitUntil: 'networkidle' });
  await page.evaluate(() => document.querySelector('#lpLoginBtn')?.click());
  await page.waitForTimeout(400);
  await page.evaluate(() => document.querySelector('#authGuestBtn')?.click());
  await page.waitForTimeout(700);
  await page.evaluate(() => {
    const m = document.querySelector('#proModal');
    if (m) { m.classList.add('hidden'); m.style.display = 'none'; }
  });

  // Bọc speechSynthesis.speak để ghi lại mọi utterance đọc ra.
  // Chỉ bọc 1 lần (nếu bọc 2 lần, mỗi utterance bị ghi nhân đôi).
  await page.evaluate(() => {
    if (window.__spokenPatched) return;
    window.__spokenPatched = true;
    window.__spoken = [];
    const orig = window.speechSynthesis.speak.bind(window.speechSynthesis);
    window.speechSynthesis.speak = (u) => { window.__spoken.push(u.text); return orig(u); };
  });

  // Mở một bộ HSK có sẵn (dữ liệu nhúng trong data.js — không cần mạng)
  await page.evaluate(() => document.querySelector('[data-view="library"]')?.click());
  await page.waitForTimeout(900);
  const opened = await page.evaluate(() => {
    const cards = [...document.querySelectorAll('#vocabList .vocabCard:not(.isLocked)')];
    if (!cards.length) return { err: 'không có card HSK' };
    const c = cards[0];
    const label = c.textContent.replace(/\s+/g, ' ').trim();
    c.click();
    return { vsrc: c.dataset.vsrc, label };
  });
  console.log('  Bộ dữ liệu:', JSON.stringify(opened));
  await page.waitForTimeout(1800);

  // Lấy đáp án câu hiện tại
  const zh = await page.evaluate(() => {
    const t = document.querySelector('#chinese')?.textContent || '';
    return t;
  });
  console.log('\n  Câu hiện tại:', JSON.stringify(zh));

  const toggleVisible = await page.evaluate(() => {
    const b = document.querySelector('#readTypeToggle');
    if (!b) return null;
    return { pressed: b.getAttribute('aria-pressed'), label: b.textContent.replace(/\s+/g, ' ').trim() };
  });
  check('Nút "Đọc khi gõ" tồn tại', !!toggleVisible, toggleVisible);
  check('Mặc định BẬT', toggleVisible && toggleVisible.pressed === 'true', toggleVisible && toggleVisible.pressed);

  // === Chà giọng đọc để không phụ thuộc voice thật ===
  await page.evaluate(() => {
    window.speechSynthesis.getVoices = () => [];
    window.speechSynthesis.cancel = () => {};
  });

  // Lấy ký tự Hán của đáp án
  const chars = await page.evaluate(() => {
    const el = document.querySelector('#chinese');
    const raw = el ? el.textContent : '';
    return [...raw].filter(c => /[\u3400-\u9fff]/.test(c));
  });
  console.log('  Chữ Hán đáp án (' + chars.length + '):', chars.join(''));
  if (chars.length < 3) {
    console.log('  !! Không lấy được câu — dừng.');
    await browser.close(); process.exit(1);
  }

  // ---- TEST 1: gõ từng chữ 1 ----
  await page.evaluate(() => {
    const b = document.querySelector('#retrySentenceBtn') || document.querySelector('[data-action="retry"]');
    if (b) b.click();
  });
  await page.waitForTimeout(400);
  await page.evaluate(() => { window.__spoken = []; });

  for (let i = 0; i < Math.min(3, chars.length); i++) {
    await page.focus('#pinyinInput');
    await page.keyboard.insertText(chars[i]);
    await page.waitForTimeout(260);
  }
  const t1 = await page.evaluate(() => window.__spoken.slice());
  check('Gõ từng chữ riêng lẻ → đọc từng chữ', t1.length >= 2, t1);

  // ---- TEST 2: gõ 3 chữ MỘT LƯỢT → đọc gộp 1 lần ----
  await page.evaluate(() => {
    const b = document.querySelector('#retrySentenceBtn') || document.querySelector('[data-action="retry"]');
    if (b) b.click();
  });
  await page.waitForTimeout(400);
  await page.evaluate(() => { window.__spoken = []; });
  await page.focus('#pinyinInput');
  await page.keyboard.insertText(chars.slice(0, 3).join(''));
  await page.waitForTimeout(500);
  const t2 = await page.evaluate(() => window.__spoken.slice());
  check('Gõ 3 chữ một lúc → đọc GỘP 1 lần ("' + chars.slice(0, 3).join('') + '")',
    t2.length === 1 && t2[0] === chars.slice(0, 3).join(''), t2);

  // ---- TEST 3: gõ 2 chữ một lượt ----
  await page.evaluate(() => {
    const b = document.querySelector('#retrySentenceBtn') || document.querySelector('[data-action="retry"]');
    if (b) b.click();
  });
  await page.waitForTimeout(400);
  await page.evaluate(() => { window.__spoken = []; });
  await page.focus('#pinyinInput');
  await page.keyboard.insertText(chars.slice(0, 2).join(''));
  await page.waitForTimeout(500);
  const t3 = await page.evaluate(() => window.__spoken.slice());
  check('Gõ 2 chữ một lúc → đọc gộp 1 lần ("' + chars.slice(0, 2).join('') + '")',
    t3.length === 1 && t3[0] === chars.slice(0, 2).join(''), t3);

  // ---- TEST 4: chữ CUỐI CÙNG cũng được đọc ----
  await page.evaluate(() => {
    const b = document.querySelector('#retrySentenceBtn') || document.querySelector('[data-action="retry"]');
    if (b) b.click();
  });
  await page.waitForTimeout(400);
  await page.evaluate(() => { window.__spoken = []; });
  // gõ hết câu, gõ chữ cuối RIÊNG một lần
  await page.focus('#pinyinInput');
  await page.keyboard.insertText(chars.slice(0, -1).join(''));
  await page.waitForTimeout(400);
  await page.evaluate(() => { window.__spoken = []; });
  await page.keyboard.insertText(chars[chars.length - 1]);
  await page.waitForTimeout(600);
  const t4 = await page.evaluate(() => window.__spoken.slice());
  check('Chữ CUỐI CÙNG được đọc (có "' + chars[chars.length - 1] + '")',
    t4.length >= 1 && t4.some(s => s.includes(chars[chars.length - 1])), t4);
  check('Gõ xong câu → nối thêm tiếng đọc cả câu',
    t4.some(s => s.replace(/[^一-鿿]/g, '').length > 1), t4);

  // ---- TEST 5: TẮT công tắc → KHÔNG đọc ----
  await page.evaluate(() => {
    const b = document.querySelector('#retrySentenceBtn') || document.querySelector('[data-action="retry"]');
    if (b) b.click();
  });
  await page.waitForTimeout(300);
  await page.click('#readTypeToggle');
  await page.waitForTimeout(200);
  const offState = await page.evaluate(() => document.querySelector('#readTypeToggle').getAttribute('aria-pressed'));
  check('Tắt công tắc → aria-pressed=false', offState === 'false', offState);

  await page.evaluate(() => { window.__spoken = []; });
  await page.focus('#pinyinInput');
  await page.keyboard.insertText(chars.slice(0, 3).join(''));
  await page.waitForTimeout(500);
  const t5 = await page.evaluate(() => window.__spoken.slice());
  check('ĐÃ TẮT → gõ chữ không đọc', t5.length === 0, t5);

  // ---- TEST 6: BẬT LẠI → đọc tiếp ----
  await page.click('#readTypeToggle');
  await page.waitForTimeout(200);
  await page.evaluate(() => { window.__spoken = []; });
  await page.focus('#pinyinInput');
  await page.keyboard.insertText(chars.slice(3, 4).join(''));
  await page.waitForTimeout(400);
  const t6 = await page.evaluate(() => window.__spoken.slice());
  check('Bật lại → đọc tiếp chữ vừa gõ', t6.length >= 1, t6);

  check('Không có lỗi console', errors.length === 0, errors.slice(0, 3));

  console.log('\n  KẾT QUẢ: ' + pass + ' pass, ' + fail + ' fail\n');
  await browser.close();
  process.exit(fail ? 1 : 0);
})();