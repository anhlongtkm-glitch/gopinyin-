/* Kiểm tra lựa chọn "Học gì" trong AI sinh câu: Câu / Từ vựng / Cả hai.

   Phủ:
   A. Có ô chọn "Học gì" với 3 lựa chọn, mặc định là Câu.
   B. Đổi lựa chọn → nhãn câu hỏi, gợi ý, placeholder, nhãn số lượng đổi theo.
   C. Chọn "Từ vựng" → prompt gửi AI yêu cầu TỪ/CỤM TỪ (không phải câu dài).
   D. Từ vựng ngắn (2 chữ) vẫn gõ/học được bình thường.
   E. Lưu bộ từ vựng → thẻ hiện nhãn "Từ vựng" + đơn vị "từ".
   F. Chọn "Cả câu và từ vựng" → prompt yêu cầu chia đều cả hai.

   Chạy: NODE_PATH="<node_modules có playwright-core>" node tests/ai_vocab_mode.js
*/
const { chromium } = require('playwright-core');
const URL = process.env.TEST_URL || 'http://localhost:8099/';
const CHROME = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';

let pass = 0, fail = 0;
function check(name, ok, detail) {
  if (ok) { pass++; console.log('  PASS  ' + name + (detail !== undefined ? '  →  ' + JSON.stringify(detail) : '')); }
  else { fail++; console.log('  FAIL  ' + name + '  →  ' + JSON.stringify(detail)); }
}
function section(t) { console.log('\n══ ' + t + ' ══'); }

