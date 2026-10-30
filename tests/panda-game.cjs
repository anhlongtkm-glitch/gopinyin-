'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright-core');
const { register } = require('./helpers/supabase-fixture.cjs');
const URL = process.env.TEST_URL || 'http://localhost:8080/';
const output = path.resolve(__dirname, '../.cache/panda-game');
fs.mkdirSync(output, { recursive:true });
const check = text => console.log('  PASS ' + text);

(async () => {
  const browser = await chromium.launch({ executablePath:process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless:true, args:['--autoplay-policy=no-user-gesture-required'] });
  const page = await browser.newPage({ viewport:{ width:1440, height:950 } });
  const errors = [];
  const missing = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('response', response => { if (response.status() >= 400 && response.url().startsWith(URL)) missing.push(response.status() + ' ' + new global.URL(response.url()).pathname); });
  try {
    await page.goto(URL);
    await register(page, 'Panda pilot');
    await page.evaluate(() => window.showView('games'));
    await page.waitForFunction(() => document.querySelector('.pdHubShip').naturalWidth > 0);
    await page.evaluate(() => window.showView('game'));
    await page.locator('#gameCard').waitFor({ state:'visible' });
    assert.equal(await page.locator('[data-topic]').count(), 14);
    await page.fill('#pdTopicSearch', 'thoi tiet');
    assert.equal(await page.locator('[data-topic]').count(), 1);
    assert(await page.locator('[data-topic="weather"]').isVisible());
    await page.fill('#pdTopicSearch', '');
    assert.equal(await page.locator('#gaLevels').count(), 0);
    assert.match(await page.locator('#wsViewTitle').innerText(), /Panda Du Hành/);
    assert.equal(await page.locator('.pdAdNote').count(), 0);
    await page.check('#pdReadyPinyin');
    assert.equal(await page.evaluate(() => window.__game._state.showPinyin), true);
    assert(await page.evaluate(() => document.querySelector('#pdShipImage').complete && document.querySelector('#pdShipImage').naturalWidth > 0));
    await page.screenshot({ path:path.join(output, 'desktop-ready.png') });
    check('fourteen searchable topic planets, new name and real rear-facing ship replace the HSK game');

    await page.click('[data-topic="food"]');
    assert.equal(await page.evaluate(() => window.__game._state.topicId), 'food');
    assert(await page.locator('#pdReadyPinyin').isChecked());
    await page.uncheck('#pdReadyPinyin');
    await page.evaluate(() => { window.adCalls = 0; window.__pandaAds = { showPreroll:async () => { window.adCalls++; } }; });
    await page.locator('#gaStartBtn').dblclick();
    await page.waitForFunction(() => window.__game._state.running);
    assert.equal(await page.evaluate(() => window.adCalls), 1);
    assert.equal(await page.evaluate(() => window.__game._state.lives), 3);
    assert(await page.evaluate(() => window.__game._state.items.every(item => item.src.id.startsWith('food:'))));
    check('double Play requests one preroll, starts one timed run and uses only the selected topic');

    await page.click('#gaPyBtn');
    assert.equal(await page.evaluate(() => window.__game._state.showPinyin), true);
    assert.equal(await page.locator('#gaPyBtn').getAttribute('aria-pressed'), 'true');
    await page.locator('#gaStage').focus();
    await page.keyboard.press('Enter');
    assert.equal(await page.evaluate(() => window.__game._state.showPinyin), false);
    const target = await page.evaluate(() => window.__game._state.items.find(item => !item.caught).src.pyPlain);
    await page.keyboard.type(target.slice(0, 1));
    assert.equal(await page.evaluate(() => window.__game._state.buffer), target[0]);
    await page.keyboard.type(target.slice(1));
    assert.equal(await page.evaluate(() => window.__game._state.wordsDone), 1);
    assert(await page.evaluate(() => window.__game._state.score > 0));
    await page.evaluate(() => window.__game._update(12));
    await page.screenshot({ path:path.join(output, 'desktop-playing.png') });
    check('Pinyin button and Enter agree; actual typing locks, shoots, completes a word and scores');

    await page.click('#gaKbdBtn');
    await page.locator('#vkbd').waitFor({ state:'visible' });
    await page.waitForFunction(() => document.getElementById('vkbd').getBoundingClientRect().bottom <= innerHeight + 1);
    assert(await page.locator('#vkbd [data-vk="next"]').isHidden());
    await page.click('#vkbd [data-vk="hint"]');
    assert.equal(await page.evaluate(() => window.__game._state.showPinyin), true);
    await page.click('#vkbd [data-vk="hint"]');
    assert.equal(await page.evaluate(() => window.__game._state.showPinyin), false);
    assert.equal(await page.evaluate(() => window.__game.nextKey()), '');
    await page.click('#vkbd [data-vk="hide"]');
    check('virtual keyboard toggles Pinyin and cannot leak next-letter hints while it is hidden');

    await page.evaluate(() => window.__game.togglePause());
    const frozen = await page.evaluate(() => window.__game._state.elapsed);
    await page.waitForTimeout(180);
    assert.equal(await page.evaluate(() => window.__game._state.elapsed), frozen);
    await page.click('[data-pd="resume"]');
    await page.evaluate(() => { window.__game._state.lives = 100; window.__game._update(90); });
    await page.locator('[data-pd="topics"]').waitFor({ state:'visible' });
    assert.match(await page.locator('#gaOverlay').innerText(), /Chính xác khi gõ/);
    assert.equal(await page.evaluate(() => window.__game._state.elapsed), 90);
    await page.screenshot({ path:path.join(output, 'desktop-results.png') });
    check('pause freezes the clock and the final results include actual typing metrics and review');

    const mainResult = await page.evaluate(() => {
      const key = Object.keys(localStorage).find(key => key.startsWith('gp:account-cache:'));
      return Object.values(JSON.parse(localStorage.getItem(key))).find(row => row.record_id === 'gopinyin:game:lastResult')?.payload;
    });
    const reviewIds = await page.evaluate(() => window.__game._state.review.map(row => row.id));
    assert(reviewIds.length > 0);
    await page.click('[data-pd="review"]');
    await page.click('[data-pd="practice-review"]');
    await page.waitForFunction(() => window.__game._state.running);
    const reviewRun = await page.evaluate(() => ({ isReview:window.__game._state.isReview, mode:window.__game._state.mode, ids:window.__game._state.pool.map(word => word.id) }));
    assert.equal(reviewRun.isReview, true);
    assert.equal(reviewRun.mode, 'practice');
    assert.deepEqual(reviewRun.ids.sort(), [...reviewIds].sort());
    await page.evaluate(() => {
      const game = window.__game._state;
      for (const ch of game.items.find(item => !item.caught).src.pyPlain) window.__game.typeChar(ch);
      game.lives = 100; window.__game._update(90);
    });
    assert.equal(await page.evaluate(() => window.__game._state.newRecord), false);
    const preservedResult = await page.evaluate(() => {
      const key = Object.keys(localStorage).find(key => key.startsWith('gp:account-cache:'));
      return Object.values(JSON.parse(localStorage.getItem(key))).find(row => row.record_id === 'gopinyin:game:lastResult')?.payload;
    });
    assert.equal(preservedResult, mainResult);
    check('review flights repeat only the selected weak words and preserve the main run result and record');

    await page.click('[data-pd="topics"]');
    await page.click('[data-mode="challenge"]');
    assert(await page.locator('#pdReadyPinyin').isDisabled());
    assert(await page.locator('#gaPyBtn').isDisabled());
    await page.evaluate(() => window.__game.togglePinyin());
    assert.equal(await page.evaluate(() => window.__game._state.showPinyin), false);
    await page.click('#gaStartBtn');
    await page.waitForFunction(() => window.__game._state.running);
    await page.locator('#gaStage').focus();
    await page.keyboard.press('Enter');
    assert.equal(await page.evaluate(() => window.__game._state.showPinyin), false);
    assert.equal(await page.evaluate(() => window.__game.nextKey()), '');
    await page.evaluate(() => window.__game.togglePause());
    assert.equal(await page.evaluate(() => window.__game._state.mode), 'practice');
    assert(await page.evaluate(() => window.__game._state.interruptedChallenge));
    check('challenge locks every Pinyin entry point and pausing converts the run to practice');

    await page.evaluate(() => window.showView('games'));
    await page.evaluate(() => window.showView('game'));
    await page.locator('[data-pd="resume-flight"]').waitFor({ state:'visible' });
    await page.click('[data-pd="topics"]');
    await page.evaluate(() => { window.__pandaAds = { showPreroll:() => new Promise(resolve => { window.resolveLateAd = resolve; }) }; });
    await page.click('#gaStartBtn');
    await page.locator('[data-pd="cancel"]').waitFor({ state:'visible' });
    await page.click('[data-pd="cancel"]');
    await page.evaluate(() => window.resolveLateAd());
    await page.waitForTimeout(150);
    assert.equal(await page.evaluate(() => window.__game._state.running), false);
    assert(await page.locator('#gaStartBtn').isVisible());
    check('cancelled ads ignore late completion without unexpectedly starting another game');

    await page.evaluate(() => { window.__pandaAds = null; });
    await page.click('[data-mode="practice"]');
    await page.click('[data-topic="family"]');
    assert.equal(await page.locator('.pdAdNote').count(), 0);
    for (const width of [360,390,768]) {
      await page.setViewportSize({ width, height:844 });
      const overflow = await page.evaluate(() => ({ width:innerWidth, scroll:document.documentElement.scrollWidth, nodes:[...document.querySelectorAll('#gameCard *')].filter(el => el.getBoundingClientRect().right > innerWidth + 1).slice(0,8).map(el => ({ tag:el.tagName, cls:el.className, w:el.getBoundingClientRect().width, right:el.getBoundingClientRect().right })) }));
      await page.screenshot({ path:path.join(output, 'layout-' + width + '.png') });
      assert(overflow.scroll <= overflow.width + 1, JSON.stringify(overflow));
      await page.locator('#gaStartBtn').scrollIntoViewIfNeeded();
      assert(await page.locator('#gaStartBtn').isVisible());
      await page.screenshot({ path:path.join(output, 'ready-' + width + '.png') });
    }
    await page.setViewportSize({ width:390, height:844 });
    await page.click('#gaStartBtn');
    await page.waitForFunction(() => window.__game._state.running);
    await page.evaluate(() => window.__game._update(12));
    const dimensions = await page.evaluate(() => {
      const ship = document.getElementById('gaPlayer').getBoundingClientRect(), stage = document.getElementById('gaStage').getBoundingClientRect();
      return { ratio:ship.height/stage.height, shipInside:ship.top>=stage.top && ship.bottom<=stage.bottom, stageHeight:stage.height };
    });
    assert(dimensions.ratio < .18 && dimensions.shipInside, JSON.stringify(dimensions));
    await page.screenshot({ path:path.join(output, 'mobile-playing.png') });
    await page.click('#gaKbdBtn');
    await page.locator('#vkbd').waitFor({ state:'visible' });
    await page.waitForFunction(() => document.getElementById('vkbd').getBoundingClientRect().bottom <= innerHeight + 1);
    const keyboard = await page.evaluate(() => ({ ship:document.getElementById('gaPlayer').getBoundingClientRect().bottom, keyboard:document.getElementById('vkbd').getBoundingClientRect().top }));
    assert(keyboard.ship <= keyboard.keyboard, JSON.stringify(keyboard));
    await page.screenshot({ path:path.join(output, 'mobile-keyboard.png') });
    check('360/390/768px layouts stay within the viewport and the small ship fits above the virtual keyboard');
    await page.click('#vkbd [data-vk="hide"]');
    await page.setViewportSize({ width:1440, height:950 });
    await page.evaluate(() => {
      const active = window.__game._state.items.filter(item => !item.caught).sort((a,b) => b.y-a.y)[0];
      if (active) for (const ch of active.src.pyPlain.slice(0, Math.min(2, active.src.pyPlain.length-1))) window.__game.typeChar(ch);
    });
    await page.click('#gaPyBtn');
    await page.waitForTimeout(200);
    await page.screenshot({ path:path.join(output, 'family-desktop-playing.png') });
    assert.deepEqual(errors, []);
    assert.deepEqual(missing, []);
    check('game assets load and no runtime exceptions occur');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
