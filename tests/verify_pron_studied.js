/* ══════════════════════════════════════════════════════════════════
   KIỂM CHỨNG: TIẾN ĐỘ HIỆN NGAY TRÊN THẺ (thay cho "📖 Bộ câu của bạn")

   Trước đây Thư viện và Luyện phát âm có thêm 2 khối riêng:
     · 📖 Bộ câu của bạn (đã học)
     · 📖 Các câu đã làm
   Nay đã bỏ — thay vào đó mỗi thẻ cấp HSK / chủ đề tự ghi:
     thanh tiến độ + "x/N câu · y%" (Luyện gõ) hoặc
     "x/N đã luyện · k đạt" (Luyện phát âm).

   Test này kiểm:
     1) Hai khối cũ KHÔNG còn trong DOM
     2) Thẻ HSK bên Luyện gõ có thanh tiến độ + số câu đã học
     3) Thẻ HSK bên Luyện phát âm có thanh tiến độ + số câu đã luyện
     4) Sau khi học 1 câu, tiến độ trên thẻ tăng lên
     5) Bấm thẻ vẫn mở đúng bộ

   Chạy: NODE_PATH=<node_modules> node tests/verify_pron_studied.js
   ══════════════════════════════════════════════════════════════════ */
const { chromium } = require('playwright-core');
const URL = process.env.TEST_URL || 'http://localhost:8080/';
const CHROME = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';

let pass = 0, fail = 0;
const fails = [];
function check(name, ok, detail) {
  if (ok) { pass++; console.log('  PASS  ' + name + (detail !== undefined ? '  →  ' + JSON.stringify(detail) : '')); }
  else { fail++; fails.push(name); console.log('  FAIL  ' + name + '  →  ' + JSON.stringify(detail)); }
}
const txt = (s) => (s || '').replace(/\s+/g, ' ').trim();

