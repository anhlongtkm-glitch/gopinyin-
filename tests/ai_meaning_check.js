/* Kiểm tra bước SOÁT NGHĨA Việt ↔ Hán sau khi AI tạo nội dung.

   Ca thật từ người dùng:  批量 (pī liàng) bị ghi nghĩa "số lượng lớn"
   → SAI. 批量 = "theo lô / hàng loạt".  "số lượng lớn" phải là 大量.

   Phủ:
   A. Có gọi bước soát nghĩa; prompt soát chứa chữ Hán + nghĩa cũ để đối chiếu.
   B. Nghĩa sai được THAY bằng nghĩa đúng trước khi vào bài học.
   C. Nghĩa vốn đã đúng thì GIỮ NGUYÊN (không sửa bừa).
   D. Có thông báo cho người dùng biết đã sửa bao nhiêu.
   E. Tắt công tắc → KHÔNG gọi soát, nghĩa giữ nguyên như AI trả.
   F. Bước soát lỗi/mất mạng → KHÔNG chặn việc học (vẫn có nội dung).

   Chạy: NODE_PATH="<node_modules có playwright-core>" node tests/ai_meaning_check.js
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

/* AI "tạo" ra: 1 nghĩa SAI (批量) + 1 nghĩa ĐÚNG (纸箱) */
const GENERATED = [
  { zh: '批量', py: 'pī liàng', vi: 'số lượng lớn' },     // ← nghĩa sai
  { zh: '纸箱', py: 'zhǐ xiāng', vi: 'thùng carton' }     // ← nghĩa đúng
];
/* AI "soát" trả về: chỉ đánh dấu sai ở 批量, kèm nghĩa đúng */
const VERDICT = [
  { zh: '批量', ok: false, vi_dung: 'theo lô, hàng loạt' },
  { zh: '纸箱', ok: true }
];

