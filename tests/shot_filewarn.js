/* Chụp màn hình cảnh báo file:// (đúng luồng thật) */
const { chromium } = require('playwright-core');
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const FILE_URL = 'file:///C:/Users/ADMIN/Downloads/gopinyin/index.html';
(async () => {
  const b = await chromium.launch({ executablePath: CHROME, headless: true, args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] });
  const p = await b.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
  await p.goto(FILE_URL, { waitUntil: 'domcontentloaded' });
  await p.evaluate(() => localStorage.clear());
  await p.reload({ waitUntil: 'networkidle' });
  await p.waitForTimeout(500);
  await p.click('#lpLoginBtn'); await p.waitForTimeout(300);
  await p.click('[data-authtab="register"]'); await p.waitForTimeout(200);
  await p.fill('#authName', 'Minh Anh');
  await p.fill('#authEmail', 'fw' + Date.now() + '@l.test');
  await p.fill('#authPass', 'matkhau123');
  await p.click('#authSubmit'); await p.waitForTimeout(1500);
  await p.evaluate(() => { const m = document.querySelector('#proModal'); if (m) { m.classList.remove('show'); m.classList.add('hidden'); } });
  await p.evaluate(() => document.querySelector('[data-view="pron"]').click());
  await p.waitForTimeout(1400);
  await p.evaluate(() => {
    const c = document.querySelector('#confettiCanvas'); if (c) c.remove();
    document.querySelectorAll('#toastHost .toast').forEach(t => t.remove());
  });
  await p.screenshot({ path: 'tests/shot_filewarn_picker.png' });
  console.log('shot_filewarn_picker.png');
  await p.evaluate(() => document.querySelector('#pronLibHsk [data-psrc="hsk:hsk1"]').click());
  await p.waitForTimeout(1000);
  await p.evaluate(() => { document.querySelectorAll('#toastHost .toast').forEach(t => t.remove()); });
  await p.screenshot({ path: 'tests/shot_filewarn_study.png' });
  console.log('shot_filewarn_study.png');
  await b.close();
})();
