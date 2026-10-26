'use strict';
const assert = require('node:assert/strict');
const { chromium } = require('playwright-core');
const { register } = require('./helpers/supabase-fixture.cjs');
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
  try {
    const page = await browser.newPage(), errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(process.env.TEST_URL, { waitUntil: 'networkidle' });
    await register(page, 'Navigation race learner');
    let release, notify;
    const started = new Promise(resolve => { notify = resolve; });
    let first = true;
    await page.route('**/auth/v1/user', async route => {
      if (first) { first = false; notify(); await new Promise(resolve => { release = resolve; }); }
      await route.continue();
    });
    await page.evaluate(() => { window.__oldView = window.showView('game'); });
    await started;
    await page.evaluate(() => window.showView('library')); release();
    await page.evaluate(() => window.__oldView);
    assert(await page.locator('#libraryCard').isVisible()); assert(!(await page.locator('#gameCard').isVisible()));
    await page.unroute('**/auth/v1/user');
    console.log('  PASS delayed protected navigation cannot replace a newer public view');

    for (const source of ['hsk1', 'hsk2']) {
      await page.evaluate(() => window.showView('library')); await page.click(`[data-vsrc="${source}"]`); await page.locator('#appCard').waitFor({ state: 'visible' });
    }
    await page.evaluate(() => Promise.all([window.openDataset('vocab:hsk1'), window.openDataset('vocab:hsk2')]));
    assert.equal(await page.evaluate(() => window.activeDataset.id), 'vocab:hsk2');
    console.log('  PASS rapid dataset selections commit only the latest selection');

    const pending = [];
    await page.route('**/__race_ai__', async route => {
      await new Promise(resolve => { pending.push({ route, finish: async (status, text) => { await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify({ text }) }); resolve(); } }); });
    });
    await page.evaluate(() => { window.APP_CONFIG.AI_PROXY_URL = '/__race_ai__'; });
    await page.evaluate(() => window.showView('ai')); await page.fill('#aiPrompt', 'giao tiếp'); await page.selectOption('#aiBatch', '3');
    await page.evaluate(() => { const checkbox = document.getElementById('aiVerify'); checkbox.checked = false; checkbox.dispatchEvent(new Event('change', { bubbles: true })); });
    await page.evaluate(() => { window.__oldAi = window.aiStartStudy(); });
    for (let i = 0; i < 100 && pending.length < 1; i++) await page.waitForTimeout(20);
    assert.equal(pending.length, 1);
    await page.evaluate(() => window.showView('dash'));
    await page.evaluate(() => window.showView('ai'));
    await page.evaluate(() => { window.__newAi = window.aiStartStudy(); });
    for (let i = 0; i < 100 && pending.length < 2; i++) await page.waitForTimeout(20);
    assert.equal(pending.length, 2);
    await pending[0].finish(502, 'old failure'); await page.evaluate(() => window.__oldAi);
    assert(await page.locator('#aiStartBtn').isDisabled());
    assert(!(await page.locator('#appModal').evaluate(el => el.classList.contains('show'))));
    const rows = [{ zh: '你好。', py: 'nǐ hǎo', vi: 'Xin chào.' }, { zh: '谢谢。', py: 'xiè xie', vi: 'Cảm ơn.' }, { zh: '再见。', py: 'zài jiàn', vi: 'Tạm biệt.' }];
    await pending[1].finish(200, JSON.stringify(rows)); await page.locator('#appModal.show').waitFor({ state: 'visible' });
    await page.goBack(); await page.evaluate(() => window.__newAi);
    assert(!(await page.locator('#appModal').evaluate(el => el.classList.contains('show'))));
    assert(await page.locator('#aiStartBtn').isEnabled()); assert(!(await page.locator('#appCard').isVisible()));
    console.log('  PASS stale AI failure cannot reset a newer request; navigating away closes its save dialog');

    await page.evaluate(() => window.showView('ai'));
    await page.evaluate(() => { window.__initialAi = window.aiStartStudy(); });
    for (let i = 0; i < 250 && pending.length < 3; i++) await page.waitForTimeout(20);
    assert.equal(pending.length, 3);
    await pending[2].finish(200, JSON.stringify(rows)); await page.locator('#appModal.show').waitFor({ state: 'visible' });
    await page.click('#appModalCancel'); await page.evaluate(() => window.__initialAi);
    await page.evaluate(() => { window.index = 1; window.__oldFill = window.aiMaybeFill(); });
    for (let i = 0; i < 250 && pending.length < 4; i++) await page.waitForTimeout(20);
    assert.equal(pending.length, 4);
    await page.evaluate(() => window.openDataset('vocab:hsk1'));
    const lessonSize = await page.evaluate(() => window.rows.length);
    await pending[3].finish(200, JSON.stringify([{ zh: '对不起。', py: 'duì bu qǐ', vi: 'Xin lỗi.' }]));
    await page.evaluate(() => window.__oldFill);
    assert.equal(await page.evaluate(() => window.rows.length), lessonSize);
    assert.equal(await page.evaluate(() => window.activeDataset.id), 'vocab:hsk1');
    console.log('  PASS cancelled background AI generation cannot append rows to a different lesson');

    let translated, translationRoute;
    const translationStarted = new Promise(resolve => { translated = resolve; });
    await page.route('**/api.mymemory.translated.net/**', route => { translationRoute = route; translated(); });
    await page.evaluate(() => { window.rows = [{ id: 'old-translation', zh: '旧译', py: 'jiù yì', vi: '' }]; window.__oldTranslation = window.aiFillMissingVi(); });
    await translationStarted;
    await page.evaluate(() => window.openDataset('vocab:hsk2'));
    const originalMeaning = await page.evaluate(() => window.rows[0].vi);
    await translationRoute.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify({ responseData: { translatedText: 'Nghĩa cũ' }, responseStatus: 200 }) });
    await page.evaluate(() => window.__oldTranslation);
    assert.equal(await page.evaluate(() => window.rows[0].vi), originalMeaning);
    console.log('  PASS delayed translation cannot write into the newly opened lesson');

    await page.evaluate(() => window.showView('pron'));
    await page.evaluate(() => {
      window.__originalGet = window.__gpBridge.dbGet;
      window.__gpBridge.dbGet = id => id === 'slow' ? new Promise(resolve => { window.__finishSlow = resolve; }) : window.__originalGet(id);
      window.__oldPron = window.__pron.start('ds:slow');
    });
    await page.waitForFunction(() => !!window.__finishSlow);
    await page.evaluate(() => window.__pron.start('hsk:hsk2'));
    await page.locator('#pronCard').waitFor({ state: 'visible' });
    await page.evaluate(() => { window.__finishSlow({ id: 'slow', rows: [{ id: 0, zh: '旧', py: 'jiù', vi: 'Cũ' }] }); });
    await page.evaluate(() => window.__oldPron);
    assert.equal(await page.evaluate(() => window.__pron._state.source), 'hsk:hsk2');
    assert((await page.evaluate(() => window.__pron._state.items.length)) > 1);
    console.log('  PASS delayed pronunciation source cannot overwrite a newer selection');

    await page.evaluate(() => {
      window.SpeechRecognition = class {};
      Object.defineProperty(navigator.mediaDevices, 'getUserMedia', { configurable: true, value: () => new Promise(resolve => { window.__grantMic = () => resolve({ getTracks: () => [{ stop: () => { window.__lateTrackStopped = true; } }] }); }) });
    });
    await page.click('#pronMicBtn'); await page.waitForFunction(() => !!window.__grantMic);
    await page.evaluate(() => window.showView('dash'));
    await page.evaluate(() => window.__grantMic());
    await page.waitForFunction(() => !!window.__lateTrackStopped);
    assert.equal(await page.evaluate(() => window.__pron._state.stream), null);
    assert.notEqual(await page.evaluate(() => window.__pron._state.phase), 'recording');
    assert.equal(await page.evaluate(() => window.__pron._state.phase), 'idle');
    assert(await page.locator('#dashView').isVisible());
    assert.deepEqual(errors, []);
    console.log('  PASS microphone permission resolved after leaving closes its tracks and does not start recording');

    const email = await page.locator('#authEmail').inputValue();
    const login = async () => {
      await page.fill('#authEmail', email); await page.fill('#authPass', 'password123');
      await page.click('#authSubmit'); await page.locator('#authModal').waitFor({ state: 'hidden' });
      await page.waitForFunction(() => !document.getElementById('authSubmit').disabled);
    };
    await page.click('#wsLogoutBtn'); await page.locator('#wsLoginBtn').waitFor({ state: 'visible' });
    await page.evaluate(() => window.showView('library'));
    await page.evaluate(() => window.showView('game')); await page.locator('#authModal').waitFor({ state: 'visible' });
    await page.goBack(); await page.locator('#dashView').waitFor({ state: 'visible' });
    await login();
    assert(await page.locator('#dashView').isVisible()); assert(!(await page.locator('#gameCard').isVisible()));
    console.log('  PASS login after browser Back does not resume the abandoned game');

    await page.click('#wsLogoutBtn'); await page.locator('#wsLoginBtn').waitFor({ state: 'visible' });
    await page.evaluate(() => window.showView('game')); await page.locator('#authModal').waitFor({ state: 'visible' });
    await login();
    assert(await page.locator('#gameCard').isVisible()); assert.deepEqual(errors, []);
    console.log('  PASS login without changing navigation still resumes the requested game');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
