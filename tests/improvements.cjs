'use strict';
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const { chromium } = require('playwright-core');
const { register } = require('./helpers/supabase-fixture.cjs');

(async () => {
  const output = path.resolve('.cache/review-unit.cjs');
  await require('esbuild').build({ entryPoints: ['src/features/typing/review.js'], bundle: true, platform: 'node', format: 'cjs', outfile: output });
  const { nextReview, selectReviewRows } = require(output);
  const now = 1000000, first = nextReview(null, true, now), second = nextReview(first, true, now);
  assert.equal(first.dueAt - now, 86400000); assert.equal(second.intervalDays, 3);
  assert.equal(nextReview(second, false, now).dueAt - now, 600000);
  assert.deepEqual(selectReviewRows([{ id: 1 }, { id: 2 }, { id: 3 }], { 1: { dueAt: now - 1 }, 2: { dueAt: now + 1 } }, [], 'due', now), [0]);
  assert.deepEqual(selectReviewRows([{ id: 1 }, { id: 2 }], {}, ['2'], 'weak', now), [1]);
  assert.equal(selectReviewRows(Array.from({ length: 30 }, (_, id) => ({ id })), {}, Array.from({ length: 30 }, (_, id) => id), 'weak', now).length, 20);
  console.log('  PASS review schedule: successful intervals, lapse, due filter, mixed IDs, 20-item limit');

  const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } }), errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.goto(process.env.TEST_URL, { waitUntil: 'networkidle' });
    assert.equal(await page.locator('[data-catalog-sentences]').textContent(), '4.969', 'HSK total must exclude 43 tone-pair exercises');
    await page.evaluate(() => localStorage.setItem('cts:progress:legacy', JSON.stringify({ mainIndex: 999, stats: { correct: 999, combo: 999 } })));
    await register(page, 'Roadmap learner');
    await page.click('.ws-navItem[data-view="library"]'); await page.click('[data-vsrc="hsk1"]');
    await page.locator('#appCard').waitFor({ state: 'visible' });
    await page.evaluate(() => { window.index = 3; window.stats = { correct: 7, wrong: 1, combo: 2, bestCombo: 9, attempts: 8 }; window.save(); });
    await page.waitForFunction(() => document.querySelector('#accountSyncStatus').textContent === 'Đã đồng bộ');
    await page.evaluate(() => window.showView('dash'));
    await page.waitForFunction(() => document.querySelector('#dashCombo').textContent === '9');
    assert.equal(await page.locator('#dashLearned').textContent(), '3');
    assert.equal(await page.locator('#dashAcc').textContent(), '88%');
    console.log('  PASS dashboard uses account progress and best combo; legacy storage excluded');

    await page.click('.ws-navItem[data-view="library"]'); await page.click('[data-vsrc="hsk1"]');
    await page.locator('#appCard').waitFor({ state: 'visible' });
    await page.reload({ waitUntil: 'networkidle' });
    await page.locator('#appCard').waitFor({ state: 'visible' });
    assert.equal(await page.locator('#authModal').isVisible(), false);
    assert.equal(await page.evaluate(() => window.index), 3);
    console.log('  PASS study deep link restores lesson and session after reload');

    await page.click('.ws-navItem[data-view="library"]'); await page.click('.ws-navItem[data-view="ai"]');
    await page.goBack(); await page.locator('#libraryCard').waitFor({ state: 'visible' });
    await page.goForward(); await page.locator('#aiCard').waitFor({ state: 'visible' });
    await page.focus('#aiStartBtn');
    await page.evaluate(() => { window.appConfirm('Kiểm tra bàn phím'); });
    await page.locator('#appModalOk').focus(); await page.keyboard.press('Tab');
    assert.equal(await page.evaluate(() => document.activeElement.id), 'appModalCancel');
    await page.keyboard.press('Escape');
    assert.equal(await page.evaluate(() => document.activeElement.id), 'aiStartBtn');
    console.log('  PASS Back/Forward and modal Tab/Escape restore focus');

    await page.click('.ws-navItem[data-view="library"]'); await page.click('[data-vsrc="hsk1"]');
    await page.locator('#appCard').waitFor({ state: 'visible' });
    await page.evaluate(() => { window.markSentenceWrong(); });
    await page.waitForFunction(() => document.querySelector('#accountSyncStatus').textContent === 'Đã đồng bộ');
    await page.evaluate(() => window.showView('dash'));
    await page.waitForFunction(() => !document.querySelector('#dashWeakBtn').disabled);
    assert.equal(await page.locator('#dashWeakCount').textContent(), '1');
    await page.click('#dashWeakBtn'); await page.locator('#appCard').waitFor({ state: 'visible' });
    assert.equal(await page.evaluate(() => window.order.length), 1);
    await page.evaluate(() => window.markSentenceCorrect());
    await page.waitForFunction(() => document.querySelector('#accountSyncStatus').textContent === 'Đã đồng bộ');
    await page.evaluate(() => window.showView('dash'));
    await page.waitForFunction(() => document.querySelector('#dashWeakBtn').disabled);
    assert.equal(await page.locator('#dashLearned').textContent(), '3');
    console.log('  PASS weak-item review persists without overwriting main lesson position');

    fs.mkdirSync('.cache/roadmap', { recursive: true });
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 900 });
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
      await page.screenshot({ path: `.cache/roadmap/dashboard-${width}.png`, fullPage: true });
    }
    await page.click('#wsLogoutBtn'); await page.waitForFunction(() => document.querySelector('#wsLoginBtn').hidden === false);
    await register(page, 'Another learner');
    assert.equal(await page.locator('#dashLearned').textContent(), '0');
    assert.equal(await page.locator('#dashAcc').textContent(), '—');
    assert.equal(await page.locator('#dashWeakBtn').isDisabled(), true);
    assert.deepEqual(errors, []);
    console.log('  PASS account switch clears statistics and review; desktop/mobile layout has no overflow');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
