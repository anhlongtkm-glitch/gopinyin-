/* Kiểm tra luồng "AI sinh câu → hỏi lưu → học tiếp đúng câu đang dở".

   Phủ các yêu cầu:
   A. Bấm tạo → hiện popup hỏi có lưu không.
   B. Chọn "Không lưu" → không ghi gì vào máy, học tạm, thoát là hết.
   C. Chọn "Lưu lại" → hỏi tên → lưu vào DB.
   D. Bộ đã lưu hiện ngay DƯỚI khung tạo prompt (màn AI sinh câu).
   E. Vào lại bộ đó → tiếp tục đúng câu đang học dở.

   Chạy: NODE_PATH="<node_modules có playwright-core>" node tests/ai_save_flow.js
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

/* Câu giả để AI "trả về" — đủ chữ Hán + pinyin + nghĩa */
const FAKE = [
  { zh: '我想去买东西。', py: 'wǒ xiǎng qù mǎi dōng xi.', vi: 'Tôi muốn đi mua đồ.' },
  { zh: '这个东西很便宜。', py: 'zhè ge dōng xi hěn pián yi.', vi: 'Món này rất rẻ.' },
  { zh: '请问多少钱？', py: 'qǐng wèn duō shao qián?', vi: 'Xin hỏi bao nhiêu tiền?' },
  { zh: '我明天再来。', py: 'wǒ míng tiān zài lái.', vi: 'Mai tôi quay lại.' },
  { zh: '谢谢你的帮助。', py: 'xiè xie nǐ de bāng zhù.', vi: 'Cảm ơn bạn đã giúp.' }
];

