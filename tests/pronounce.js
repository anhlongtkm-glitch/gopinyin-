/* Kiểm tra tính năng LUYỆN PHÁT ÂM.

   Phủ:
   A. Điều hướng + tương thích: mục mới mở được, Luyện gõ vẫn chạy, dùng chung kho câu.
   B. Bộ chấm điểm (logic thuần): khớp hoàn toàn / thiếu / thừa / nhận nhầm / rỗng / tin cậy thấp.
   C. Không giả điểm phát âm: chỉ trả "độ khớp nội dung", có ghi rõ là đánh giá sơ bộ.
   D. Luồng micro thật: xin quyền → ghi âm → dừng → chấm → hiện kết quả + tô màu từng chữ.
   E. Lưu tiến độ: nói lại KHÔNG tăng số câu đã luyện; lượt nói vẫn tăng.
   F. Điều khiển bài học: nghe mẫu, câu trước/sau, bỏ qua, ẩn/hiện pinyin.
   G. Lỗi: từ chối quyền micro → thông báo rõ, không chấm bừa.

   Chạy: NODE_PATH="<node_modules có playwright-core>" node tests/pronounce.js
*/
const { chromium } = require('playwright-core');
const URL = process.env.TEST_URL || 'http://localhost:8080/';
const CHROME = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';

let pass = 0, fail = 0;
function check(name, ok, detail) {
  if (ok) { pass++; console.log('  PASS  ' + name + (detail !== undefined ? '  →  ' + JSON.stringify(detail) : '')); }
  else { fail++; console.log('  FAIL  ' + name + '  →  ' + JSON.stringify(detail)); }
}
function section(t) { console.log('\n══ ' + t + ' ══'); }

