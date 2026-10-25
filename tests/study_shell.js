/* Kiểm tra nhóm "📚 Nội dung" của màn Luyện gõ: select đổi bộ + nút ← Bộ khác */
const { chromium } = require('playwright-core');
const CHROME = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const URL = process.env.TEST_URL || 'http://localhost:8080/';
let pass = 0, fail = 0;
const check = (n, ok, d) => { if (ok) { pass++; console.log('  PASS  ' + n + (d !== undefined ? '  →  ' + JSON.stringify(d) : '')); } else { fail++; console.log('  FAIL  ' + n + '  →  ' + JSON.stringify(d)); } };

(async () => {
  const browser = await chromium.launch({ executablePath: CHROME, headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errs = [];
  page.on('pageerror', e => errs.push(String(e)));
  page.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()); });

  await page.goto(URL, { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(400);
  await page.click('#wsLoginBtn'); await page.waitForTimeout(300);
  await page.click('[data-authtab="register"]'); await page.waitForTimeout(200);
  await page.fill('#authName', 'Minh Anh');
  await page.fill('#authEmail', 's' + Date.now() + '@l.test');
  await page.fill('#authPass', 'matkhau123');
  await page.click('#authSubmit'); await page.waitForTimeout(1500);
  await page.evaluate(() => { const m = document.querySelector('#proModal'); if (m) { m.classList.remove('show'); m.classList.add('hidden'); } });

  await page.evaluate(() => document.querySelector('[data-view="library"]').click());
  await page.waitForTimeout(600);
  await page.evaluate(() => document.querySelector('#vocabList [data-vsrc="hsk1"]').click());
  await page.waitForTimeout(1600);

  const st = await page.evaluate(() => {
    const s = document.querySelector('#appSource');
    return {
      opts: s ? [...s.options].map(o => o.value + ' | ' + o.textContent) : null,
      val: s ? s.value : null,
      fit: document.body.classList.contains('studyFit'),
      back: !!document.querySelector('#backLibrary') && !document.querySelector('#backLibrary').classList.contains('hidden'),
      prog: document.querySelector('#progressText').textContent,
      name: document.querySelector('#fileInfo').textContent.slice(0, 40)
    };
  });
  check('Select Nội dung có option + đang chọn đúng bộ', st.val === 'id:vocab:hsk1', st.val);
  check('Có đủ HSK 1–9 trong danh sách', st.opts.filter(o => o.startsWith('src:hsk')).length === 8, st.opts.length);
  check('Khoá khung hình bật (studyFit)', st.fit === true);
  check('Không còn nút "← Thư viện" ở thanh tiêu đề', st.back === false);
  check('Tiến độ đúng bộ HSK 1', st.prog === '0/301', st.prog);

  /* đổi sang HSK 2 */
  await page.selectOption('#appSource', 'src:hsk2');
  await page.waitForTimeout(2200);
  const st2 = await page.evaluate(() => ({
    val: document.querySelector('#appSource').value,
    prog: document.querySelector('#progressText').textContent,
    zh: document.querySelector('#chinese').textContent.slice(0, 12),
    fit: document.body.classList.contains('studyFit'),
    opts: [...document.querySelector('#appSource').options].map(o => o.value)
  }));
  check('Đổi sang HSK 2 → bộ câu đổi theo', st2.val === 'id:vocab:hsk2', st2.val);
  check('Tiến độ của bộ HSK 2 (không phải 301 câu)', st2.prog.endsWith('/150') || st2.prog.endsWith('/151') || st2.prog !== '0/301', st2.prog);
  check('Vẫn giữ khoá khung hình sau khi đổi bộ', st2.fit === true);
  check('Bộ HSK 1 đã tạo hiện 1 lần (không trùng 💾 + 🎓)', st2.opts.includes('id:vocab:hsk1') && !st2.opts.includes('src:hsk1'), st2.opts.slice(0, 4));

  /* bấm ← Bộ khác */
  await page.click('#appBackBtn');
  await page.waitForTimeout(800);
  const st3 = await page.evaluate(() => ({
    lib: !document.querySelector('#libraryCard').classList.contains('hidden'),
    app: document.querySelector('#appCard').classList.contains('hidden'),
    fit: document.body.classList.contains('studyFit')
  }));
  check('← Bộ khác → về Thư viện', st3.lib && st3.app, st3);
  check('Mở khoá cuộn trang khi rời màn học', st3.fit === false);

  /* ★ Tiến độ hiện NGAY trên thẻ chủ đề / cấp HSK (mục "Bộ câu của bạn" đã bỏ) */
  const st3b = await page.evaluate(() => {
    const card = document.querySelector('#vocabList [data-vsrc="hsk2"]');
    return {
      noStudied: !document.querySelector('#studiedSets') && !document.querySelector('#studiedWrap'),
      meta: card ? (card.querySelector('.vocabMeta')?.innerText || '') : '',
      hasBar: !!(card && card.querySelector('.vocabProg'))
    };
  });
  check('Đã bỏ mục "📖 Bộ câu của bạn" (#studiedSets)', st3b.noStudied);
  check('Thẻ HSK 2 có thanh tiến độ (tiến độ nằm ngay trên thẻ)', st3b.hasBar && st3b.meta === '', st3b);

  /* vào lại → tiến độ còn */
  await page.evaluate(() => document.querySelector('#vocabList [data-vsrc="hsk2"]')?.click());
  await page.waitForTimeout(1400);
  const st4 = await page.evaluate(() => ({
    fit: document.body.classList.contains('studyFit'),
    val: document.querySelector('#appSource').value,
    prog: document.querySelector('#progressText').textContent
  }));
  check('Mở lại bộ đã học → khoá khung hình + đúng bộ', st4.fit && st4.val === 'id:vocab:hsk2', st4);

  /* chuyển sang mục khác bằng thanh bên → phải mở khoá */
  await page.evaluate(() => document.querySelector('.ws-navItem[data-view="dash"]').click());
  await page.waitForTimeout(600);
  const st5 = await page.evaluate(() => document.body.classList.contains('studyFit'));
  check('Sang Bảng điều khiển → mở khoá cuộn', st5 === false);

  check('Không có lỗi console', errs.length === 0, errs);
  console.log('\n  KẾT QUẢ: ' + pass + ' pass, ' + fail + ' fail');
  await browser.close();
})();