(async () => {
  const browser = await chromium.launch({ executablePath: CHROME, headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 950 } });
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });

  // ── Đăng ký tài khoản thật (đăng ký mới được tặng 7 ngày Pro → AI mở khoá) ──
  await page.goto(URL, { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(600);
  await page.click('#lpLoginBtn');
  await page.waitForTimeout(500);
  await page.click('[data-authtab="register"]');
  await page.waitForTimeout(300);
  await page.fill('#authName', 'Tester');
  await page.fill('#authEmail', 'tester' + Date.now() + '@local.test');
  await page.fill('#authPass', 'matkhau123');
  await page.click('#authSubmit');
  await page.waitForTimeout(1600);
  // đóng modal Pro nếu tự bật
  await page.evaluate(() => {
    const m = document.querySelector('#proModal');
    if (m) { m.classList.remove('show'); m.classList.add('hidden'); m.setAttribute('aria-hidden', 'true'); }
  });
  await page.waitForTimeout(400);

  // ── Giả lập AI: chặn fetch tới proxy, trả JSON câu mẫu ──
  await page.evaluate((fake) => {
    window.__gpAiProxy = '/__ai_stub__';
    window.__aiCalls = 0;
    const realFetch = window.fetch.bind(window);
    window.fetch = (url, opt) => {
      if (String(url).includes('__ai_stub__')) {
        window.__aiCalls++;
        return Promise.resolve(new Response(JSON.stringify({ text: JSON.stringify(fake) }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }));
      }
      return realFetch(url, opt);
    };
  }, FAKE);

  /* ═══ A. Popup hỏi lưu ═══ */
  section('A. Bấm tạo → hiện popup hỏi lưu');
  await page.evaluate(() => document.querySelector('[data-view="ai"]')?.click());
  await page.waitForTimeout(700);
  check('Vào được màn AI sinh câu', await page.evaluate(() =>
    !document.querySelector('#aiCard').classList.contains('hidden')));

  const gen = async () => {
    await page.fill('#aiPrompt', 'đi chợ mua đồ');
    // app chặn khi thiếu API key → điền key giả (fetch đã bị stub, key không dùng thật)
    await page.evaluate(() => { const k = document.querySelector('#aiKey'); if (k) k.value = 'fake-key-for-test'; });
    await page.click('#aiStartBtn');
    await page.waitForTimeout(1800);
  };
  await gen();
  const modalA = await page.evaluate(() => {
    const m = document.querySelector('#appModal');
    return {
      show: m.classList.contains('show'),
      title: (document.querySelector('#appModalTitle') || {}).textContent || '',
      msg: (document.querySelector('#appModalMsg') || {}).textContent || '',
      ok: (document.querySelector('#appModalOk') || {}).textContent || '',
      cancel: (document.querySelector('#appModalCancel') || {}).textContent || '',
      cancelHidden: document.querySelector('#appModalCancel').classList.contains('hidden')
    };
  });
  check('Popup hiện sau khi tạo câu', modalA.show, modalA.show);
  check('Tiêu đề hỏi lưu bộ câu', /lưu/i.test(modalA.title), modalA.title);
  check('Có nút "Lưu lại"', /lưu/i.test(modalA.ok), modalA.ok);
  check('Có nút "Không lưu"', /không lưu/i.test(modalA.cancel) && !modalA.cancelHidden, modalA.cancel);
  check('Popup nói rõ không lưu = học tạm', /không lưu/i.test(modalA.msg), modalA.msg.slice(0, 90));

  /* ═══ B. Chọn "Không lưu" ═══ */
  section('B. Chọn "Không lưu" → không ghi gì');
  await page.click('#appModalCancel');
  await page.waitForTimeout(1200);
  const afterNoSave = await page.evaluate(async () => {
    const app = !document.querySelector('#appCard').classList.contains('hidden');
    // đếm dataset kind==='ai' trong IndexedDB (qua localStorage thì không thấy → dùng API nội bộ không có,
    // nên kiểm tra gián tiếp: mở lại màn AI xem danh sách có thẻ nào không)
    return { inStudy: app, fileInfo: (document.querySelector('#fileInfo') || {}).textContent || '' };
  });
  check('Vẫn vào học bình thường', afterNoSave.inStudy, afterNoSave.inStudy);
  check('Nhãn ghi rõ "không lưu tiến độ"', /không lưu tiến độ/.test(afterNoSave.fileInfo), afterNoSave.fileInfo);

  await page.evaluate(() => document.querySelector('#backLibrary').click());
  await page.waitForTimeout(900);
  const listAfterNoSave = await page.evaluate(() => ({
    aiVisible: !document.querySelector('#aiCard').classList.contains('hidden'),
    cards: document.querySelectorAll('#aiSets .aiSetCard').length,
    emptyText: (document.querySelector('#aiSets') || {}).textContent || ''
  }));
  check('Quay về đúng màn AI sinh câu', listAfterNoSave.aiVisible, listAfterNoSave.aiVisible);
  check('KHÔNG có bộ nào được lưu', listAfterNoSave.cards === 0, listAfterNoSave.cards);
  check('Hiện lời nhắc chưa có bộ nào', /chưa có bộ AI/i.test(listAfterNoSave.emptyText), listAfterNoSave.emptyText.slice(0, 60));

  /* ═══ C. Chọn "Lưu lại" → đặt tên ═══ */
  section('C. Chọn "Lưu lại" → đặt tên → lưu');
  await gen();
  await page.click('#appModalOk');           // "Lưu lại"
  await page.waitForTimeout(700);
  const namePrompt = await page.evaluate(() => ({
    show: document.querySelector('#appModal').classList.contains('show'),
    title: (document.querySelector('#appModalTitle') || {}).textContent || '',
    hasInput: !document.querySelector('#appModalInput').classList.contains('hidden'),
    value: (document.querySelector('#appModalInput') || {}).value || ''
  }));
  check('Hiện ô đặt tên', namePrompt.show && namePrompt.hasInput, namePrompt);
  check('Tiêu đề là đặt tên', /tên/i.test(namePrompt.title), namePrompt.title);
  check('Gợi ý sẵn tên theo chủ đề', namePrompt.value.length > 0, namePrompt.value);

  await page.fill('#appModalInput', 'Bộ đi chợ');
  await page.click('#appModalOk');
  await page.waitForTimeout(1500);

  const afterSave = await page.evaluate(() => ({
    inStudy: !document.querySelector('#appCard').classList.contains('hidden'),
    fileInfo: (document.querySelector('#fileInfo') || {}).textContent || '',
    total: (document.querySelector('#progressText') || {}).textContent || ''
  }));
  check('Lưu xong vào học ngay', afterSave.inStudy, afterSave.inStudy);
  check('Nhãn hiện tên bộ + "đã lưu"', /Bộ đi chợ/.test(afterSave.fileInfo) && /đã lưu/.test(afterSave.fileInfo), afterSave.fileInfo);
  check('Có đủ câu AI trả về', afterSave.total.endsWith('/5'), afterSave.total);

  /* ═══ D. Bộ đã lưu hiện dưới khung tạo prompt ═══ */
  section('D. Bộ đã lưu hiện ngay dưới khung tạo prompt');
  await page.evaluate(() => document.querySelector('#backLibrary').click());
  await page.waitForTimeout(1000);
  const listD = await page.evaluate(() => {
    const cards = [...document.querySelectorAll('#aiSets .aiSetCard')];
    return {
      aiVisible: !document.querySelector('#aiCard').classList.contains('hidden'),
      n: cards.length,
      names: cards.map(c => (c.querySelector('h3') || {}).textContent || ''),
      studyBtn: cards.length ? (cards[0].querySelector('[data-aiact="study"]') || {}).textContent : '',
      // vị trí: #aiSetsWrap phải nằm SAU khung .aiBox (tức là "ngay dưới đây")
      below: (() => {
        const box = document.querySelector('#aiPane .aiBox');
        const wrap = document.querySelector('#aiSetsWrap');
        if (!box || !wrap) return false;
        return box.compareDocumentPosition(wrap) & Node.DOCUMENT_POSITION_FOLLOWING ? true : false;
      })()
    };
  });
  check('Có 1 thẻ bộ câu AI đã lưu', listD.n === 1, listD.n);
  check('Thẻ hiện đúng tên đã đặt', listD.names[0] === 'Bộ đi chợ', listD.names);
  check('Danh sách nằm DƯỚI khung tạo prompt', listD.below, listD.below);

  /* ═══ E. Học 2 câu → rời → vào lại → tiếp tục đúng câu đang dở ═══ */
  section('E. Học tiếp đúng câu đang dở');
  await page.click('#aiSets .aiSetCard [data-aiact="study"]');
  await page.waitForTimeout(1200);
  check('Mở được bộ từ danh sách', await page.evaluate(() =>
    !document.querySelector('#appCard').classList.contains('hidden')));

  // đọc câu đang hiển thị
  const readSentence = () => page.evaluate(() => {
    const el = document.querySelector('#chinese');
    return [...(el ? el.textContent : '')].filter(c => /[\u3400-\u9fff]/.test(c)).join('');
  });

  // gõ đúng 2 câu đầu
  for (let k = 0; k < 2; k++) {
    const chars = await readSentence();
    if (!chars) break;
    await page.focus('#pinyinInput');
    await page.keyboard.insertText(chars);
    await page.waitForTimeout(500);
    await page.keyboard.press('Space');       // sang câu tiếp
    await page.waitForTimeout(700);
  }
  const afterTwo = await page.evaluate(() => ({
    prog: (document.querySelector('#progressText') || {}).textContent || '',
    next: [...(document.querySelector('#chinese') || {}).textContent || ''].filter(c => /[\u3400-\u9fff]/.test(c)).join('')
  }));
  check('Đã học 2 câu', afterTwo.prog === '2/5', afterTwo.prog);

  // rời ra rồi vào lại
  await page.evaluate(() => document.querySelector('#backLibrary').click());
  await page.waitForTimeout(1000);
  const cardMeta = await page.evaluate(() => {
    const c = document.querySelector('#aiSets .aiSetCard');
    return {
      meta: c ? c.querySelector('.libraryMeta').textContent : '',
      barW: c ? (c.querySelector('.aiSetBar i') || {}).style?.width : ''
    };
  });
  check('Thẻ hiện tiến độ 2/5', /2\/5/.test(cardMeta.meta), cardMeta.meta);
  check('Thanh tiến độ ~40%', /40%/.test(cardMeta.barW || ''), cardMeta.barW);

  await page.click('#aiSets .aiSetCard [data-aiact="study"]');
  await page.waitForTimeout(1300);
  const resumed = await page.evaluate(() => ({
    prog: (document.querySelector('#progressText') || {}).textContent || '',
    zh: [...(document.querySelector('#chinese') || {}).textContent || ''].filter(c => /[\u3400-\u9fff]/.test(c)).join('')
  }));
  check('Vào lại đúng câu đang học dở (2/5, không về 0)', resumed.prog === '2/5', resumed.prog);
  check('Hiện đúng câu thứ 3 (không quay lại câu 1)', resumed.zh === FAKE[2].zh.replace(/[^\u3400-\u9fff]/g, ''), [resumed.zh, FAKE[2].zh]);

  /* ═══ G. Bộ đã lưu LỚN THÊM (AI viết tiếp) → vẫn giữ đúng tiến độ ═══ */
  section('G. Bộ đã lưu lớn thêm → không mất tiến độ');
  await page.evaluate(() => document.querySelector('#backLibrary').click());
  await page.waitForTimeout(900);
  const dsId = await page.evaluate(() => {
    const c = document.querySelector('#aiSets .aiSetCard');
    return c ? c.dataset.aiid : null;
  });
  check('Lấy được id bộ câu', !!dsId, dsId);

  // Giả lập "AI viết thêm 5 câu nữa" bằng cách ghi thẳng vào IndexedDB
  const newLen = await page.evaluate(async (id) => {
    return await new Promise((resolve, reject) => {
      const req = indexedDB.open('ChineseTypingStudioDB', 2);
      req.onsuccess = () => {
        const db = req.result;
        const tx = db.transaction('datasets', 'readwrite');
        const st = tx.objectStore('datasets');
        const g = st.get(id);
        g.onsuccess = () => {
          const ds = g.result;
          if (!ds) return reject(new Error('không thấy dataset'));
          const start = ds.rows.length;
          for (let i = 0; i < 5; i++) {
            ds.rows.push({ id: 'ai-' + (start + i), zh: '测试句子。', py: 'cè shì jù zi.', vi: 'Câu test ' + (start + i + 1), wv: [] });
          }
          ds.updatedAt = Date.now();
          st.put(ds);
          tx.oncomplete = () => { db.close(); resolve(ds.rows.length); };
        };
        g.onerror = () => reject(g.error);
      };
      req.onerror = () => reject(req.error);
    });
  }, dsId);
  check('Bộ câu đã lớn lên 10 câu', newLen === 10, newLen);

  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);
  await page.evaluate(() => document.querySelector('[data-view="ai"]')?.click());
  await page.waitForTimeout(900);
  await page.click('#aiSets .aiSetCard [data-aiact="study"]');
  await page.waitForTimeout(1300);
  const grown = await page.evaluate(() => ({
    prog: (document.querySelector('#progressText') || {}).textContent || '',
    zh: [...(document.querySelector('#chinese') || {}).textContent || ''].filter(c => /[\u3400-\u9fff]/.test(c)).join('')
  }));
  check('Tiến độ cũ 2/5 được giữ khi bộ thành 10 câu', grown.prog === '2/10', grown.prog);
  check('Vẫn đứng đúng câu thứ 3 (không xáo lại)', grown.zh === FAKE[2].zh.replace(/[^\u3400-\u9fff]/g, ''), [grown.zh, FAKE[2].zh]);

  /* ═══ F. Đổi tên + Xoá ═══ */
  section('F. Đổi tên / Xoá');
  await page.evaluate(() => document.querySelector('#backLibrary').click());
  await page.waitForTimeout(900);
  await page.click('#aiSets .aiSetCard [data-aiact="rename"]');
  await page.waitForTimeout(500);
  await page.fill('#appModalInput', 'Đi chợ (đổi tên)');
  await page.click('#appModalOk');
  await page.waitForTimeout(900);
  check('Đổi tên được', await page.evaluate(() =>
    ((document.querySelector('#aiSets .aiSetCard h3') || {}).textContent || '') === 'Đi chợ (đổi tên)'));

  await page.click('#aiSets .aiSetCard [data-aiact="del"]');
  await page.waitForTimeout(500);
  await page.click('#appModalOk');
  await page.waitForTimeout(1000);
  check('Xoá được bộ câu', await page.evaluate(() =>
    document.querySelectorAll('#aiSets .aiSetCard').length === 0));

  check('Không có lỗi console', errors.length === 0, errors.slice(0, 3));

  console.log('\n  KẾT QUẢ: ' + pass + ' pass, ' + fail + ' fail\n');
  await browser.close();
  process.exit(fail ? 1 : 0);
})();