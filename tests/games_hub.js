/* ══════════════════════════════════════════════════════════════════
   KIỂM CHỨNG: SẢNH "GAME TỪ VỰNG" — game bắn chữ là MỤC CON
   - Mục điều hướng bên trái đổi "Game bắn chữ" → "Game từ vựng"
   - Mục cha hiện DANH SÁCH game; bấm thẻ mới vào màn chơi
   - Thẻ game bắn chữ có ẢNH ĐẠI DIỆN (SVG) riêng
   - Bấm nút ✕ trong game → quay về sảnh game (không về thư viện)
   Chạy: NODE_PATH=<node_modules> node tests/games_hub.js
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
function section(t) { console.log('\n══ ' + t + ' ══'); }

(async () => {
  const browser = await chromium.launch({
    executablePath: CHROME, headless: true,
    args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream',
           '--autoplay-policy=no-user-gesture-required']
  });
  const page = await browser.newPage({ viewport: { width: 1440, height: 950 } });
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });

  await page.goto(URL, { waitUntil: 'load' });
  await page.waitForFunction(() => !!window.__gpBridge && !!window.__game, null, { timeout: 15000 });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(600);
  await page.click('#wsLoginBtn'); await page.waitForTimeout(300);
  await page.click('[data-authtab="register"]'); await page.waitForTimeout(200);
  await page.fill('#authName', 'Test');
  await page.fill('#authEmail', 'g' + Date.now() + '@l.test');
  await page.fill('#authPass', 'matkhau123');
  await page.click('#authSubmit'); await page.waitForTimeout(1400);
  await page.evaluate(() => { const m = document.querySelector('#proModal'); if (m) { m.classList.add('hidden'); m.style.display = 'none'; } });

  section('1 — Điều hướng');
  const nav = await page.evaluate(() => {
    const items = [...document.querySelectorAll('.ws-navItem')].map(b => ({
      view: b.dataset.view, label: (b.textContent || '').replace(/\s+/g, ' ').trim()
    }));
    return { items, hasGames: items.some(x => x.view === 'games'), hasOld: items.some(x => x.view === 'game') };
  });
  check('Thanh bên có mục "Game từ vựng"', nav.hasGames, nav.items.map(x => x.view));
  check('Thanh bên KHÔNG còn mục trực tiếp "Game bắn chữ"', !nav.hasOld, nav.items.map(x => x.view));
  const navLabel = (nav.items.find(x => x.view === 'games') || {}).label || '';
  check('Nhãn mục là "Game từ vựng"', /Game từ vựng/.test(navLabel), navLabel);

  section('2 — Sảnh game (màn cha)');
  await page.evaluate(() => document.querySelector('.ws-navItem[data-view="games"]').click());
  await page.waitForTimeout(800);
  const hub = await page.evaluate(() => {
    const hub = document.querySelector('#gamesCard');
    const tiles = [...document.querySelectorAll('.gameTile')];
    const shoot = document.querySelector('.gameTile[data-view="game"]');
    return {
      hubVisible: !!hub && !hub.classList.contains('hidden'),
      gameHidden: document.querySelector('#gameCard').classList.contains('hidden'),
      tileCount: tiles.length,
      shootExists: !!shoot,
      shootTitle: shoot ? (shoot.querySelector('h3')?.innerText || '').trim() : '',
      shootArt: shoot ? !!shoot.querySelector('.gameTileArt svg') : false,
      shootBadge: shoot ? (shoot.querySelector('.gameTileBadge')?.innerText || '').trim() : '',
      shootPlay: shoot ? (shoot.querySelector('.gameTilePlay')?.innerText || '').trim() : '',
      soonCount: document.querySelectorAll('.gameTileSoon').length,
      title: (document.querySelector('#wsViewTitle')?.innerText || '').trim(),
      navActive: (document.querySelector('.ws-navItem.active')?.dataset.view) || ''
    };
  });
  check('Sảnh game hiện ra khi bấm mục "Game từ vựng"', hub.hubVisible === true, hub.hubVisible);
  check('Màn chơi game CHƯA mở khi mới vào sảnh', hub.gameHidden === true, hub.gameHidden);
  check('Tiêu đề màn = "Game từ vựng"', /Game từ vựng/.test(hub.title), hub.title);
  check('Mục điều hướng "games" được tô sáng', hub.navActive === 'games', hub.navActive);
  check('Có thẻ game bắn chữ', hub.shootExists === true, hub.shootExists);
  check('Thẻ có ẢNH ĐẠI DIỆN (SVG)', hub.shootArt === true, hub.shootArt);
  check('Thẻ có nhãn "Đang mở"', /Đang mở/.test(hub.shootBadge), hub.shootBadge);
  check('Thẻ có nút "Chơi ngay"', /Chơi ngay/.test(hub.shootPlay), hub.shootPlay);
  check('Có sẵn chỗ cho game sắp ra mắt (2 thẻ)', hub.soonCount === 2, hub.soonCount);
  check('Tổng số thẻ game = 3', hub.tileCount === 3, hub.tileCount);

  section('3 — Bấm thẻ → vào màn chơi game bắn chữ');
  await page.evaluate(() => document.querySelector('.gameTile[data-view="game"]').click());
  await page.waitForTimeout(1400);
  const inGame = await page.evaluate(() => ({
    gameVisible: !document.querySelector('#gameCard').classList.contains('hidden'),
    hubHidden: document.querySelector('#gamesCard').classList.contains('hidden'),
    canvas: !!document.querySelector('#gaCanvas'),
    overlay: !!document.querySelector('#gaOverlay'),
    navActive: (document.querySelector('.ws-navItem.active')?.dataset.view) || '',
    title: (document.querySelector('#wsViewTitle')?.innerText || '').trim(),
    backTxt: (document.querySelector('#backLibrary')?.innerText || '').trim()
  }));
  check('Màn chơi game mở ra', inGame.gameVisible === true, inGame.gameVisible);
  check('Sảnh game ẩn lại', inGame.hubHidden === true, inGame.hubHidden);
  check('Có canvas + màn overlay sẵn sàng', inGame.canvas && inGame.overlay, inGame);
  check('Vẫn tô sáng mục cha "games"', inGame.navActive === 'games', inGame.navActive);
  check('Tiêu đề màn = "Game bắn chữ"', /Game bắn chữ/.test(inGame.title), inGame.title);
  check('Nút quay lại ghi "← Game từ vựng"', /Game từ vựng/.test(inGame.backTxt), inGame.backTxt);

  section('4 — Bấm ✕ trong game → quay về sảnh game');
  await page.click('#gaCloseBtn');
  await page.waitForTimeout(900);
  const back = await page.evaluate(() => ({
    hubVisible: !document.querySelector('#gamesCard').classList.contains('hidden'),
    gameHidden: document.querySelector('#gameCard').classList.contains('hidden'),
    libraryHidden: document.querySelector('#libraryCard').classList.contains('hidden'),
    navActive: (document.querySelector('.ws-navItem.active')?.dataset.view) || ''
  }));
  check('Quay về sảnh "Game từ vựng"', back.hubVisible === true, back);
  check('Màn chơi game đã đóng', back.gameHidden === true, back.gameHidden);
  check('KHÔNG quay về thư viện', back.libraryHidden === true, back.libraryHidden);
  check('Mục "games" vẫn tô sáng', back.navActive === 'games', back.navActive);

  section('5 — Từ bảng điều khiển → sảnh game qua thanh bên');
  await page.evaluate(() => document.querySelector('.ws-navItem[data-view="dash"]').click());
  await page.waitForTimeout(700);
  const dash = await page.evaluate(() => {
    const b = [...document.querySelectorAll('.dashFeature')].find(x => x.dataset.view === 'games');
    return { exists: !!b, label: b ? (b.textContent || '').replace(/\s+/g, ' ').trim() : '' };
  });
  // Approved Plan A includes a separate Game panel beside the extra skills.
  check('Dashboard có lối vào Game riêng theo bản đã duyệt', dash.exists === true, dash.exists);
  check('Thanh bên vẫn có đường vào game', await page.locator('.ws-navItem[data-view="games"]').count() === 1);
  await page.evaluate(() => document.querySelector('.ws-navItem[data-view="games"]').click());
  await page.waitForTimeout(700);
  const viaDash = await page.evaluate(() => !document.querySelector('#gamesCard').classList.contains('hidden'));
  check('Bấm mục thanh bên từ dashboard → mở sảnh game', viaDash === true, viaDash);

  section('6 — Đang chơi game mà bấm mục khác trên thanh bên');
  await page.evaluate(() => document.querySelector('.gameTile[data-view="game"]').click());
  await page.waitForTimeout(1200);
  await page.evaluate(() => { const b = document.querySelector('#gaStartBtn'); if (b) b.click(); });
  await page.waitForTimeout(900);
  const playing = await page.evaluate(() => {
    const st = window.__game._state;
    return { running: !!st.running, stage: st.stage };
  });
  check('Ván game đang chạy', playing.running === true, playing);
  await page.evaluate(() => document.querySelector('.ws-navItem[data-view="practice"]').click());
  await page.waitForTimeout(900);
  const away = await page.evaluate(() => {
    const st = window.__game._state;
    return {
      running: !!st.running,
      gameHidden: document.querySelector('#gameCard').classList.contains('hidden'),
      libraryVisible: !document.querySelector('#libraryCard').classList.contains('hidden'),
      navActive: (document.querySelector('.ws-navItem.active')?.dataset.view) || ''
    };
  });
  check('Rời game → ván dừng lại (không chạy nền)', away.running === false, away.running);
  check('Rời game → màn game ẩn, thư viện hiện', away.gameHidden && away.libraryVisible, away);
  check('Mục điều hướng chuyển sang "practice"', away.navActive === 'practice', away.navActive);
  /* quay lại game → ván cũ được giữ (có thể hồi sinh) */
  await page.evaluate(() => document.querySelector('.ws-navItem[data-view="games"]').click());
  await page.waitForTimeout(600);
  await page.evaluate(() => document.querySelector('.gameTile[data-view="game"]').click());
  await page.waitForTimeout(1200);
  const reenter = await page.evaluate(() => {
    const st = window.__game._state;
    return {
      gameVisible: !document.querySelector('#gameCard').classList.contains('hidden'),
      overlay: !!document.querySelector('#gaOverlay'),
      hasResume: !!(document.querySelector('#gaNewBtn') && !document.querySelector('#gaNewBtn').classList.contains('hidden'))
    };
  });
  check('Vào lại game → màn chơi mở, có overlay sẵn sàng/hồi sinh', reenter.gameVisible && reenter.overlay, reenter);

  /* ═══ §7 — NÚT "← Game từ vựng" ở GÓC TRÊN BÊN PHẢI (trên thanh tiêu đề)
     LỖI CŨ: nút này bị gán 2 handler chồng nhau (leaveGame + leaveStudy) →
     bấm xong thư viện bị mở CHỒNG lên sảnh game. Giờ phải về đúng 1 màn. */
  section('7 — Nút "← Game từ vựng" trên thanh tiêu đề');
  const backBtn = await page.evaluate(() => {
    const b = document.querySelector('#backLibrary');
    return { exists: !!b, txt: (b?.innerText || '').trim(), visible: !!b && !b.classList.contains('hidden') };
  });
  check('Có nút quay lại trên thanh tiêu đề', backBtn.exists === true, backBtn);
  check('Nút hiện ra khi đang ở màn chơi game', backBtn.visible === true, backBtn);
  check('Nhãn nút là "← Game từ vựng"', /Game từ vựng/.test(backBtn.txt), backBtn.txt);

  await page.click('#backLibrary');
  await page.waitForTimeout(1000);
  const afterBack = await page.evaluate(() => {
    const vis = id => !document.querySelector('#' + id).classList.contains('hidden');
    return {
      games: vis('gamesCard'), game: vis('gameCard'), lib: vis('libraryCard'),
      ai: vis('aiCard'), dash: vis('dashView'),
      title: (document.querySelector('#wsViewTitle')?.innerText || '').trim(),
      navActive: (document.querySelector('.ws-navItem.active')?.dataset.view) || '',
      visSections: ['dashView', 'libraryCard', 'aiCard', 'gamesCard', 'gameCard'].filter(vis)
    };
  });
  check('Bấm nút → về đúng sảnh "Game từ vựng"', afterBack.games === true, afterBack);
  check('Màn chơi game đã đóng', afterBack.game === false, afterBack.game);
  check('KHÔNG mở thư viện (lỗi cũ: thư viện chồng lên sảnh game)', afterBack.lib === false, afterBack);
  check('KHÔNG mở màn AI', afterBack.ai === false, afterBack.ai);
  check('KHÔNG mở bảng điều khiển', afterBack.dash === false, afterBack.dash);
  check('CHỈ đúng 1 màn hiện ra (sảnh game)', afterBack.visSections.length === 1 && afterBack.visSections[0] === 'gamesCard', afterBack.visSections);
  check('Tiêu đề màn = "Game từ vựng"', /Game từ vựng/.test(afterBack.title), afterBack.title);
  check('Mục điều hướng "games" được tô sáng', afterBack.navActive === 'games', afterBack.navActive);

  /* ═══ §8 — Nút cũng phải dùng lại được cho màn HỌC (không hỏng luồng cũ) */
  section('8 — Nút quay lại khi đang ở màn học');
  await page.evaluate(() => document.querySelector('.ws-navItem[data-view="practice"]').click());
  await page.waitForTimeout(700);
  const fromLib = await page.evaluate(() => {
    const vis = id => !document.querySelector('#' + id).classList.contains('hidden');
    return { lib: vis('libraryCard'), games: vis('gamesCard'), game: vis('gameCard') };
  });
  check('Vào thư viện → chỉ thư viện hiện', fromLib.lib && !fromLib.games && !fromLib.game, fromLib);
  await page.evaluate(() => { document.querySelector('#backLibrary').click(); });
  await page.waitForTimeout(700);
  const afterStudyBack = await page.evaluate(() => {
    const vis = id => !document.querySelector('#' + id).classList.contains('hidden');
    return { lib: vis('libraryCard'), games: vis('gamesCard'), game: vis('gameCard') };
  });
  check('Bấm nút ở màn học → không mở nhầm sảnh game', afterStudyBack.games === false && afterStudyBack.game === false, afterStudyBack);

  check('Không có lỗi console', errors.length === 0, errors);

  await page.evaluate(() => document.querySelector('.ws-navItem[data-view="games"]').click());
  await page.waitForTimeout(700);
  const shot=require('node:path').resolve(__dirname,'../.cache/test-run/shot_games_hub.png');
  require('node:fs').mkdirSync(require('node:path').dirname(shot),{recursive:true});
  await page.screenshot({ path: shot });
  console.log('\n  Ảnh: '+shot);

  console.log('\n  ── KẾT QUẢ: ' + pass + ' PASS · ' + fail + ' FAIL ──');
  if (fail) console.log('  Lỗi: ' + fails.join(' | '));
  await browser.close();
  process.exit(fail ? 1 : 0);
})();