const WORDS = [
  { zh: '纸箱', py: 'zhǐ xiāng', vi: 'thùng carton' },
  { zh: '工厂', py: 'gōng chǎng', vi: 'nhà máy, xưởng' },
  { zh: '打包', py: 'dǎ bāo', vi: 'đóng gói' },
  { zh: '印刷', py: 'yìn shuā', vi: 'in ấn' },
  { zh: '纸板', py: 'zhǐ bǎn', vi: 'bìa carton' }
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
  await page.click('#wsLoginBtn'); await page.waitForTimeout(400);
  await page.click('[data-authtab="register"]'); await page.waitForTimeout(250);
  await page.fill('#authName', 'Tester');
  await page.fill('#authEmail', 'v' + Date.now() + '@l.test');
  await page.fill('#authPass', 'matkhau123');
  await page.click('#authSubmit'); await page.waitForTimeout(1600);
  await page.evaluate(() => {
    const m = document.querySelector('#proModal');
    if (m) { m.classList.remove('show'); m.classList.add('hidden'); }
  });

  // Stub AI: ghi lại prompt nhận được + trả về danh sách từ
  await page.evaluate((words) => {
    window.__gpAiProxy = '/__ai_stub__';
    window.__aiPrompts = [];
    const rf = window.fetch.bind(window);
    window.fetch = (url, opt) => {
      if (String(url).includes('__ai_stub__')) {
        try { window.__aiPrompts.push(JSON.parse(opt.body).prompt); } catch (e) {}
        return Promise.resolve(new Response(JSON.stringify({ text: JSON.stringify(words) }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }));
      }
      return rf(url, opt);
    };
  }, WORDS);

  await page.evaluate(() => document.querySelector('[data-view="ai"]')?.click());
  await page.waitForTimeout(700);

  /* ═══ A. Ô chọn tồn tại ═══ */
  section('A. Ô chọn "Học gì"');
  const kindSel = await page.evaluate(() => {
    const s = document.querySelector('#aiKind');
    if (!s) return null;
    return {
      exists: true,
      value: s.value,
      opts: [...s.options].map(o => ({ v: o.value, t: o.textContent.trim() }))
    };
  });
  check('Có ô chọn #aiKind', !!kindSel, !!kindSel);
  check('Có 3 lựa chọn: câu / từ vựng / cả hai',
    kindSel && kindSel.opts.length === 3 &&
    kindSel.opts.some(o => o.v === 'sentence') &&
    kindSel.opts.some(o => o.v === 'word') &&
    kindSel.opts.some(o => o.v === 'both'),
    kindSel && kindSel.opts.map(o => o.v));
  check('Mặc định là "Câu hoàn chỉnh"', kindSel && kindSel.value === 'sentence', kindSel && kindSel.value);

  /* ═══ B. Đổi lựa chọn → nhãn đổi theo ═══ */
  section('B. Nhãn đổi theo lựa chọn');
  const snap = () => page.evaluate(() => ({
    q: (document.querySelector('#aiPromptLabelText') || {}).textContent || '',
    sub: (document.querySelector('#aiPromptSub') || {}).textContent || '',
    ph: (document.querySelector('#aiPrompt') || {}).placeholder || '',
    hint: (document.querySelector('#aiKindHint') || {}).textContent || '',
    hintShown: (() => { const h = document.querySelector('#aiKindHint'); return h ? getComputedStyle(h).display !== 'none' : false; })(),
    batch: [...document.querySelectorAll('#aiBatch option')].map(o => o.textContent.trim())
  }));
  const before = await snap();
  check('Mặc định nhãn nói về "câu"', /câu/i.test(before.q) && before.batch.every(t => /câu/.test(t)), { q: before.q, batch: before.batch });

  await page.selectOption('#aiKind', 'word');
  await page.waitForTimeout(350);
  const wordUI = await snap();
  check('Chọn "Từ vựng" → câu hỏi đổi sang TỪ VỰNG', /từ vựng/i.test(wordUI.q), wordUI.q);
  check('Gợi ý phụ nói "từ / cụm từ"', /từ| cụm từ/i.test(wordUI.sub), wordUI.sub);
  check('Placeholder đổi sang ví dụ từ vựng', /từ vựng/i.test(wordUI.ph), wordUI.ph);
  check('Nhãn số lượng đổi thành "3 từ / 5 từ / 10 từ"',
    wordUI.batch.every(t => /từ/.test(t)), wordUI.batch);
  check('Hiện gợi ý giải thích chế độ từ vựng', wordUI.hintShown && wordUI.hint.length > 10, wordUI.hint.slice(0, 50));

  await page.selectOption('#aiKind', 'both');
  await page.waitForTimeout(350);
  const bothUI = await snap();
  check('Chọn "Cả hai" → nhãn nói về câu + từ vựng', /câu/i.test(bothUI.q) && /từ vựng/i.test(bothUI.q), bothUI.q);
  check('Nhãn số lượng dùng "mục"', bothUI.batch.every(t => /mục/.test(t)), bothUI.batch);

  /* ═══ C. Prompt gửi AI yêu cầu TỪ VỰNG ═══ */
  section('C. Prompt gửi AI yêu cầu từ vựng');
  await page.selectOption('#aiKind', 'word');
  await page.waitForTimeout(250);
  await page.fill('#aiPrompt', 'từ vựng ngành bao bì carton, công xưởng, dưới 3 chữ');
  await page.evaluate(() => { document.querySelector('#aiKey').value = 'fake-key'; });
  await page.evaluate(() => { window.__aiPrompts = []; });
  await page.click('#aiStartBtn');
  await page.waitForTimeout(1800);

  const prompts = await page.evaluate(() => window.__aiPrompts.slice());
  const p0 = prompts[0] || '';
  check('Đã gọi AI', prompts.length > 0, prompts.length);
  check('Prompt yêu cầu "TỪ hoặc CỤM TỪ"', /TỪ hoặc CỤM TỪ|từ hoặc cụm từ/i.test(p0), p0.slice(0, 160));
  check('Prompt KHÔNG còn yêu cầu "câu hoàn chỉnh"', !/câu tiếng Trung hoàn chỉnh/i.test(p0));
  check('Prompt nhắc tôn trọng giới hạn người dùng', /giới hạn/i.test(p0), /giới hạn/i.test(p0));
  check('Prompt giữ nguyên chủ đề người dùng nhập', p0.includes('bao bì carton'), p0.includes('bao bì carton'));

  /* ═══ D. Học bộ từ vựng: gõ được từ ngắn ═══ */
  section('D. Học từ vựng ngắn');
  const saveModal = await page.evaluate(() => document.querySelector('#appModal').classList.contains('show'));
  check('Vẫn hỏi lưu như thường', saveModal, saveModal);
  const modalTxt = await page.evaluate(() => (document.querySelector('#appModalMsg') || {}).textContent || '');
  check('Popup dùng đơn vị "từ"', /từ/.test(modalTxt), modalTxt.slice(0, 80));

  await page.click('#appModalOk'); await page.waitForTimeout(500);
  await page.fill('#appModalInput', 'Từ vựng bao bì');
  await page.click('#appModalOk'); await page.waitForTimeout(1500);

  const inStudy = await page.evaluate(() => ({
    ok: !document.querySelector('#appCard').classList.contains('hidden'),
    fileInfo: (document.querySelector('#fileInfo') || {}).textContent || '',
    prog: (document.querySelector('#progressText') || {}).textContent || '',
    ph: (document.querySelector('#pinyinInput') || {}).placeholder || ''
  }));
  check('Vào học được bộ từ vựng', inStudy.ok, inStudy.ok);
  check('Nhãn hiện "5 từ"', /5 từ/.test(inStudy.fileInfo), inStudy.fileInfo);
  check('Placeholder ô gõ đổi sang "của từ"', /của từ/.test(inStudy.ph), inStudy.ph);
  check('Đủ 5 từ', inStudy.prog === '0/5', inStudy.prog);

  // Gõ đúng từ đầu tiên (2 chữ Hán) → phải báo Đúng
  await page.focus('#pinyinInput');
  await page.keyboard.insertText(WORDS[0].zh);
  await page.waitForTimeout(700);
  const afterType = await page.evaluate(() => ({
    fb: (document.querySelector('#feedback') || {}).textContent || '',
    cls: (document.querySelector('#feedback') || {}).className || '',
    prog: (document.querySelector('#progressText') || {}).textContent || ''
  }));
  check('Gõ đúng từ ngắn → báo Chính xác', /Chính xác/.test(afterType.fb) && /ok/.test(afterType.cls), afterType.fb);
  check('Lời nhắc dùng "từ tiếp theo" (không phải câu)', /từ tiếp theo/.test(afterType.fb), afterType.fb);
  await page.keyboard.press('Space');
  await page.waitForTimeout(700);
  check('Sang từ tiếp theo', await page.evaluate(() =>
    ((document.querySelector('#progressText') || {}).textContent || '') === '1/5'));

  /* ═══ E. Thẻ đã lưu hiện nhãn "Từ vựng" ═══ */
  section('E. Nhãn loại nội dung trên thẻ đã lưu');
  await page.evaluate(() => document.querySelector('#backLibrary').click());
  await page.waitForTimeout(1000);
  const card = await page.evaluate(() => {
    const c = document.querySelector('#aiSets .aiSetCard');
    if (!c) return null;
    return {
      name: (c.querySelector('h3') || {}).textContent || '',
      badge: (c.querySelector('.aiSetBadge') || {}).textContent || '',
      badgeCls: (c.querySelector('.aiSetBadge') || {}).className || '',
      meta: (c.querySelector('.libraryMeta') || {}).textContent || ''
    };
  });
  check('Có thẻ bộ từ vựng', !!card, !!card);
  check('Thẻ hiện nhãn "Từ vựng"', /Từ vựng/.test(card.badge), card.badge);
  check('Nhãn có class k-word', /k-word/.test(card.badgeCls), card.badgeCls);
  check('Meta dùng đơn vị "từ" (không phải câu)', /từ/.test(card.meta) && !/câu/.test(card.meta), card.meta);

  /* ═══ F. Chế độ "Cả hai" → prompt chia đều ═══ */
  section('F. Chế độ "Cả câu và từ vựng"');
  await page.selectOption('#aiKind', 'both');
  await page.waitForTimeout(250);
  await page.fill('#aiPrompt', 'đi khám bệnh');
  await page.evaluate(() => { window.__aiPrompts = []; });
  await page.click('#aiStartBtn');
  await page.waitForTimeout(1800);
  const pBoth = await page.evaluate(() => (window.__aiPrompts[0] || ''));
  check('Prompt "cả hai" yêu cầu cả TỪ/CỤM TỪ và CÂU',
    /TỪ\/CỤM TỪ|TỪ hoặc CỤM TỪ/i.test(pBoth) && /CÂU hoàn chỉnh/i.test(pBoth), pBoth.slice(0, 200));
  check('Prompt "cả hai" nói chia đều một nửa',
    /MỘT NỬA|một nửa/i.test(pBoth), /MỘT NỬA|một nửa/i.test(pBoth));

  check('Không có lỗi console', errors.length === 0, errors.slice(0, 3));

  console.log('\n  KẾT QUẢ: ' + pass + ' pass, ' + fail + ' fail\n');
  await browser.close();
  process.exit(fail ? 1 : 0);
})();