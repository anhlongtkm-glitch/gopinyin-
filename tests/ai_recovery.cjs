'use strict';
const assert = require('node:assert/strict');
const { chromium } = require('playwright-core');
const { register } = require('./helpers/supabase-fixture.cjs');
const initial = [
  { zh: '茶叶', py: 'chá yè', vi: 'lá trà' }, { zh: '红茶', py: 'hóng chá', vi: 'trà đen' },
  { zh: '绿茶', py: 'lǜ chá', vi: 'trà xanh' }, { zh: '白茶', py: 'bái chá', vi: 'trà trắng' },
  { zh: '茶水', py: 'chá shuǐ', vi: 'nước trà' }
];
const extra = [
  { zh: '杯子', py: 'bēi zi', vi: 'cốc' }, { zh: '牛奶', py: 'niú nǎi', vi: 'sữa bò' },
  { zh: '咖啡', py: 'kā fēi', vi: 'cà phê' }, { zh: '开水', py: 'kāi shuǐ', vi: 'nước đun sôi' },
  { zh: '果汁', py: 'guǒ zhī', vi: 'nước trái cây' }
];
const recovered = [
  { zh: '苹果', py: 'píng guǒ', vi: 'táo' }, { zh: '西瓜', py: 'xī guā', vi: 'dưa hấu' },
  { zh: '香蕉', py: 'xiāng jiāo', vi: 'chuối' }, { zh: '葡萄', py: 'pú tao', vi: 'nho' },
  { zh: '草莓', py: 'cǎo méi', vi: 'dâu tây' }
];
const fresh = [
  { zh: '橙子', py: 'chéng zi', vi: 'cam' }, { zh: '柠檬', py: 'níng méng', vi: 'chanh vàng' },
  { zh: '椰子', py: 'yē zi', vi: 'dừa' }, { zh: '桃子', py: 'táo zi', vi: 'đào' },
  { zh: '梨子', py: 'lí zi', vi: 'lê' }
];
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
  try {
    const page = await browser.newPage(), errors = [], requests = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(process.env.TEST_URL, { waitUntil: 'networkidle' });
    await register(page, 'AI recovery learner');
    let mode = 'initial', held;
    const respond = (route, words) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ text: JSON.stringify(words) }) });
    await page.route('**/api/ai', async route => {
      requests.push(route.request().postDataJSON());
      if (mode === 'hold') { held = route; return; }
      if (mode === 'quota') return route.fulfill({ status: 429, headers: { 'Retry-After': '30' }, contentType: 'application/json', body: JSON.stringify({ error: 'quota' }) });
      if (mode === 'network') return route.abort('failed');
      return respond(route, mode === 'fresh' ? fresh : mode === 'recovered' ? recovered : initial);
    });
    await page.evaluate(() => {window.APP_CONFIG.AI_PROXY_URL='/api/ai';return window.showView('ai');});
    assert(await page.locator('#aiProviderSetup').isHidden());
    assert.equal(await page.locator('#aiKey').inputValue(), '');
    await page.selectOption('#aiKind', 'word'); await page.fill('#aiPrompt', 'từ vựng đồ uống trong quán trà');
    await page.fill('#aiLessonName', 'Đồ uống AI');
    await page.click('#aiStartBtn');
    await page.locator('#appCard').waitFor({ state: 'visible' });
    assert.equal(requests.length, 1); assert.equal(requests[0].provider, 'gemini');
    assert.match(requests[0].prompt, /TỪ hoặc CỤM TỪ/); assert(!('key' in requests[0]));
    const savedId = await page.evaluate(() => window.activeDataset.id);
    assert.deepEqual(await page.evaluate(() => ({ type: window.activeDataset.contentType, batch: window.activeDataset.batch, provider: window.activeDataset.provider })), { type: 'word', batch: 5, provider: 'gemini' });
    console.log('  PASS shared AI creates a saved vocabulary set without a personal key');

    mode = 'hold';
    await page.evaluate(() => {
      window.index = 3; window.composing = true;
      const input = document.getElementById('pinyinInput'); input.value = '茶'; input.setSelectionRange(1, 1);
      window.__aiFill = window.aiMaybeFill(); window.aiMaybeFill();
    });
    await page.waitForFunction(() => window.aiSession.pending === 1);
    for (let i = 0; i < 100 && !held; i++) await page.waitForTimeout(20);
    assert(held); assert.equal(requests.length, 2); await respond(held, extra); held = null;
    await page.evaluate(() => window.__aiFill);
    assert.deepEqual(await page.evaluate(() => ({ total: window.rows.length, draft: document.getElementById('pinyinInput').value, caret: document.getElementById('pinyinInput').selectionStart, pending: window.aiSession.pending })), { total: 10, draft: '茶', caret: 1, pending: 0 });
    assert.match(requests[1].prompt, /茶叶/);
    console.log('  PASS one background request appends unique items without disturbing IME or caret');

    await page.evaluate(() => { window.composing = false; window.index = 8; window.save(); window.__aiFill = window.aiMaybeFill(); });
    for (let i = 0; i < 100 && !held; i++) await page.waitForTimeout(20);
    assert(held); await page.evaluate(() => window.showView('dash')); await respond(held, recovered); held = null;
    await page.evaluate(() => window.__aiFill);
    assert.equal(await page.evaluate(() => window.rows.length), 10);
    mode = 'quota';
    await page.evaluate(id => window.openDataset(id), savedId);
    await page.waitForFunction(() => window.aiSession?.stopped === true);
    assert.equal(requests.length, 4); assert(await page.locator('#aiRetryBtn').isVisible());
    assert.match(await page.locator('#aiGenBar').innerText(), /hết lượt AI miễn phí/);
    assert.equal(await page.evaluate(() => window.aiSession.kind), 'word');
    assert.equal(await page.evaluate(() => window.aiSession.batch), 5);
    assert.equal(await page.evaluate(() => window.index), 8);
    await page.evaluate(() => { window.aiMaybeFill(); window.aiMaybeFill(); });
    await page.click('#aiRetryBtn'); assert.equal(requests.length, 4);
    mode = 'recovered'; await page.evaluate(() => { window.aiSession.retryAt = Date.now() - 1; });
    await page.click('#aiRetryBtn'); await page.waitForFunction(() => window.rows.length === 15 && window.aiSession.pending === 0);
    assert.equal(requests.length, 5); assert.equal(await page.evaluate(() => window.aiSession.stopped), false);
    console.log('  PASS saved AI resumes its prompt and position, pauses on quota, and retries after the cooldown');

    mode = 'network';
    await page.evaluate(() => { window.index = 13; window.__aiFill = window.aiMaybeFill(); }); await page.evaluate(() => window.__aiFill);
    assert.equal(requests.length, 6); assert.match(await page.locator('#aiGenBar').innerText(), /Kiểm tra mạng/);
    await page.evaluate(() => { window.aiMaybeFill(); window.aiMaybeFill(); }); assert.equal(requests.length, 6);
    console.log('  PASS network failure stops automatic calls and keeps existing content with actionable Retry');

    mode = 'hold';
    await page.evaluate(() => { window.aiSession.stopped = false; window.__aiFill = window.aiMaybeFill(); });
    for (let i = 0; i < 100 && !held; i++) await page.waitForTimeout(20);
    assert(held); assert.equal(requests.length, 7);
    await page.click('#appCard [data-practice-mode="speaking"]'); await page.locator('#pronCard').waitFor({ state: 'visible' });
    assert.equal(await page.evaluate(() => window.aiSession.paused), true);
    await page.click('#pronCard [data-practice-mode="typing"]'); await page.locator('#appCard').waitFor({ state: 'visible' });
    assert.equal(requests.length, 7); assert.equal(await page.evaluate(() => window.aiSession.pending), 1);
    mode = 'fresh'; await respond(held, recovered); held = null;
    try { await page.waitForFunction(() => window.rows.length === 20 && window.aiSession.pending === 0); }
    catch (error) {
      console.error('AI mode recovery state', await page.evaluate(() => ({ rows: window.rows.length, index: window.index, pending: window.aiSession?.pending, paused: window.aiSession?.paused, stopped: window.aiSession?.stopped, live: window.aiSession?.live, sameRows: window.aiSession?.rows === window.rows, hidden: document.hidden, appHidden: document.getElementById('appCard').className, message: window.aiSession?.error?.message })), 'requests:', requests.length);
      throw error;
    }
    assert.equal(requests.length, 8); assert.equal(await page.evaluate(() => window.index), 13);
    console.log('  PASS switching Gõ/Nói cancels the old append and resumes after its pending slot is released');

    mode = 'hold';
    await page.evaluate(() => {
      Object.defineProperty(document, 'hidden', { configurable: true, get: () => !!window.__aiTestHidden });
      window.__aiTestHidden = true; document.dispatchEvent(new Event('visibilitychange'));
      window.index = 18; window.aiMaybeFill();
    });
    assert.equal(requests.length, 8);
    await page.evaluate(() => { window.__aiTestHidden = false; document.dispatchEvent(new Event('visibilitychange')); });
    for (let i = 0; i < 100 && !held; i++) await page.waitForTimeout(20);
    assert(held); assert.equal(requests.length, 9);
    await page.evaluate(() => window.showView('dash')); await respond(held, fresh); held = null;
    await page.waitForTimeout(100); assert.equal(await page.evaluate(() => window.rows.length), 20);
    console.log('  PASS hidden documents spend no new AI quota and resume only in the active typing lesson');
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
