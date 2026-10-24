/* Kiểm tra 3 sửa đổi theo yêu cầu người dùng (Request D):
   D.1 — Bộ AI đã lưu (kind==='ai') CHỈ hiện ở màn "AI sinh câu",
         KHÔNG hiện ở Luyện phát âm (picker và cả dropdown nguồn).
   D.2 — Khi ấn vào 1 mục để bắt đầu luyện phát âm, mới vào tự đọc to
         câu tiếng Trung ĐÚNG 1 LẦN.
   D.3 — Picker Luyện phát âm: bỏ hẳn mục "Bộ câu đã lưu của bạn", "📖 Bộ câu
         của bạn (đã học)" và "📖 Các câu đã làm"; tiến độ hiện NGAY TRÊN
         từng thẻ HSK (thanh tiến độ + "x/N đã luyện · k đạt").

   Chạy: NODE_PATH="<node_modules có playwright-core>" node tests/pron_picker_d.js
*/
const { chromium } = require('playwright-core');
const URL = 'http://localhost:8080/';
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';

let pass = 0, fail = 0;
function check(name, ok, detail) {
  if (ok) { pass++; console.log('  PASS  ' + name + (detail !== undefined ? '  →  ' + JSON.stringify(detail) : '')); }
  else { fail++; console.log('  FAIL  ' + name + '  →  ' + JSON.stringify(detail)); }
}
function section(t) { console.log('\n══ ' + t + ' ══'); }

const SEED = {
  aiSet: { id: 'ai:verifyD1', name: 'Bộ AI kiểm thử D1', sourceName: 'AI sinh câu', kind: 'ai',
           contentType: 'sentence', prompt: 'test', level: 1, rows: [
             { zh: '你好世界', py: 'nǐ hǎo shì jiè', vi: 'Xin chào thế giới' } ],
           createdAt: Date.now(), updatedAt: Date.now() },
  savedSet: { id: 'saved:verifyD3', name: 'Bộ thường kiểm thử D3', sourceName: 'Kho câu',
              builtin: false, rows: [
                { zh: '我爱你中国', py: 'wǒ ài nǐ zhōng guó', vi: 'Tôi yêu Trung Quốc' },
                { zh: '今天天气很好', py: 'jīn tiān tiān qì hěn hǎo', vi: 'Hôm nay trời đẹp' } ],
              createdAt: Date.now(), updatedAt: Date.now() }
};

