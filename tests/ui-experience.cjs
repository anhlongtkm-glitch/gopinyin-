'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright-core');
const { register } = require('./helpers/supabase-fixture.cjs');
const { POSES } = require('../scripts/prepare-mascots.cjs');

const URL = process.env.TEST_URL || 'http://localhost:8080/';
const output = path.resolve('.cache/ui-experience');
const testRows = [
  { id: 0, zh: '你好。', py: 'nǐ hǎo', vi: 'Xin chào.' },
  { id: 1, zh: '谢谢。', py: 'xiè xie', vi: 'Cảm ơn.' },
  { id: 2, zh: '再见。', py: 'zài jiàn', vi: 'Tạm biệt.' }
];

async function putLesson(page, id, rows = testRows) {
  await page.evaluate(async ({ id, rows }) => {
    await window.dbPut({ id, name: 'Bài kiểm tra trải nghiệm', rows, createdAt: Date.now(), updatedAt: Date.now() });
    await window.openDataset(id);
    window.autoSound = false; window.readOnType = false;
  }, { id, rows });
  await page.locator('#appCard').waitFor({ state: 'visible' });
}

async function controlViewport(page, selector) {
  return page.locator(selector).evaluate(element => {
    const rect = element.getBoundingClientRect(), viewport = window.visualViewport;
    const top = viewport?.offsetTop || 0, bottom = top + (viewport?.height || innerHeight);
    const header = document.getElementById('topBar').getBoundingClientRect();
    const nav = document.querySelector('.mobile-nav');
    const navTop = nav?.getClientRects().length ? nav.getBoundingClientRect().top : bottom;
    return { top: rect.top, bottom: rect.bottom, safeTop: Math.max(top, header.bottom), safeBottom: Math.min(bottom, navTop), focused: element === document.activeElement };
  });
}

async function captureStudy(page, screen) {
  const previous = page.viewportSize();
  // The artifact describes the study layout; transient registration/import toasts
  // are removed only while capturing and restored before the next assertion.
  const toastStyle = await page.addStyleTag({ content: '#toastHost{display:none!important}' });
  try {
    for (const [device, viewport] of [['mobile', { width: 390, height: 844 }], ['desktop', { width: 1440, height: 900 }]]) {
      await page.setViewportSize(viewport);
      await page.waitForTimeout(100);
      await page.locator('.studyShell:visible .mascot-image').evaluateAll(images => Promise.all(images.map(image => image.decode().catch(() => {}))));
      if (device === 'mobile') {
        const selector = screen.startsWith('typing') ? '#pinyinInput' : '#pronMicBtn';
        await page.locator(selector).scrollIntoViewIfNeeded();
        const bounds = await controlViewport(page, selector);
        if (bounds.bottom > bounds.safeBottom - 12) await page.evaluate(delta => window.scrollBy(0, delta), bounds.bottom - bounds.safeBottom + 12);
        else if (bounds.top < bounds.safeTop + 12) await page.evaluate(delta => window.scrollBy(0, delta), bounds.top - bounds.safeTop - 12);
      } else {
        await page.evaluate(() => window.scrollTo(0, 0));
        await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      }
      await page.screenshot({ path: path.join(output, screen + '-' + device + '.png'), fullPage: device === 'desktop' });
    }
  } finally {
    await toastStyle.evaluate(element => element.remove());
    await page.setViewportSize(previous);
  }
}