const isVerifyPrompt = (p) => /CẦN SOÁT|soát lỗi NGHĨA/i.test(p);

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
  await page.fill('#authEmail', 'm' + Date.now() + '@l.test');
  await page.fill('#authPass', 'matkhau123');
  await page.click('#authSubmit'); await page.waitForTimeout(1600);
  await page.evaluate(() => {
    const m = document.querySelector('#proModal');
    if (m) { m.classList.remove('show'); m.classList.add('hidden'); }
  });

  // Stub AI: phân biệt "tạo nội dung" vs "soát nghĩa" theo nội dung prompt
  await page.evaluate(({ generated, verdict }) => {
    window.APP_CONFIG.AI_PROXY_URL = '/__ai_stub__';
    window.__aiCalls = [];
    const rf = window.fetch.bind(window);
    window.fetch = (url, opt) => {
      if (String(url).includes('__ai_stub__')) {
        let prompt = '';
        try { prompt = JSON.parse(opt.body).prompt || ''; } catch (e) {}
        const isVerify = /CẦN SOÁT|soát lỗi NGHĨA/i.test(prompt);
        window.__aiCalls.push({ verify: isVerify, prompt });
        const text = JSON.stringify(isVerify ? verdict : generated);
        return Promise.resolve(new Response(JSON.stringify({ text }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }));
      }
      return rf(url, opt);
    };
  }, { generated: GENERATED, verdict: VERDICT });

  await page.evaluate(() => document.querySelector('[data-view="ai"]')?.click());
  await page.waitForTimeout(700);
  await page.selectOption('#aiKind', 'word');
  await page.waitForTimeout(300);
  await page.fill('#aiPrompt', 'từ vựng ngành bao bì carton');
  await page.evaluate(() => { document.querySelector('#aiKey').value = ''; });

  /* ═══ A. Có gọi bước soát nghĩa ═══ */
  section('A. Có bước soát nghĩa');
  const verifyOn = await page.evaluate(() => {
    const c = document.querySelector('#aiVerify');
    return c ? { exists: true, checked: c.checked } : { exists: false };
  });
  check('Có công tắc "Soát lại nghĩa"', verifyOn.exists, verifyOn);
  check('Mặc định BẬT', verifyOn.checked === true, verifyOn.checked);

  await page.evaluate(() => { window.__aiCalls = []; });
  await page.click('#aiStartBtn');
  await page.waitForTimeout(2000);

  const calls = await page.evaluate(() => window.__aiCalls.map(c => ({ verify: c.verify, p: c.prompt })));
  const genCalls = calls.filter(c => !c.verify);
  const verCalls = calls.filter(c => c.verify);
  check('Có gọi AI tạo nội dung', genCalls.length >= 1, genCalls.length);
  check('Có gọi AI soát nghĩa', verCalls.length >= 1, verCalls.length);

  const vp = (verCalls[0] || {}).p || '';
  check('Prompt soát chứa chữ Hán cần soát (批量)', vp.includes('批量'), vp.includes('批量'));
  check('Prompt soát chứa nghĩa cũ để đối chiếu (số lượng lớn)', vp.includes('số lượng lớn'), vp.includes('số lượng lớn'));
  check('Prompt soát yêu cầu TỰ DỊCH trước khi so', /TỰ DỊCH/i.test(vp), /TỰ DỊCH/i.test(vp));
  check('Prompt soát nêu ví dụ đúng của 批量', /theo lô|hàng loạt/i.test(vp), /theo lô|hàng loạt/i.test(vp));

  /* ═══ B. Nghĩa sai được sửa ═══ */
  section('B. Nghĩa sai được sửa trước khi học');
  await page.click('#appModalOk');            // "Lưu lại"
  await page.waitForTimeout(600);
  await page.fill('#appModalInput', 'Từ vựng bao bì (soát nghĩa)');
  await page.click('#appModalOk');
  await page.waitForTimeout(1800);

  const study = await page.evaluate(() => ({
    inStudy: !document.querySelector('#appCard').classList.contains('hidden'),
    vi: (document.querySelector('#vietnamese') || {}).textContent || '',
    zh: [...(document.querySelector('#chinese') || {}).textContent || ''].filter(c => /[\u3400-\u9fff]/.test(c)).join('')
  }));
  check('Vào học bình thường', study.inStudy, study.inStudy);
  check('Đang ở mục 批量', study.zh === '批量', study.zh);
  check('Nghĩa SAI đã bị thay bằng "theo lô, hàng loạt"', /theo lô|hàng loạt/i.test(study.vi), study.vi);
  check('Không còn hiện "số lượng lớn"', !/số lượng lớn/i.test(study.vi), study.vi);

  /* ═══ D. Có thông báo đã sửa ═══ */
  section('D. Thông báo cho người dùng');
  const toastTxt = await page.evaluate(() =>
    [...document.querySelectorAll('#toastHost .toast')].map(t => t.textContent).join(' | '));
  check('Có toast báo đã sửa nghĩa', /sửa/i.test(toastTxt) && /nghĩa/i.test(toastTxt), toastTxt.slice(0, 140));

  /* ═══ C. Nghĩa đúng thì giữ nguyên ═══
     Enter CHỈ sang mục khi đã gõ đúng mục hiện tại (awaitingEnter) — nên phải
     gõ xong 批量 trước, đúng như người dùng thật vẫn làm. */
  section('C. Nghĩa vốn đúng được giữ nguyên');
  await page.focus('#pinyinInput');
  await page.keyboard.insertText('批量');
  await page.waitForTimeout(700);
  const beforeNext = await page.evaluate(() => ({
    fb: (document.querySelector('#feedback') || {}).textContent || '',
    readOnly: (document.querySelector('#pinyinInput') || {}).readOnly
  }));
  check('Gõ đúng 批量 → báo Chính xác & khoá ô gõ', /Chính xác/.test(beforeNext.fb) && beforeNext.readOnly === true, beforeNext);
  await page.keyboard.press('Enter');   // sang mục 2 = 纸箱
  await page.waitForTimeout(700);
  const second = await page.evaluate(() => ({
    zh: [...(document.querySelector('#chinese') || {}).textContent || ''].filter(c => /[\u3400-\u9fff]/.test(c)).join(''),
    vi: (document.querySelector('#vietnamese') || {}).textContent || ''
  }));
  check('Mục 2 là 纸箱', second.zh === '纸箱', second.zh);
  check('Nghĩa đúng giữ nguyên "thùng carton"', /thùng carton/i.test(second.vi), second.vi);

  /* ═══ E. Tắt công tắc → không soát ═══ */
  section('E. Tắt công tắc → không soát nghĩa');
  await page.evaluate(() => document.querySelector('#backLibrary').click());
  await page.waitForTimeout(900);
  await page.evaluate(() => {
    const d = document.querySelector('.aiDetails'); if (d) d.open = true;
  });
  await page.waitForTimeout(300);
  await page.uncheck('#aiVerify');
  await page.waitForTimeout(400);
  const offSaved = await page.evaluate(() => localStorage.getItem('gp:aiVerify'));
  check('Đã lưu trạng thái TẮT', offSaved === '0', offSaved);

  await page.evaluate(() => { window.__aiCalls = []; });
  await page.fill('#aiPrompt', 'từ vựng ngành bao bì lần 2');
  await page.click('#aiStartBtn');
  await page.waitForTimeout(2000);
  const calls2 = await page.evaluate(() => window.__aiCalls.map(c => c.verify));
  check('KHÔNG gọi bước soát nghĩa', calls2.length > 0 && calls2.every(v => v === false), calls2);

  // Chọn "Không lưu" để vào học rồi mới đọc được nghĩa hiển thị
  await page.click('#appModalCancel');
  await page.waitForTimeout(1500);
  const noVerifyStudy = await page.evaluate(() => ({
    inStudy: !document.querySelector('#appCard').classList.contains('hidden'),
    vi: (document.querySelector('#vietnamese') || {}).textContent || ''
  }));
  check('Tắt soát → vẫn vào học bình thường', noVerifyStudy.inStudy, noVerifyStudy.inStudy);
  check('Nghĩa giữ nguyên như AI trả (vẫn sai)', /số lượng lớn/i.test(noVerifyStudy.vi), noVerifyStudy.vi);

  /* ═══ F. Soát lỗi → không chặn việc học ═══ */
  section('F. Bước soát lỗi → vẫn học được');
  await page.evaluate(() => document.querySelector('#backLibrary').click());
  await page.waitForTimeout(900);
  await page.evaluate(() => {
    const d = document.querySelector('.aiDetails'); if (d) d.open = true;
  });
  await page.check('#aiVerify');
  await page.waitForTimeout(300);

  // Cho lần gọi SOÁT trả lỗi 500, lần gọi TẠO vẫn bình thường
  await page.evaluate(() => {
    const rf = window.fetch.bind(window);
    window.fetch = (url, opt) => {
      if (String(url).includes('__ai_stub__')) {
        let prompt = '';
        try { prompt = JSON.parse(opt.body).prompt || ''; } catch (e) {}
        if (/CẦN SOÁT|soát lỗi NGHĨA/i.test(prompt)) {
          return Promise.resolve(new Response('boom', { status: 500 }));
        }
        const text = JSON.stringify([{ zh: '纸板', py: 'zhǐ bǎn', vi: 'bìa carton' }]);
        return Promise.resolve(new Response(JSON.stringify({ text }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }));
      }
      return rf(url, opt);
    };
  });
  await page.fill('#aiPrompt', 'từ vựng bao bì lần 3');
  await page.click('#aiStartBtn');
  await page.waitForTimeout(2600);
  // Bước soát lỗi rồi vẫn tới bước hỏi lưu → chọn "Không lưu" để vào học
  await page.click('#appModalCancel');
  await page.waitForTimeout(1600);
  const survived = await page.evaluate(() => ({
    inStudy: !document.querySelector('#appCard').classList.contains('hidden'),
    vi: (document.querySelector('#vietnamese') || {}).textContent || '',
    err: [...document.querySelectorAll('#toastHost .toast')].map(t => t.textContent).join(' | ')
  }));
  check('Soát lỗi vẫn vào học được', survived.inStudy, survived.inStudy);
  check('Vẫn có nội dung để học (bìa carton)', /bìa carton/i.test(survived.vi), survived.vi);

  check('Không có lỗi console', errors.length === 0, errors.slice(0, 3));

  console.log('\n  KẾT QUẢ: ' + pass + ' pass, ' + fail + ' fail\n');
  await browser.close();
  process.exit(fail ? 1 : 0);
})();