(async () => {
  const browser = await chromium.launch({
    executablePath: CHROME, headless: true,
    args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream',
           '--autoplay-policy=no-user-gesture-required']
  });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });

  await page.goto(URL, { waitUntil: 'load' });
  await page.waitForFunction(() => !!window.__gpBridge && !!window.__pron, null, { timeout: 15000 });

  /* ── Seed: ghi 1 bộ AI + 1 bộ thường vào IndexedDB, và tiến độ phát âm
        cho bộ thường (để nó xuất hiện trong "Các câu đã làm"). ── */
  await page.evaluate((seed) => new Promise((resolve) => {
    const open = indexedDB.open('ChineseTypingStudioDB', 2);
    open.onupgradeneeded = () => {
      const d = open.result;
      if (!d.objectStoreNames.contains('datasets')) d.createObjectStore('datasets', { keyPath: 'id' });
    };
    open.onsuccess = () => {
      const db = open.result;
      const tx = db.transaction('datasets', 'readwrite');
      tx.objectStore('datasets').put(seed.aiSet);
      tx.objectStore('datasets').put(seed.savedSet);
      tx.oncomplete = () => {
        /* tiến độ phát âm cho bộ thường: key = gp:pron:v1:ds:saved:verifyD3 */
        localStorage.setItem('gp:pron:v1:ds:saved:verifyD3',
          JSON.stringify({ v: 1, byId: { 'd0:c0': { n: 1, best: 0, last: 0, good: false, at: Date.now() } },
                          index: 0, recent: [] }));
        resolve(true);
      };
    };
    open.onerror = () => resolve(false);
  }), SEED);

  /* Tải lại để app đọc lại DB + localStorage */
  await page.reload({ waitUntil: 'load' });
  await page.waitForFunction(() => !!window.__gpBridge && !!window.__pron, null, { timeout: 15000 });

  section('D.3 — Cấu trúc picker Luyện phát âm');
  /* Vào màn picker phát âm — gọi trực tiếp openLib() và đợi xong để bắt lỗi */
  const libErr = await page.evaluate(async () => {
    try { await window.__pron.openLib(); return null; }
    catch (e) { return String((e && e.stack) || e); }
  });
  check('renderLib() không ném lỗi', libErr === null, libErr);
  const struct = await page.evaluate(() => {
    const card = document.querySelector('#pronLibCard');
    const hsk = [...document.querySelectorAll('#pronLibHsk [data-psrc]')];
    return {
      hasOldSets: !!document.querySelector('#pronLibSets'),
      hasOldWrap: !!document.querySelector('#pronLibSetsWrap'),
      hasStudied: !!document.querySelector('#pronLibStudied'),
      hasDone: !!document.querySelector('#pronLibDone'),
      hasDoneWrap: !!document.querySelector('#pronLibDoneWrap'),
      hskCards: hsk.length,
      withProg: hsk.filter((c) => c.querySelector('.vocabProg')).length,
      firstMeta: hsk[0] ? (hsk[0].querySelector('.vocabMeta')?.innerText || '') : '',
      cardText: card ? card.innerText : ''
    };
  });
  check('Đã xoá mục "Bộ câu đã lưu" (#pronLibSets)', !struct.hasOldSets, struct);
  check('Đã xoá wrap cũ (#pronLibSetsWrap)', !struct.hasOldWrap, struct);
  /* ★ Request mới: bỏ hẳn "📖 Bộ câu của bạn (đã học)" và "📖 Các câu đã làm",
     tiến độ hiện NGAY TRÊN thẻ HSK. */
  check('Đã bỏ mục "Bộ câu của bạn (đã học)" (#pronLibStudied)', !struct.hasStudied, struct.hasStudied);
  check('Đã bỏ mục "Các câu đã làm" (#pronLibDone)', !struct.hasDone && !struct.hasDoneWrap, {
    done: struct.hasDone, wrap: struct.hasDoneWrap
  });
  check('Có thẻ HSK trong picker', struct.hskCards > 0, struct.hskCards);
  check('Mọi thẻ HSK đều có thanh tiến độ', struct.withProg === struct.hskCards, {
    withProg: struct.withProg, hskCards: struct.hskCards
  });
  check('Thẻ HSK có dòng trạng thái tiến độ', /Chưa luyện câu nào|\d+\/\d+/.test(struct.firstMeta), struct.firstMeta);
  check('Bộ AI không có trong picker', !struct.cardText.includes('Bộ AI kiểm thử D1'));

  section('D.1 — Bộ AI KHÔNG hiện ở Luyện phát âm');
  const aiInPicker = await page.evaluate(() => {
    const card = document.querySelector('#pronLibCard');
    return card ? card.innerText.includes('Bộ AI kiểm thử D1') : false;
  });
  check('Bộ AI không xuất hiện trong picker phát âm', !aiInPicker, aiInPicker);

  /* Dropdown nguồn trong màn luyện cũng phải loại bộ AI */
  const srcOpts = await page.evaluate(() => {
    /* mở thẳng một bộ để vào màn luyện, rồi đọc option dropdown */
    return window.__pron.start('hsk:1').then(() => {
      const sel = document.querySelector('#pronSource');
      const opts = sel ? Array.from(sel.options).map(o => o.textContent) : [];
      return opts.join(' | ');
    });
  });
  await page.waitForTimeout(500);
  const srcText = await page.evaluate(() => {
    const sel = document.querySelector('#pronSource');
    return sel ? Array.from(sel.options).map(o => o.textContent).join(' | ') : '';
  });
  check('Dropdown nguồn luyện KHÔNG chứa bộ AI', !srcText.includes('Bộ AI kiểm thử D1'), srcText);

  /* Bộ AI vẫn hiện ở màn AI sinh câu */
  await page.evaluate(async () => {
    try { if (window.renderAiSets) await window.renderAiSets(); } catch (e) { }
    window.showView('ai');
  });
  await page.waitForTimeout(300);
  const aiInAiCard = await page.evaluate(() => {
    const grid = document.querySelector('#aiSets');
    return grid ? grid.innerText.includes('Bộ AI kiểm thử D1') : false;
  });
  check('Bộ AI VẪN hiện ở màn "AI sinh câu"', aiInAiCard, aiInAiCard);

  section('D.2 — Tự đọc câu tiếng Trung khi mới vào chủ đề');
  /* Spy speechSynthesis.speak */
  await page.evaluate(() => {
    window.__tts = [];
    const orig = window.speechSynthesis.speak.bind(window.speechSynthesis);
    window.speechSynthesis.speak = (u) => { window.__tts.push(u && u.text); try { orig(u); } catch (e) {} };
  });
  /* Vào lại một bộ (fresh) để kích hoạt tự đọc */
  await page.evaluate(() => window.__pron.start('ds:saved:verifyD3'));
  await page.waitForTimeout(700);
  const tts = await page.evaluate(() => window.__tts || []);
  check('Tự gọi speak() khi mới vào chủ đề', tts.length >= 1, tts);
  check('Câu được đọc là câu tiếng Trung (có chữ Hán)', tts.some(t => t && /[一-鿿]/.test(t)), tts);

  section('Không lỗi JS');
  check('Không có pageerror / console error', errors.length === 0, errors.slice(0, 5));

  console.log('\n──────── KẾT QUẢ ────────');
  console.log('PASS=' + pass + '  FAIL=' + fail);
  await browser.close();
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error('FATAL', e); process.exit(2); });