(async () => {
  const browser = await chromium.launch({ executablePath: CHROME, headless: true });
  const page = await browser.newPage({ viewport: { width: 1366, height: 900 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });

  await page.goto(URL, { waitUntil: 'networkidle' });

  /* đăng nhập khách */
  await page.evaluate(() => document.querySelector('#wsLoginBtn')?.click());
  await page.waitForTimeout(400);
  await page.evaluate(() => document.querySelector('#authGuestBtn')?.click());
  await page.waitForTimeout(900);
  await page.evaluate(() => {
    const m = document.querySelector('#proModal');
    if (m) { m.classList.add('hidden'); m.style.display = 'none'; }
  });

  /* ── 1) HAI KHỐI CŨ ĐÃ BỊ BỎ ─────────────────────────────── */
  await page.evaluate(() => window.showView('library'));
  await page.waitForTimeout(700);
  const libGone = await page.evaluate(() => ({
    wrap: !!document.querySelector('#studiedWrap'),
    grid: !!document.querySelector('#studiedSets'),
    txtHas: /Bộ câu của bạn/.test(document.querySelector('#libraryCard')?.innerText || '')
  }));
  check('Luyện gõ: đã bỏ #studiedWrap', libGone.wrap === false, libGone);
  check('Luyện gõ: đã bỏ #studiedSets', libGone.grid === false, libGone);
  check('Luyện gõ: không còn chữ "Bộ câu của bạn"', libGone.txtHas === false, libGone);

  /* ── 2) THẺ HSK BÊN LUYỆN GÕ CÓ TIẾN ĐỘ ─────────────────── */
  const libCards = await page.evaluate(() => {
    const cards = [...document.querySelectorAll('#vocabList [data-vsrc]')];
    const hsk1 = document.querySelector('#vocabList [data-vsrc="hsk1"]');
    return {
      n: cards.length,
      withBar: cards.filter((c) => c.querySelector('.vocabProg')).length,
      hsk1Meta: hsk1 ? (hsk1.querySelector('.vocabMeta')?.innerText || '').replace(/\s+/g, ' ').trim() : '',
      hsk1Width: hsk1 ? (hsk1.querySelector('.vocabProg i')?.style.width || '') : '',
      hsk1HasBar: !!(hsk1 && hsk1.querySelector('.vocabProg')),
      hsk1Title: hsk1 ? (hsk1.querySelector('.vocabCard-title')?.innerText || '').replace(/\s+/g, ' ').trim() : ''
    };
  });
  check('Luyện gõ: có danh sách thẻ HSK', libCards.n > 0, libCards.n);
  check('Luyện gõ: thẻ HSK 1 có thanh tiến độ', libCards.hsk1HasBar === true, libCards);
  check('Luyện gõ: thẻ chưa học để trống (không chữ thừa)', libCards.hsk1Meta === '' && libCards.hsk1Width === '0%', libCards);

  /* ── 3) THẺ HSK BÊN LUYỆN PHÁT ÂM CÓ TIẾN ĐỘ ────────────── */
  await page.evaluate(() => window.showView('pron'));
  await page.waitForTimeout(900);
  const pronCards = await page.evaluate(() => {
    const cards = [...document.querySelectorAll('#pronLibHsk [data-psrc]')];
    const c1 = document.querySelector('#pronLibHsk [data-psrc="hsk:hsk1"]');
    return {
      n: cards.length,
      withBar: cards.filter((c) => c.querySelector('.vocabProg')).length,
      meta1: c1 ? (c1.querySelector('.vocabMeta')?.innerText || '').replace(/\s+/g, ' ').trim() : '',
      goneStudied: !document.querySelector('#pronLibStudied'),
      goneDone: !document.querySelector('#pronLibDone') && !document.querySelector('#pronLibDoneWrap')
    };
  });
  check('Phát âm: đã bỏ #pronLibStudied', pronCards.goneStudied, pronCards.goneStudied);
  check('Phát âm: đã bỏ #pronLibDone/#pronLibDoneWrap', pronCards.goneDone, pronCards.goneDone);
  check('Phát âm: đủ 9 thẻ HSK', pronCards.n === 9, pronCards.n);
  check('Phát âm: mọi thẻ HSK có thanh tiến độ', pronCards.withBar === pronCards.n, {
    withBar: pronCards.withBar, n: pronCards.n
  });
  check('Phát âm: thẻ HSK 1 ghi "Chưa luyện câu nào"', /Chưa luyện câu nào/.test(pronCards.meta1), pronCards.meta1);

  /* ── 4) HỌC 1 CÂU BÊN LUYỆN GÕ → TIẾN ĐỘ TRÊN THẺ TĂNG ──── */
  await page.evaluate(() => window.showView('library'));
  await page.waitForTimeout(600);
  await page.evaluate(() => document.querySelector('#vocabList [data-vsrc="hsk1"]')?.click());
  await page.waitForTimeout(1400);

  const answer = await page.evaluate(() => {
    const norm = (s) => String(s || '').toLowerCase().replace(/[\s.,!?…"'“”‘’()\-—:;]+/g, '');
    const vi = norm(document.querySelector('#vietnamese')?.innerText);
    const han = norm(document.querySelector('#chinese')?.innerText);
    const rows = (window.__gpBridge.hskData().hsk1 || []);
    if (han) { const hit = rows.find((r) => norm(r[0]) === han); if (hit) return { zh: hit[0], vi: hit[2], by: 'han' }; }
    if (vi) { const hit = rows.find((r) => norm(r[2]) === vi); if (hit) return { zh: hit[0], vi: hit[2], by: 'vi' }; }
    return { zh: null, vi: vi, han: han, by: 'none' };
  });
  check('Xác định được câu đang hiện', !!answer.zh, { by: answer.by, vi: (answer.vi || '').slice(0, 40) });

  let typedOk = false;
  if (answer && answer.zh) {
    const inp = page.locator('#pinyinInput');
    await inp.click();
    await inp.type(answer.zh, { delay: 30 });
    await page.waitForTimeout(400);
    const okFb = await page.evaluate(() => /Chính xác/.test(document.querySelector('#feedback')?.innerText || ''));
    await inp.press('Space');
    await page.waitForTimeout(700);
    const moved = await page.evaluate((vi) => (document.querySelector('#vietnamese')?.innerText || '').trim() !== vi, (answer.vi || '').trim());
    typedOk = okFb && moved;
    if (!typedOk) console.log('     · feedback đúng=' + okFb + ' · đã sang câu mới=' + moved);
  }
  check('Gõ đúng 1 câu + sang câu tiếp', typedOk);

  /* quay về thư viện → thẻ HSK 1 phải nhích tiến độ */
  await page.click('#appBackBtn');
  await page.waitForTimeout(900);
  const after = await page.evaluate(() => {
    const c1 = document.querySelector('#vocabList [data-vsrc="hsk1"]');
    return {
      meta: c1 ? (c1.querySelector('.vocabMeta')?.innerText || '').replace(/\s+/g, ' ').trim() : '',
      width: c1 ? (c1.querySelector('.vocabProg i')?.style.width || '') : '',
      lib: !document.querySelector('#libraryCard')?.classList.contains('hidden')
    };
  });
  check('Quay lại Thư viện sau khi học', after.lib === true);
  check('Thẻ HSK 1 nhích tiến độ "1/N … %"', /^1\/\d+/.test(after.meta), after.meta);
  check('Thanh tiến độ có bề rộng > 0', !!after.width && after.width !== '0%', after.width);

  /* ── 5) LUYỆN PHÁT ÂM: thẻ HSK 1 hiện "Đã gõ 1/N · chưa luyện nói" ── */
  await page.evaluate(() => window.showView('pron'));
  await page.waitForTimeout(900);
  const pronAfter = await page.evaluate(() => {
    const c1 = document.querySelector('#pronLibHsk [data-psrc="hsk:hsk1"]');
    return {
      meta: c1 ? (c1.querySelector('.vocabMeta')?.innerText || '').replace(/\s+/g, ' ').trim() : '',
      isType: !!(c1 && c1.querySelector('.vocabProg.isType')),
      width: c1 ? (c1.querySelector('.vocabProg i')?.style.width || '') : ''
    };
  });
  check('Phát âm: thẻ HSK 1 hiện tiến độ gõ đã có', /Đã gõ 1\/\d+/.test(pronAfter.meta), pronAfter.meta);
  check('Phát âm: thanh xám (isType) khi chỉ mới gõ', pronAfter.isType === true && pronAfter.width !== '0%', pronAfter);

  /* ── 6) BẤM THẺ HSK 1 → VÀO MÀN LUYỆN PHÁT ÂM ───────────── */
  await page.evaluate(() => document.querySelector('#pronLibHsk [data-psrc="hsk:hsk1"]').click());
  await page.waitForTimeout(1400);
  const inStudy = await page.evaluate(() => ({
    pronCard: !document.querySelector('#pronCard')?.classList.contains('hidden'),
    libCard: !document.querySelector('#pronLibCard')?.classList.contains('hidden'),
    complete: !document.querySelector('#pronComplete')?.classList.contains('hidden'),
    hanzi: (document.querySelector('#pronHanzi')?.innerText || '').replace(/\s+/g, ' ').trim()
  }));
  check('Bấm thẻ HSK → mở màn luyện phát âm', inStudy.pronCard === true && inStudy.libCard === false, inStudy);
  check('Màn luyện có câu để nói (không rỗng)', !!inStudy.hanzi && !inStudy.complete, inStudy.hanzi.slice(0, 24));

  check('Không có lỗi console', errors.length === 0, errors);

  /* ảnh chụp màn chọn bộ câu */
  await page.evaluate(() => window.showView('pron'));
  await page.waitForTimeout(700);
  const shot = require('node:path').resolve(__dirname, '../.cache/test-run/shot_pron_studied.png');
  require('node:fs').mkdirSync(require('node:path').dirname(shot), { recursive: true });
  const card = await page.$('#pronLibCard');
  if (card) await card.screenshot({ path: shot });
  console.log('\n  Ảnh: ' + shot);

  console.log('\n  ── KẾT QUẢ: ' + pass + ' PASS · ' + fail + ' FAIL ──');
  if (fail) console.log('  Lỗi: ' + fails.join(' | '));
  await browser.close();
  process.exit(fail ? 1 : 0);
})();