(async () => {
  fs.mkdirSync(output, { recursive: true });
  const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
  try {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
    await context.addInitScript(() => {
      // Fixture checks never access a real microphone or run remote speech synthesis.
      if (window.speechSynthesis) {
        speechSynthesis.speak = () => {};
        speechSynthesis.getVoices = () => [];
      }
    });
    const page = await context.newPage(), errors = [], initialAssets = new Map(), assetBodies = [], studyViewports = [];
    page.on('pageerror', error => errors.push(error.message));
    const observeAssets = response => {
      if (response.url().includes('/assets/mascot/')) {
        assetBodies.push(response.body().then(body => initialAssets.set(response.url(), body.length)));
      }
    };
    page.on('response', observeAssets);
    await page.goto(URL, { waitUntil: 'networkidle' });
    await Promise.all(assetBodies);
    page.off('response', observeAssets);
    assert(initialAssets.size > 0, 'Visible dashboard mascot should load');
    const initialBytes = [...initialAssets.values()].reduce((sum, bytes) => sum + bytes, 0);
    assert(initialBytes <= 300 * 1024, 'Mobile initial mascot transfer exceeds 300KB: ' + initialBytes);
    await page.waitForFunction(() => [...document.querySelectorAll('#dashView .mascot-image')].some(image => image.complete && image.naturalWidth > 0));
    assert(await page.locator('.mobile-nav').isVisible());
    assert.equal(await page.locator('.mobile-nav [data-mobile-view]').count(), 4);
    assert.equal(await page.locator('#mobileMoreBtn').getAttribute('aria-expanded'), 'false');
    console.log('  PASS mobile starts with labeled navigation and decoded mascot assets within 300KB');

    // The fixture registration helper uses the desktop account control.
    await page.setViewportSize({ width: 1440, height: 900 });
    await register(page, 'Mascot experience learner');
    await page.click('#topBar [data-view="rank"]');
    await page.locator('#rankCard').waitFor({ state: 'visible' });
    assert(await page.locator('#topBar [data-view="rank"]').evaluate(element => element.classList.contains('active')));
    assert.equal(await page.locator('#rankCard h2').textContent(), 'Học đều đặn. Vươn lên từng ngày.');
    await page.evaluate(() => window.showView('dash'));
    await page.setViewportSize({ width: 390, height: 844 });
    await page.click('.mobile-nav [data-mobile-view="practice"]');
    await page.locator('#libraryCard').waitFor({ state: 'visible' });
    await page.fill('#vocabSearch', 'HSK');
    await page.click('#vocabList [data-vsrc="hsk1"]');
    await page.locator('#appCard').waitFor({ state: 'visible' });
    assert.equal(await page.evaluate(() => window.activeDataset.id), 'vocab:hsk1');
    await page.click('#appBackBtn');
    await page.locator('#libraryCard').waitFor({ state: 'visible' });
    assert.equal(await page.locator('#vocabSearch').inputValue(), 'HSK');
    assert.equal(await page.locator('[data-vtab].active').getAttribute('data-vtab'), 'hsk');
    await putLesson(page, 'ui-experience');
    await page.waitForFunction(() => document.activeElement === document.getElementById('pinyinInput'));
    await page.waitForTimeout(60);
    const inputBounds = await controlViewport(page, '#pinyinInput');
    assert(inputBounds.focused && inputBounds.top >= inputBounds.safeTop - 1 && inputBounds.bottom <= inputBounds.safeBottom + 1, 'Initial typing input must remain above mobile navigation: ' + JSON.stringify(inputBounds));
    studyViewports.push({ control: 'pinyinInput', ...inputBounds });
    assert(await page.locator('#typingNextBtn').isDisabled());
    assert.equal(await page.locator('#typingSettings').getAttribute('open'), null);
    console.log('  PASS primary mobile navigation and a catalog card enter their destinations directly');
    console.log('  PASS initial typing autofocus keeps the complete input inside the mobile safe viewport');

    const firstCharacter = await page.evaluate(() => [...window.currentRow().zh].find(character => /[\u3400-\u9fff]/.test(character)));
    await page.fill('#pinyinInput', firstCharacter);
    const beforeSettings = await page.evaluate(() => ({ index: window.index, value: document.getElementById('pinyinInput').value, hash: location.hash, correct: window.stats.correct }));
    await page.locator('#typingOptionsBtn').focus();
    await page.keyboard.press('Enter');
    assert(await page.locator('#typingSettings').evaluate(element => element.open));
    await page.locator('#typingSettings [data-settings-tab="audio"]').focus();
    await page.keyboard.press('Enter');
    await page.selectOption('#rateSelect', '1');
    await page.keyboard.press('Escape');
    assert(!(await page.locator('#typingSettings').evaluate(element => element.open)));
    await page.locator('#typingOptionsBtn').focus();
    await page.keyboard.press('Space');
    assert(await page.locator('#typingSettings').evaluate(element => element.open));
    await page.locator('#typingSettings [data-settings-close]').last().focus();
    await page.keyboard.press('Space');
    assert(!(await page.locator('#typingSettings').evaluate(element => element.open)));
    assert.deepEqual(await page.evaluate(() => ({ index: window.index, value: document.getElementById('pinyinInput').value, hash: location.hash, correct: window.stats.correct })), beforeSettings);
    assert.equal(await page.locator('#rateSelect').inputValue(), '1');
    console.log('  PASS settings support native Enter/Space without advancing the lesson or clearing input');

    await page.click('#mobileMoreBtn');
    await page.locator('#mobileMoreModal').waitFor({ state: 'visible' });
    await page.waitForTimeout(220);
    assert(await page.evaluate(() => document.getElementById('mobileMoreModal').contains(document.activeElement)), 'Overlay must retain focus after delayed lesson autofocus');
    for (let i = 0; i < 10; i++) {
      await page.keyboard.press(i % 3 ? 'Tab' : 'Shift+Tab');
      assert(await page.evaluate(() => document.getElementById('mobileMoreModal').contains(document.activeElement)), 'Tab escaped More dialog');
    }
    assert.deepEqual(await page.evaluate(() => ({ index: window.index, value: document.getElementById('pinyinInput').value, hash: location.hash, correct: window.stats.correct })), beforeSettings);
    await page.keyboard.press('Escape');
    await page.locator('#mobileMoreModal').waitFor({ state: 'hidden' });
    assert.equal(await page.evaluate(() => document.activeElement.id), 'mobileMoreBtn');
    console.log('  PASS More traps focus, preserves the lesson, and returns focus on Escape');

    await page.click('#mobileMoreBtn');
    await page.click('#mobileAccountBtn');
    await page.locator('#profileModal').waitFor({ state: 'visible' });
    await page.waitForFunction(() => document.getElementById('profileModal').contains(document.activeElement));
    assert(await page.locator('#mobileMoreModal').isHidden());
    await page.keyboard.press('Escape');
    await page.locator('#profileModal').waitFor({ state: 'hidden' });
    assert.equal(await page.evaluate(() => document.activeElement.id), 'mobileMoreBtn');
    assert.deepEqual(await page.evaluate(() => ({ index: window.index, value: document.getElementById('pinyinInput').value, hash: location.hash, correct: window.stats.correct })), beforeSettings);
    console.log('  PASS account opened from More returns focus to the visible mobile trigger without changing the lesson');

    const repeatedRow = await page.evaluate(() => window.currentRow().id);
    for (let attempt = 0; attempt < 3; attempt++) {
      if (attempt) {
        await page.click('#retrySentenceBtn');
        assert(await page.locator('#typingNextBtn').isDisabled());
        assert.equal(await page.locator('#typingStudyMascot').getAttribute('data-mascot'), 'reading');
      }
      await page.fill('#pinyinInput', await page.evaluate(() => window.currentRow().zh));
      await page.waitForFunction(() => !document.getElementById('typingNextBtn').disabled);
      assert.equal(await page.evaluate(() => window.currentRow().id), repeatedRow);
      assert.equal(await page.locator('#typingStudyMascot').getAttribute('data-mascot'), 'approve');
      assert.equal(await page.locator('#typingFeedbackMascot').getAttribute('data-mascot'), 'face-happy');
    }
    console.log('  PASS three correct/retry attempts each update the mascot without advancing the current sentence');
    const correctState = await page.evaluate(() => ({ index: window.index, correct: window.stats.correct }));
    await captureStudy(page, 'typing-correct');
    await page.locator('#typingNextBtn').evaluate(button => { button.click(); button.click(); });
    assert.equal(await page.evaluate(() => window.index), correctState.index + 1);
    assert.equal(await page.evaluate(() => window.stats.correct), correctState.correct);
    assert(await page.locator('#typingNextBtn').isDisabled());
    await page.waitForTimeout(200);
    console.log('  PASS visible Next advances exactly once after a correct answer under rapid activation');

    const savedNext = await page.evaluate(() => window.currentRow().id);
    await page.click('.mobile-nav [data-mobile-view="dash"]');
    await page.waitForFunction(() => document.getElementById('dashContinueBtn').dataset.datasetId === 'ui-experience');
    await page.click('#dashContinueBtn');
    await page.locator('#appCard').waitFor({ state: 'visible' });
    assert.equal(await page.evaluate(() => window.activeDataset.id), 'ui-experience');
    assert.equal(await page.evaluate(() => window.currentRow().id), savedNext);
    console.log('  PASS Dashboard Continue resumes the exact next saved question in one action');

    // Launching a lesson and opening a dialog in the same task catches its delayed autofocus.
    await page.evaluate(async () => { await window.openDataset('ui-experience'); document.getElementById('mobileMoreBtn').click(); });
    await page.locator('#mobileMoreModal').waitFor({ state: 'visible' });
    await page.waitForTimeout(250);
    assert(await page.evaluate(() => document.getElementById('mobileMoreModal').contains(document.activeElement)));
    await page.keyboard.press('Escape');
    await putLesson(page, 'ui-last-item', [testRows[0]]);
    await page.fill('#pinyinInput', testRows[0].zh);
    await page.waitForFunction(() => !document.getElementById('typingNextBtn').disabled);
    await page.click('#typingNextBtn');
    await page.locator('#completeArea').waitFor({ state: 'visible' });
    assert.equal(await page.evaluate(() => window.stats.correct), 1);
    console.log('  PASS new lesson focus cannot steal an overlay and final-item Next opens completion');

    await page.click('.mobile-nav [data-mobile-view="dash"]');
    await page.locator('#dashView').waitFor({ state: 'visible' });
    await page.click('#mobileMoreBtn');
    await page.click('#mobileMoreModal [data-more-view="ai"]');
    await page.locator('#aiCard').waitFor({ state: 'visible' });
    assert(await page.locator('#mobileMoreModal').isHidden());
    await page.click('.mobile-nav [data-mobile-view="rank"]');
    await page.locator('#rankCard').waitFor({ state: 'visible' });
    assert.equal(await page.locator('.mobile-nav [data-mobile-view="rank"]').getAttribute('aria-current'), 'page');
    assert.equal(await page.locator('#rankCard h2').textContent(), 'Học đều đặn. Vươn lên từng ngày.');
    await page.click('#mobileMoreBtn');
    await page.click('#mobileMoreModal [data-more-view="games"]');
    await page.locator('#gamesCard').waitFor({ state: 'visible' });
    console.log('  PASS rankings open directly from mobile navigation while secondary destinations remain in More');

    await page.evaluate(() => window.showView('game'));
    await page.locator('#gameCard').waitFor({ state: 'visible' });
    await page.waitForFunction(() => window.__game._state.pool.length > 0);
    await page.evaluate(() => window.__game.startGame());
    await page.waitForFunction(() => window.__game._state.running);
    await page.click('#mobileMoreBtn');
    assert(await page.evaluate(() => window.__game._state.paused));
    await page.keyboard.press('Escape');
    assert.equal(await page.evaluate(() => window.__game._state.paused), false);
    await page.evaluate(() => window.__game.togglePause());
    await page.click('#mobileMoreBtn');
    await page.keyboard.press('Escape');
    assert(await page.evaluate(() => window.__game._state.paused), 'Dismissal must preserve a pre-existing pause');
    await page.click('#mobileMoreBtn');
    await page.setViewportSize({ width: 1440, height: 900 });
    assert(await page.locator('#mobileMoreModal').isHidden());
    await page.evaluate(() => window.showView('dash'));
    console.log('  PASS More owns only its game pause and closes on desktop resize');

    await page.setViewportSize({ width: 390, height: 844 });
    await page.evaluate(async () => { await window.showView('pron'); await window.__pron.start('hsk:hsk1'); });
    await page.locator('#pronCard').waitFor({ state: 'visible' });
    await page.waitForTimeout(100);
    const micBounds = await controlViewport(page, '#pronMicBtn');
    assert(micBounds.top >= micBounds.safeTop - 1 && micBounds.bottom <= micBounds.safeBottom + 1, 'Initial pronunciation microphone must fit the mobile safe viewport: ' + JSON.stringify(micBounds));
    studyViewports.push({ control: 'pronMicBtn', ...micBounds });
    console.log('  PASS initial pronunciation render keeps the complete microphone control above mobile navigation');
    await captureStudy(page, 'pronunciation-ready');
    await page.evaluate(() => window.showView('dash'));

    // Verify packaged masters decode with alpha, rather than trusting a file suffix.
    const decoded = await page.evaluate(async poses => {
      const results = [];
      for (const pose of poses) {
        const image = new Image(); image.src = 'assets/mascot/' + pose + '.webp'; await image.decode();
        const canvas = document.createElement('canvas'); canvas.width = image.naturalWidth; canvas.height = image.naturalHeight;
        const context = canvas.getContext('2d', { willReadFrequently: true }); context.drawImage(image, 0, 0);
        const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
        let transparent = 0, visible = 0;
        for (let i = 3; i < pixels.length; i += 4) { if (pixels[i] < 16) transparent++; if (pixels[i] > 128) visible++; }
        results.push({ pose, width: image.naturalWidth, transparent, visible });
      }
      return results;
    }, POSES);
    for (const asset of decoded) {
      assert.equal(asset.width, asset.pose.startsWith('face-') ? 256 : 512);
      assert(asset.transparent > 0 && asset.visible > 0, asset.pose + ' must preserve transparent character art');
      assert(fs.existsSync(path.resolve('assets/mascot/' + asset.pose + '-small.webp')));
    }
    console.log('  PASS all 16 poses and six face expressions decode at the expected size with alpha');

    const layouts = [];
    for (const theme of ['light', 'dark']) for (const width of [360, 390, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: width <= 390 ? 844 : 900 });
      await page.evaluate(theme => window.applyTheme(theme), theme);
      for (const view of ['dash', 'library', 'pron', 'ai', 'rank', 'games']) {
        await page.evaluate(view => window.showView(view), view);
        await page.waitForTimeout(60);
        const result = await page.evaluate(() => ({ width: innerWidth, scrollWidth: document.documentElement.scrollWidth, headerPosition: getComputedStyle(document.getElementById('topBar')).position }));
        assert(result.scrollWidth <= result.width + 1, `${theme}/${width}/${view} overflows horizontally`);
        assert.equal(result.headerPosition, 'sticky');
        layouts.push({ theme, width, view, ...result });
      }
      await page.evaluate(() => window.showView('dash'));
      await page.screenshot({ path: path.join(output, theme + '-' + width + '-dashboard.png'), fullPage: true });
    }
    fs.writeFileSync(path.join(output, 'acceptance.json'), JSON.stringify({ initialMascotBytes: initialBytes, studyViewports, assets: decoded, layouts, errors }, null, 2) + '\n');
    assert.deepEqual(errors, []);
    console.log('  PASS all six screens fit five widths in both themes with sticky headers and no browser errors');
    await context.close();
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
