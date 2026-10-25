'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');
const net = require('node:net');
const { chromium } = require('playwright-core');
const root = path.resolve(__dirname, '..');
async function freePort() {
  const s = net.createServer();
  await new Promise(r => s.listen(0, '127.0.0.1', r));
  const port = s.address().port;
  await new Promise(r => s.close(r));
  return port;
}
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
  try {
    for (const device of ['desktop', 'mobile']) for (const theme of ['light', 'dark']) {
      const context = await browser.newContext({ viewport: device === 'desktop' ? { width: 1440, height: 900 } : { width: 390, height: 844 } });
      await context.addInitScript(theme => localStorage.setItem('cts:theme', theme), theme);
      const page = await context.newPage(), errors = [], payments = [];
      page.on('pageerror', e => errors.push(e.message));
      page.on('request', r => { if (/\/pro\/(status|content)|vietqr|\/webhook/.test(r.url())) payments.push(r.url()); });
      await page.goto(process.env.TEST_URL, { waitUntil: 'networkidle' });
      assert(await page.locator('#dashView').isVisible());
      assert.equal(await page.locator('#libraryCard').isVisible(), false);
      assert.equal(await page.locator('#wsUserName').textContent(), 'Khách');
      assert.equal(await page.locator('#landing,#proModal,#trialBanner,.ws-lock,.ws-proBadge').count(), 0);
      assert.equal(await page.evaluate(() => window.__gpIsPro), undefined);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
      fs.mkdirSync(path.join(root, '.cache/free-access'), { recursive: true });
      await page.screenshot({ path: path.join(root, `.cache/free-access/${theme}-${device}.png`), fullPage: true });
      // Old payment and learning data must survive loading, login, and logout.
      await page.evaluate(() => {
        localStorage.setItem('gp:pro', 'true');
        localStorage.setItem('gp:trial:old@example.com', JSON.stringify({ at: 1 }));
        localStorage.setItem('cts:progress:existing', JSON.stringify({ mainIndex: 7 }));
      });
      for (const user of [null, { email: 'old@example.com', name: 'Old account', guest: false }]) {
        await page.evaluate(user => {
          if (user) localStorage.setItem('gp:user', JSON.stringify(user));
          else localStorage.removeItem('gp:user');
        }, user);
        await page.reload({ waitUntil: 'networkidle' });
        await page.locator('.ws-navItem[data-view="ai"]').click();
        assert(await page.locator('#aiCard').isVisible());
        await page.locator('.ws-navItem[data-view="library"]').click();
        for (const level of [4, 5, 6, 7, 8, 9]) {
          await page.locator(`#vocabList [data-vsrc="hsk${level}"]`).click();
          await page.locator('#appCard').waitFor({ state: 'visible' });
          await page.locator('.ws-navItem[data-view="library"]').click();
        }
        await page.locator('.ws-navItem[data-view="pron"]').click();
        assert.equal(await page.locator('#pronLibHsk .isLocked,.vocabLock').count(), 0);
        await page.locator('[data-psrc="hsk:hsk9"]').click();
        await page.locator('#pronCard').waitFor({ state: 'visible' });
        assert.equal(await page.locator('#pronSource').inputValue(), 'hsk:hsk9');
        if (device === 'desktop') assert(await page.evaluate(() => document.documentElement.scrollHeight <= innerHeight + 2));
        await page.evaluate(() => window.showView('game'));
        await page.locator('[data-glevel="6"]').click();
        assert.equal(await page.locator('[data-glevel="6"]').getAttribute('aria-pressed'), 'true');
      }
      await page.locator('#wsLogoutBtn').click();
      assert(await page.locator('#dashView').isVisible());
      await page.locator('#wsLoginBtn').click();
      await page.locator('[data-authtab="register"]').click();
      await page.fill('#authName', 'Free learner');
      await page.fill('#authEmail', 'free@example.com');
      await page.fill('#authPass', 'password123');
      await page.click('#authSubmit');
      await page.locator('#authModal').waitFor({ state: 'hidden' });
      assert.equal(await page.locator('#wsUserName').textContent(), 'Free learner');
      await page.locator('#wsLogoutBtn').click();
      await page.locator('#wsLoginBtn').click();
      await page.locator('[data-authtab="login"]').click();
      await page.fill('#authEmail', 'free@example.com');
      await page.fill('#authPass', 'password123');
      await page.click('#authSubmit');
      await page.locator('#authModal').waitFor({ state: 'hidden' });
      assert.equal(await page.locator('#wsUserName').textContent(), 'Free learner');
      assert.equal(await page.evaluate(() => localStorage.getItem('gp:pro')), 'true');
      assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('cts:progress:existing')).mainIndex), 7);
      assert.deepEqual(payments, []);
      assert.deepEqual(errors, []);
      await context.close();
      console.log(`  PASS free access, existing data, auth: ${device} ${theme}`);
    }
  } finally { await browser.close(); }
  const port = await freePort();
  const server = spawn(process.execPath, ['server/pro-server.js'], { cwd: root, env: { ...process.env, PORT: String(port), WEBHOOK_SECRET: '', HMAC_SECRET: '', ALLOW_INSECURE_WEBHOOK: '', AI_KEY_GEMINI: '', AI_KEY_OPENROUTER: '', AI_PROXY_TOKEN: '', AZURE_SPEECH_KEY: '' }, windowsHide: true, stdio: 'pipe' });
  try {
    const url = `http://127.0.0.1:${port}`;
    let ready = false;
    for (let i = 0; i < 50; i++) {
      try { ready = (await fetch(url + '/health')).ok; } catch {}
      if (ready) break;
      await new Promise(r => setTimeout(r, 100));
    }
    assert(ready, 'Backend starts without payment secrets');
    for (const route of ['/pro/status', '/pro/content', '/webhook']) assert.equal((await fetch(url + route, { method: route === '/webhook' ? 'POST' : 'GET' })).status, 404);
    assert.equal((await fetch(url + '/api/ai', { method: 'POST', body: '{}' })).status, 500);
    assert.equal((await fetch(url + '/api/pron', { method: 'POST', body: '{}' })).status, 501);
    console.log('  PASS service APIs retained; payment endpoints removed');
  } finally { server.kill(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
