const { chromium } = require('playwright-core');
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const URL = 'http://localhost:8080/';

(async () => {
  const browser = await chromium.launch({ executablePath: CHROME, headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 2 });
  page.on('pageerror', e => console.log('PAGEERROR:', String(e)));
  await page.goto(URL, { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(500);
  await page.click('#lpLoginBtn'); await page.waitForTimeout(300);
  await page.click('[data-authtab="register"]'); await page.waitForTimeout(200);
  await page.fill('#authName', 'Minh Anh');
  await page.fill('#authEmail', 'p' + Date.now() + '@l.test');
  await page.fill('#authPass', 'matkhau123');
  await page.click('#authSubmit'); await page.waitForTimeout(1500);
  await page.evaluate(() => { const m = document.querySelector('#proModal'); if (m) { m.classList.remove('show'); m.classList.add('hidden'); } });
  await page.evaluate(() => document.querySelector('[data-view="games"]').click());
  await page.waitForTimeout(900);
  await page.screenshot({ path: 'tests/shot_games_hub.png' });
  console.log('shot_games_hub.png');

  /* mobile */
  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  await page.evaluate(() => {
    const c = document.querySelector('#confettiCanvas'); if (c) c.remove();
  });
  await page.evaluate(() => document.querySelector('[data-view="games"]')?.click());
  await page.waitForTimeout(800);
  await page.screenshot({ path: 'tests/shot_games_hub_mobile.png', fullPage: true });
  console.log('shot_games_hub_mobile.png');

  await browser.close();
})();
