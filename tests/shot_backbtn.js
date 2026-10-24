/* Chụp ảnh: bấm nút "← Game từ vựng" ở góc trên bên phải → phải về
   đúng màn sảnh "Game từ vựng" (KHÔNG mở thư viện chồng lên). */
const { chromium } = require('playwright-core');
const URL = process.env.TEST_URL || 'http://localhost:8080/';
const CHROME = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';

(async () => {
  const browser = await chromium.launch({
    executablePath: CHROME, headless: true,
    args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream',
           '--autoplay-policy=no-user-gesture-required']
  });
  const page = await browser.newPage({ viewport: { width: 1440, height: 950 } });
  await page.goto(URL, { waitUntil: 'load' });
  await page.waitForFunction(() => !!window.__gpBridge && !!window.__game, null, { timeout: 15000 });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(600);
  await page.click('#lpLoginBtn'); await page.waitForTimeout(300);
  await page.click('[data-authtab="register"]'); await page.waitForTimeout(200);
  await page.fill('#authName', 'Test');
  await page.fill('#authEmail', 's' + Date.now() + '@l.test');
  await page.fill('#authPass', 'matkhau123');
  await page.click('#authSubmit'); await page.waitForTimeout(1400);
  await page.evaluate(() => { const m = document.querySelector('#proModal'); if (m) { m.classList.add('hidden'); m.style.display = 'none'; } });

  await page.evaluate(() => document.querySelector('.ws-navItem[data-view="games"]').click());
  await page.waitForTimeout(700);
  await page.evaluate(() => document.querySelector('.gameTile[data-view="game"]').click());
  await page.waitForTimeout(1400);
  await page.screenshot({ path: 'tests/shot_backbtn_game.png' });

  // Bấm nút "← Game từ vựng"
  await page.click('#backLibrary');
  await page.waitForTimeout(1200);
  await page.screenshot({ path: 'tests/shot_backbtn_after.png' });

  console.log('Đã chụp: tests/shot_backbtn_game.png, tests/shot_backbtn_after.png');
  await browser.close();
})();