(async () => {
  const browser = await chromium.launch({
    executablePath: CHROME,
    headless: true,
    args: [
      '--use-fake-device-for-media-stream',
      '--use-fake-ui-for-media-stream',
      '--autoplay-policy=no-user-gesture-required'
    ]
  });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });

  /* Giả lập nhận dạng giọng nói: trả về đúng chuỗi ta muốn */
  await page.addInitScript(() => {
    /* Đếm số lần xin quyền micro — phải chỉ 1 lần cho cả phiên luyện */
    window.__gumCalls = 0;
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      const gum = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
      navigator.mediaDevices.getUserMedia = function (c) { window.__gumCalls++; return gum(c); };
    }
    window.__fakeTranscript = '';
    window.__fakeConf = 0.92;
    window.__fakeError = '';
    function FakeSR() {
      this.lang = ''; this.continuous = false; this.interimResults = false; this.maxAlternatives = 1;
    }
    FakeSR.prototype.start = function () {
      const self = this;
      self.onstart?.();
      setTimeout(function () {
        if (window.__fakeError) {
          if (self.onerror) self.onerror({ error: window.__fakeError });
          if (self.onend) self.onend();
          return;
        }
        if (self.onresult) {
          const alt = { transcript: window.__fakeTranscript, confidence: window.__fakeConf };
          const arr = [alt]; arr.isFinal = true;
          self.onresult({ resultIndex: 0, results: [arr] });
        }
      }, 120);
    };
    FakeSR.prototype.stop = function () { const s = this; setTimeout(function () { if (s.onend) s.onend(); }, 30); };
    FakeSR.prototype.abort = function () { this.onresult = null; this.onend = null; };
    window.SpeechRecognition = FakeSR;
    window.webkitSpeechRecognition = FakeSR;
  });

  await page.goto(URL, { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(600);
  await page.click('#wsLoginBtn'); await page.waitForTimeout(400);
  await page.click('[data-authtab="register"]'); await page.waitForTimeout(250);
  await page.fill('#authName', 'PronTester');
  await page.fill('#authEmail', 'pr' + Date.now() + '@l.test');
  await page.fill('#authPass', 'matkhau123');
  await page.click('#authSubmit'); await page.waitForTimeout(1600);
  await page.evaluate(() => {
    const m = document.querySelector('#proModal');
    if (m) { m.classList.remove('show'); m.classList.add('hidden'); }
  });

  /* ═══ A. Điều hướng + tương thích ═══ */
  section('A. Mục mới + tương thích Luyện gõ');
  const navHas = await page.evaluate(() => !!document.querySelector('[data-view="practice"]'));
  check('Sidebar có mục Luyện tập chung', navHas, navHas);

  await page.evaluate(() => window.showView('pron'));
  await page.waitForTimeout(900);
  /* ★ Mới: vào mục là màn CHỌN BỘ CÂU trước (giống Thư viện bên Luyện gõ),
     không nhảy thẳng vào một bộ câu ngẫu nhiên. */
  const picker = await page.evaluate(() => ({
    visible: !document.querySelector('#pronLibCard').classList.contains('hidden'),
    practiceHidden: document.querySelector('#pronCard').classList.contains('hidden'),
    cards: document.querySelectorAll('#pronLibHsk [data-psrc]').length,
    hasContinue: !!document.querySelector('#pronLibContinue'),
    title: (document.querySelector('#wsViewTitle') || {}).textContent || ''
  }));
  check('Vào Luyện phát âm → màn chọn bộ câu trước', picker.visible && picker.practiceHidden, picker);
  check('Có thẻ chọn cấp HSK', picker.cards >= 3, picker.cards);
  check('Đã bỏ nút "Học tiếp bộ đang mở" (không còn #pronLibContinue)', !picker.hasContinue, picker.hasContinue);
  check('Tiêu đề mục vẫn là "Luyện phát âm"', /phát âm/i.test(picker.title), picker.title);

  /* chọn HSK 1 → mới vào màn luyện */
  await page.evaluate(() => {
    const b = document.querySelector('#pronLibHsk [data-psrc="hsk:hsk1"]') || document.querySelector('#pronLibHsk [data-psrc]');
    b.click();
  });
  await page.waitForTimeout(1000);
  const opened = await page.evaluate(() => ({
    visible: !document.querySelector('#pronCard').classList.contains('hidden'),
    pickerHidden: document.querySelector('#pronLibCard').classList.contains('hidden'),
    title: (document.querySelector('#wsViewTitle') || {}).textContent || '',
    hasMic: !!document.querySelector('#pronMicBtn'),
    stats: [...document.querySelectorAll('#pronCard .stat span')].map(s => s.textContent),
    srcOptions: document.querySelectorAll('#pronSource option').length,
    info: (document.querySelector('#pronInfo') || {}).textContent || '',
    source: document.querySelector('#pronSource').value,
    hasBack: !!document.querySelector('#pronBackBtn')
  }));
  check('Chọn cấp → mở màn luyện', opened.visible && opened.pickerHidden, { vao: opened.visible, anThuVien: opened.pickerHidden });
  check('Đúng bộ vừa chọn', opened.source === 'hsk:hsk1', opened.source);
  check('Có nút quay lại chọn bộ khác', opened.hasBack, opened.hasBack);
  check('Tiêu đề đổi đúng', /phát âm/i.test(opened.title), opened.title);
  check('Có nút micro', opened.hasMic, opened.hasMic);
  check('Ba thống kê chi tiết được gom trong Tùy chọn', opened.stats.length === 3 && opened.stats.includes('Phát âm tốt') && opened.stats.includes('Lượt nói'), opened.stats);
  check('Có nguồn dữ liệu để chọn', opened.srcOptions >= 3, opened.srcOptions);
  check('Dùng chung kho câu (hiện số câu)', /\d+\s*câu/.test(opened.info), opened.info);

  /* Luyện gõ vẫn hoạt động */
  await page.evaluate(() => document.querySelector('[data-view="practice"]').click());
  await page.waitForTimeout(700);
  const libOk = await page.evaluate(() => !document.querySelector('#libraryCard').classList.contains('hidden'));
  check('Chuyển lại Luyện gõ vẫn bình thường', libOk, libOk);
  await page.evaluate(() => window.showView('pron'));
  await page.waitForTimeout(700);
  /* quay lại thì vẫn là màn chọn bộ — chọn lại HSK 1 để vào luyện */
  await page.evaluate(() => {
    const b = document.querySelector('#pronLibHsk [data-psrc="hsk:hsk1"]') || document.querySelector('#pronLibHsk [data-psrc]');
    b.click();
  });
  await page.waitForTimeout(900);

  /* ═══ B. Logic chấm điểm ═══ */
  section('B. Bộ chấm điểm (căn chỉnh + phân loại)');
  const cases = await page.evaluate(() => {
    const P = window.__pron;
    const item = { zh: '我想学外语', py: 'wǒ xiǎng xué wài yǔ', vi: 'Tôi muốn học ngoại ngữ' };
    const out = {};
    out.perfect = P._assess(item, '我想学外语', 0.95);
    out.missing = P._assess(item, '我想学语', 0.95);
    out.extra = P._assess(item, '我想学外语了', 0.95);
    out.wrong = P._assess(item, '我想学外面', 0.95);
    out.empty = P._assess(item, '', 0.9);
    out.lowConf = P._assess(item, '我想学外面', 0.3);
    return {
      perfect: { score: out.perfect.score, matched: out.perfect.matched, total: out.perfect.total, kind: out.perfect.scoreKind, statuses: out.perfect.chars.map(c => c.status) },
      missing: { score: out.missing.score, matched: out.missing.matched, errors: out.missing.errors.map(e => e.type), statuses: out.missing.chars.map(c => c.status) },
      extra: { score: out.extra.score, extra: out.extra.extra, errors: out.extra.errors.map(e => e.type) },
      wrong: { score: out.wrong.score, statuses: out.wrong.chars.map(c => c.status), got: out.wrong.chars.map(c => c.got) },
      empty: { score: out.empty.score, reliable: out.empty.reliable },
      lowConf: { statuses: out.lowConf.chars.map(c => c.status), reliable: out.lowConf.reliable }
    };
  });

  check('Khớp hoàn toàn → 100 điểm', cases.perfect.score === 100, cases.perfect.score);
  check('Khớp hoàn toàn → mọi chữ "good"', cases.perfect.statuses.every(s => s === 'good'), cases.perfect.statuses);
  check('Khớp hoàn toàn → đủ số chữ', cases.perfect.matched === 5 && cases.perfect.total === 5, cases.perfect.matched + '/' + cases.perfect.total);
  check('Thiếu 1 chữ → điểm < 100 và có lỗi "missing"', cases.missing.score < 100 && cases.missing.errors.includes('missing'), cases.missing);
  check('Thừa chữ → có lỗi "extra"', cases.extra.errors.includes('extra') && cases.extra.extra === 1, cases.extra);
  check('Nhận nhầm chữ → chữ đó "bad" và giữ chữ đã nghe', cases.wrong.statuses.filter(s => s === 'bad').length === 1 && cases.wrong.got.includes('面'), cases.wrong);
  check('Không nói gì → 0 điểm, đánh dấu không đủ dữ liệu', cases.empty.score === 0 && cases.empty.reliable === false, cases.empty);
  check('Tin cậy thấp → KHÔNG kết luận chữ sai (unknown)', cases.lowConf.statuses.every(s => s !== 'bad') && cases.lowConf.reliable === false, cases.lowConf);
  check('Chấm xong KHÔNG gọi là điểm phát âm', cases.perfect.kind === 'content', cases.perfect.kind);

  /* ═══ C. Không giả điểm phát âm ═══ */
  section('C. Trung thực về điểm số');
  const honest = await page.evaluate(() => ({
    serverConfigured: !!(window.__pron._state.serverAssess && window.__pron._state.serverAssess.ok)
  }));
  check('Chưa cấu hình dịch vụ chấm → không có điểm phát âm giả', honest.serverConfigured === false, honest);

  /* ═══ D. Luồng micro → chấm điểm ═══ */
  section('D. Nói bằng micro → có kết quả');
  const first = await page.evaluate(() => {
    const S = window.__pron._state;
    const it = S.items[S.order[S.index]];
    return { zh: it.zh, py: it.py };
  });
  await page.evaluate((zh) => { window.__fakeTranscript = zh; }, first.zh);

  await page.click('#pronMicBtn');
  await page.waitForTimeout(700);
  const recState = await page.evaluate(() => ({
    phase: window.__pron._state.phase,
    label: (document.querySelector('.pronMicTxt') || {}).textContent || '',
    timerShown: !document.querySelector('#pronTimer').classList.contains('hidden'),
    isRec: document.querySelector('#pronMicBtn').classList.contains('is-rec')
  }));
  check('Bấm micro → vào trạng thái ghi âm', recState.phase === 'recording', recState.phase);
  check('Nút đổi nhãn "Đang nghe"', /Đang nghe/i.test(recState.label), recState.label);
  check('Hiện đồng hồ ghi âm', recState.timerShown, recState.timerShown);
  check('Nút micro có hiệu ứng ghi âm', recState.isRec, recState.isRec);

  await page.click('#pronMicBtn');           // dừng
  await page.waitForTimeout(3000);
  const res1 = await page.evaluate(() => {
    const S = window.__pron._state;
    const host = document.querySelector('#pronResult');
    return {
      phase: S.phase,
      hidden: host.classList.contains('hidden'),
      score: S.result && S.result.score,
      kind: S.result && S.result.scoreKind,
      hasRing: !!host.querySelector('.pronRing'),
      charsGood: document.querySelectorAll('#pronHanzi .pronChar.st-good').length,
      charsAll: document.querySelectorAll('#pronHanzi .pronChar:not(.is-punct)').length,
      honest: (host.querySelector('.pronHonest') || {}).textContent || '',
      legend: document.querySelectorAll('#pronResult .pronLegend i').length,
      played: !document.querySelector('#pronPlayMineBtn').disabled
    };
  });
  check('Dừng ghi âm → có kết quả', res1.hidden === false && res1.phase === 'result', { hidden: res1.hidden, phase: res1.phase });
  check('Có vòng điểm', res1.hasRing, res1.hasRing);
  check('Nói đúng câu mẫu → 100', res1.score === 100, res1.score);
  check('Tô xanh toàn bộ chữ Hán', res1.charsGood === res1.charsAll && res1.charsAll > 0, res1.charsGood + '/' + res1.charsAll);
  check('Có chú thích đây là đánh giá sơ bộ', /sơ bộ/i.test(res1.honest), res1.honest.slice(0, 60));
  check('Có chú giải màu (không chỉ dựa vào màu)', res1.legend >= 4, res1.legend);
  check('Bật được "nghe bản ghi của tôi"', res1.played, res1.played);

  /* ═══ E. Lưu tiến độ: nói lại không tăng số câu ═══ */
  section('E. Nói lại không làm tăng số câu đã luyện');
  const before = await page.evaluate(() => ({
    prog: (document.querySelector('#pronProg') || {}).textContent,
    tries: (document.querySelector('#pronTries') || {}).textContent,
    good: (document.querySelector('#pronGood') || {}).textContent
  }));
  await page.click('#pronRetryBtn');
  await page.waitForTimeout(400);
  await page.click('#pronMicBtn');
  await page.waitForTimeout(700);
  await page.click('#pronMicBtn');
  await page.waitForTimeout(3200);
  const after = await page.evaluate(() => ({
    prog: (document.querySelector('#pronProg') || {}).textContent,
    tries: (document.querySelector('#pronTries') || {}).textContent,
    good: (document.querySelector('#pronGood') || {}).textContent,
    rec: (function () {
      const S = window.__pron._state;
      const id = S.items[S.order[S.index]].id;
      return S.progress.byId[id];
    })()
  }));
  check('Số câu đã luyện KHÔNG tăng khi nói lại', before.prog === after.prog, { truoc: before.prog, sau: after.prog });
  check('Số lượt nói TĂNG', Number(after.tries) === Number(before.tries) + 1, { truoc: before.tries, sau: after.tries });
  check('Lịch sử ghi nhận 2 lượt cho cùng 1 câu', after.rec && after.rec.n === 2, after.rec);

  /* Tiến độ được lưu thật vào localStorage */
  const persisted = await page.evaluate(() => {
    const cacheKey = Object.keys(localStorage).find(k => k.startsWith('gp:account-cache:'));
    const records = Object.values(JSON.parse(localStorage.getItem(cacheKey) || '{}'));
    const rec = records.find(r => r.kind === 'kv' && r.record_id.startsWith('gp:pron:v1:') && !r.deleted);
    return rec ? { key: rec.record_id, hasRec: Object.keys(JSON.parse(rec.payload).byId).length } : null;
  });
  check('Tiến độ lưu vào localStorage', !!persisted && persisted.hasRec > 0, persisted);

  /* ═══ F. Điều khiển bài học ═══ */
  section('F. Điều khiển bài học');
  const nav = await page.evaluate(() => ({
    idx: window.__pron._state.index,
    total: window.__pron._state.order.length
  }));
  await page.click('#pronNextBtn');
  await page.waitForTimeout(500);
  const afterNext = await page.evaluate(() => window.__pron._state.index);
  check('Câu tiếp → sang câu sau', afterNext === nav.idx + 1, { truoc: nav.idx, sau: afterNext });

  await page.click('#pronPrevBtn');
  await page.waitForTimeout(500);
  check('Câu trước → quay lại', await page.evaluate(() => window.__pron._state.index) === nav.idx);

  await page.click('#pronOptionsBtn');
  await page.click('#pronSettings [data-settings-tab="display"]');
  await page.click('#pronPyToggle');
  await page.waitForTimeout(300);
  const pyHidden = await page.evaluate(() => [...document.querySelectorAll('#pronHanzi .pronCharPy')].every(element => getComputedStyle(element).visibility === 'hidden' || getComputedStyle(element).display === 'none'));
  check('Ẩn được pinyin', pyHidden, pyHidden);
  await page.click('#pronPyToggle');
  await page.waitForTimeout(300);
  check('Hiện lại pinyin', await page.evaluate(() => [...document.querySelectorAll('#pronHanzi .pronCharPy')].some(element => getComputedStyle(element).visibility !== 'hidden' && getComputedStyle(element).display !== 'none')));
  await page.keyboard.press('Escape');

  /* Bỏ qua phải thử trên câu CHƯA luyện (câu đã luyện rồi thì giữ nguyên kết quả) */
  await page.click('#pronNextBtn');
  await page.waitForTimeout(450);
  const skipTarget = await page.evaluate(() => {
    const S = window.__pron._state;
    return { id: S.items[S.order[S.index]].id, idx: S.index };
  });
  await page.click('#pronSkipBtn');
  await page.waitForTimeout(500);
  const skipped = await page.evaluate((id) => {
    const S = window.__pron._state;
    const r = S.progress.byId[id];
    return { idx: S.index, skipped: !!(r && r.skipped), good: !!(r && r.good) };
  }, skipTarget.id);
  check('Bỏ qua → sang câu tiếp', skipped.idx === skipTarget.idx + 1, skipped.idx);
  check('Bỏ qua KHÔNG tính là câu tốt', skipped.good === false, skipped);

  /* Bấm vào chữ Hán → popover chi tiết */
  await page.click('#pronHanzi .pronChar');
  await page.waitForTimeout(400);
  const detail = await page.evaluate(() => {
    const d = document.querySelector('#pronDetail');
    return {
      open: !d.classList.contains('hidden'),
      hasPinyin: !!d.querySelector('.pronDetailPy'),
      hasTone: /Thanh/i.test((d.querySelector('.pronDetailTone') || {}).textContent || ''),
      hasSay: !!d.querySelector('[data-pd="say"]')
    };
  });
  check('Bấm chữ Hán → mở chi tiết', detail.open, detail.open);
  check('Chi tiết có pinyin + hướng dẫn thanh điệu', detail.hasPinyin && detail.hasTone, detail);
  check('Chi tiết có nút nghe chữ đó', detail.hasSay, detail.hasSay);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);

  /* ═══ H. Micro chỉ xin quyền 1 lần + màn học dễ đọc, cuộn được + lỗi hiển thị ═══ */
  section('H. Không xin lại quyền micro + màn học dễ đọc + sửa lỗi hiển thị');

  /* (1) Stream được giữ lại giữa các câu → không gọi getUserMedia lần nữa */
  const gum = await page.evaluate(() => ({ calls: window.__gumCalls, alive: window.__pron._state.stream ? window.__pron._state.stream.active : false }));
  check('Chỉ xin quyền micro 1 lần cho cả phiên', gum.calls <= 1, gum);
  check('Stream micro vẫn mở sau khi sang câu', gum.alive === true, gum.alive);

  /* (2) Nói tiếp 1 câu nữa rồi kiểm tra lại: vẫn không xin quyền lại */
  const item2 = await page.evaluate(() => {
    const S = window.__pron._state;
    return S.items[S.order[S.index]].zh;
  });
  await page.evaluate((zh) => { window.__fakeTranscript = zh; }, item2);
  await page.click('#pronMicBtn');
  await page.waitForTimeout(500);
  await page.click('#pronMicBtn');
  await page.waitForTimeout(2600);
  const gum2 = await page.evaluate(() => window.__gumCalls);
  check('Sang câu mới KHÔNG xin lại quyền micro', gum2 <= 1, gum2);

  /* (3) Màn học giữ kích thước điều khiển; nội dung dài được cuộn thay vì ép nhỏ. */
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.waitForTimeout(500);
  const fit = await page.evaluate(() => {
    const vh = window.innerHeight;
    const r = (sel) => { const e = document.querySelector(sel); return e ? e.getBoundingClientRect() : null; };
    const next = r('#pronNextBtn'), res = r('#pronResult'), card = r('#pronCard');
    return {
      vh,
      pageScroll: document.documentElement.scrollHeight - vh,
      bodyOverflow: getComputedStyle(document.body).overflowY,
      shellOverflow: getComputedStyle(document.querySelector('#pronCard')).overflowY,
      nextHeight: next ? next.height : 0,
      nextFont: parseFloat(getComputedStyle(document.querySelector('#pronNextBtn')).fontSize),
      nextBottom: next ? Math.round(next.bottom) : null,
      resBottom: res && res.height > 0 ? Math.round(res.bottom) : null,
      cardBottom: card ? Math.round(card.bottom) : null
    };
  });
  check('Nội dung dài có thể cuộn, không bị khóa hoặc cắt', fit.bodyOverflow !== 'hidden' && fit.shellOverflow !== 'hidden', { cuon:fit.pageScroll, body:fit.bodyOverflow, shell:fit.shellOverflow });
  await page.locator('#pronNextBtn').scrollIntoViewIfNeeded();
  const nextVisible = await page.locator('#pronNextBtn').evaluate(el => {
    const r = el.getBoundingClientRect();
    return r.top >= 0 && r.bottom <= window.innerHeight;
  });
  check('Nút "Câu tiếp" dễ đọc, đủ lớn và cuộn tới được', nextVisible && fit.nextHeight >= 44 && fit.nextFont >= 14, { cao:fit.nextHeight, chu:fit.nextFont, nhinThay:nextVisible });
  // The approved study shell allows long content to scroll; measure after revealing the result.
  await page.locator('#pronResult').scrollIntoViewIfNeeded();
  const resultVisible = await page.locator('#pronResult').evaluate(el => {
    const rect = el.getBoundingClientRect();
    return rect.top >= 0 && rect.bottom <= innerHeight;
  });
  check('Bảng kết quả cuộn vào vùng nhìn thấy đầy đủ', resultVisible, resultVisible);

  /* (4) Kết quả là CỘT PHẢI (desktop), không đẩy nội dung xuống dưới */
  const cols = await page.evaluate(() => {
    const a = document.querySelector('#pronArea .pronBox').getBoundingClientRect();
    const b = document.querySelector('#pronResult').getBoundingClientRect();
    return { leftX: Math.round(a.left), rightX: Math.round(b.left), sameRow: Math.abs(a.top - b.top) < 40 };
  });
  check('Kết quả nằm cạnh thẻ câu (2 cột)', cols.rightX > cols.leftX + 200 && cols.sameRow, cols);

  /* (5) Lỗi hiển thị: pinyin không bị gạch chân chồng lên; dấu câu đúng hàng */
  const layout = await page.evaluate(() => {
    const wrap = document.createElement('div');
    wrap.className = 'hanzi pronHanzi';
    wrap.style.cssText = 'position:absolute;left:-9999px;top:0;width:900px';
    wrap.innerHTML = window.__pron._hanziHtml('早上好，今天挺早啊。');
    document.body.appendChild(wrap);
    const chars = [...wrap.querySelectorAll('.pronChar:not(.is-punct)')];
    let overlap = 0;
    for (const c of chars) {
      const g = c.querySelector('.pronCharGlyph').getBoundingClientRect();
      const p = c.querySelector('.pronCharPy').getBoundingClientRect();
      if (p.height > 0 && p.top < g.bottom - 1) overlap++;
    }
    const punct = wrap.querySelector('.pronChar.is-punct');
    let align = null, dotVis = null, underline = '';
    if (punct && chars[0]) {
      const pg = punct.querySelector('.pronCharGlyph').getBoundingClientRect();
      const cg = chars[0].querySelector('.pronCharGlyph').getBoundingClientRect();
      align = Math.round(pg.bottom - cg.bottom);
      dotVis = getComputedStyle(punct.querySelector('.pronCharDot')).visibility;
    }
    if (chars[0]) underline = getComputedStyle(chars[0].querySelector('.pronCharGlyph')).textDecorationLine;
    wrap.remove();
    return { overlap, align, dotVis, underline, n: chars.length };
  });
  check('Pinyin không bị gạch chân đè lên', layout.overlap === 0, layout.overlap);
  check('Chữ Hán không dùng gạch chân lượn sóng', layout.underline === 'none', layout.underline);
  check('Dấu câu đứng đúng hàng chân chữ', layout.align !== null && Math.abs(layout.align) <= 2, layout.align);
  check('Dấu câu không có chấm trạng thái', layout.dotVis === 'hidden', layout.dotVis);

  /* (6) Nút "Bộ khác" quay lại màn chọn */
  await page.click('#pronBackBtn');
  await page.waitForTimeout(600);
  const back = await page.evaluate(() => ({
    picker: !document.querySelector('#libraryCard').classList.contains('hidden'),
    practice: document.querySelector('#pronCard').classList.contains('hidden'),
    fit: document.body.classList.contains('pronFit'),
    mic: window.__pron._state.stream ? window.__pron._state.stream.active : false
  }));
  check('Nút "Bộ khác" → về màn chọn bộ câu', back.picker && back.practice, back);
  check('Rời màn luyện → tắt micro', back.mic === false, back.mic);

  /* ═══ G. Lỗi quyền micro ═══ */
  section('G. Từ chối quyền micro');
  /* Nhóm H vừa quay về màn chọn bộ → vào lại màn luyện trước khi thử micro */
  await page.evaluate(() => {
    const b = document.querySelector('#pronLibHsk [data-psrc="hsk:hsk1"]') || document.querySelector('#pronLibHsk [data-psrc]');
    b.click();
  });
  await page.waitForTimeout(800);
  await page.evaluate(() => {
    navigator.mediaDevices.getUserMedia = () => {
      const e = new Error('denied'); e.name = 'NotAllowedError'; return Promise.reject(e);
    };
    const S = window.__pron._state;
    S.stream = null;
  });
  await page.click('#pronMicBtn');
  await page.waitForTimeout(900);
  const denied = await page.evaluate(() => ({
    phase: window.__pron._state.phase,
    msg: (document.querySelector('#pronStatus') || {}).textContent || '',
    err: document.querySelector('#pronStatus').classList.contains('is-err')
  }));
  check('Báo lỗi quyền micro', denied.phase === 'error' && denied.err, denied.phase);
  check('Thông báo hướng dẫn cách sửa', /quyền/i.test(denied.msg), denied.msg.slice(0, 70));

  /* Không có lỗi console (bỏ qua lỗi mạng của POST /api/pron) */
  const realErrors = errors.filter(e => !/Failed to load resource|501|404|NotAllowedError/i.test(e));
  check('Không có lỗi console', realErrors.length === 0, realErrors.slice(0, 3));

  console.log('\n  KẾT QUẢ: ' + pass + ' pass, ' + fail + ' fail\n');
  await browser.close();
  process.exit(fail ? 1 : 0);
})();
