/* ══════════════════════════════════════════════════════════════════
   HỒI QUY TOÀN APP — bấm qua từng mục điều hướng, không lỗi console
   Chạy:  NODE_PATH=<node_modules> node tests/app_regress.js
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

(async () => {
  const browser = await chromium.launch({ executablePath: CHROME, headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  let errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });

  await page.goto(URL, { waitUntil: 'networkidle' });
  check('Tải trang không lỗi', errors.length === 0, errors);

  await require('./helpers/supabase-fixture.cjs').register(page);
  await page.waitForTimeout(800);
  await page.evaluate(() => {
    const m = document.querySelector('#proModal');
    if (m) { m.classList.add('hidden'); m.style.display = 'none'; }
  });

  const views = await page.evaluate(() =>
    [...document.querySelectorAll('[data-view]')].map(b => ({
      view: b.dataset.view,
      label: (b.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 28)
    }))
  );
  console.log('\n  Mục điều hướng:', views.map(v => v.view).join(' · '));
  const coreViews = ['dash', 'practice', 'readings', 'bear', 'rank', 'ai', 'games'];
  const missing = coreViews.filter(v => !views.some(x => x.view === v));
  check('Đủ các mục điều hướng cốt lõi', missing.length === 0, { missing });
  check('Không còn mục Vườn Pinyin / Cung thủ', !views.some(x => x.view === 'garden' || x.view === 'archer'), views.map(v => v.view));

  for (const v of views) {
    const before = errors.length;
    await page.evaluate(view => {
      const b = [...document.querySelectorAll('[data-view]')].find(x => x.dataset.view === view);
      if (b) b.click();
    }, v.view);
    await page.waitForTimeout(600);

    const info = await page.evaluate(() => {
      const secs = [...document.querySelectorAll('.ws-main > section')]
        .filter(s => !s.classList.contains('hidden'));
      let best = { w: 0, h: 0, id: '' };
      secs.forEach(s => {
        const r = s.getBoundingClientRect();
        if (r.width * r.height > best.w * best.h) best = { w: Math.round(r.width), h: Math.round(r.height), id: s.id };
      });
      return best;
    });
    const newErr = errors.slice(before);
    const ok = info.w > 200 && info.h > 80 && newErr.length === 0;
    check(`${v.view.padEnd(8)} hiển thị`, ok, `${info.id || '?'} ${info.w}x${info.h} lỗi mới=${newErr.length}`);
    if (newErr.length) console.log('         ' + newErr.slice(0, 2).join(' | '));
  }

  /* Game bắn chữ vẫn có canvas */
  const canvases = await page.evaluate(() => {
    const out = {};
    document.querySelectorAll('canvas').forEach(c => {
      if (c.id && c.width > 100) out[c.id] = c.width + 'x' + c.height;
    });
    return out;
  });
  check('Canvas game bắn chữ còn hoạt động', !!canvases.gaCanvas, canvases);

  check('Không lỗi console toàn phiên', errors.length === 0, errors.slice(0, 3));

  console.log('\n══════════════════════════════════════');
  console.log(`  HỒI QUY: ${pass}/${pass + fail} PASS · ${fail} FAIL`);
  if (fail) console.log('  FAIL: ' + fails.join(' | '));
  console.log('══════════════════════════════════════');
  console.log('Lỗi console tổng: ' + (errors.length ? errors.slice(0, 3).join(' | ') : 'none'));

  await browser.close();
  process.exit(fail ? 1 : 0);
})();
