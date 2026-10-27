'use strict';
const assert = require('node:assert/strict');
const { chromium } = require('playwright-core');
const { register } = require('./helpers/supabase-fixture.cjs');

const URL = process.env.TEST_URL || 'http://localhost:8080/';
const rows = [
  { id: 0, zh: '你好。', py: 'nǐ hǎo', vi: 'Xin chào.' },
  { id: 1, zh: '谢谢。', py: 'xiè xie', vi: 'Cảm ơn.' },
  { id: 2, zh: '再见。', py: 'zài jiàn', vi: 'Tạm biệt.' }
];

async function typingState(page) {
  return page.evaluate(() => ({
    index: window.index,
    row: window.currentRow()?.zh,
    value: document.getElementById('pinyinInput').value,
    pinyin: document.getElementById('chinese').classList.contains('show-pinyin'),
    han: window.showHanzi,
    vi: window.showVietnamese,
    correct: window.stats.correct,
    wrong: window.stats.wrong
  }));
}

async function keyboardEvent(page, overrides) {
  return page.evaluate(overrides => {
    const event = new KeyboardEvent('keydown', { key: '2', code: 'Digit2', bubbles: true, cancelable: true, ...overrides });
    document.activeElement.dispatchEvent(event);
    return event.defaultPrevented;
  }, overrides);
}

(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    headless: true,
    args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream']
  });
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
    await context.addInitScript(() => {
      window.__spoken = [];
      if (window.speechSynthesis) {
        speechSynthesis.speak = utterance => {
          window.__spoken.push(utterance.text);
          setTimeout(() => utterance.onend?.({}), 10);
        };
        speechSynthesis.cancel = () => {};
        speechSynthesis.getVoices = () => [];
      }
      window.__micRequests = 0;
      if (navigator.mediaDevices?.getUserMedia) {
        const acquire = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
        navigator.mediaDevices.getUserMedia = constraints => { window.__micRequests++; return acquire(constraints); };
      }
      class FakeRecognition {
        start() { window.__recognizer = this; this.onstart?.({}); }
        stop() {
          const result = [{ transcript: window.__fakeTranscript || '', confidence: 0.98 }]; result.isFinal = true;
          this.onresult?.({ resultIndex: 0, results: [result] });
          setTimeout(() => this.onend?.({}), 10);
        }
        abort() { this.onend?.({}); }
      }
      window.SpeechRecognition = window.webkitSpeechRecognition = FakeRecognition;
    });
    const page = await context.newPage(), errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(URL, { waitUntil: 'networkidle' });
    await register(page, 'Keyboard learner');
    await page.evaluate(async rows => {
      await window.dbPut({ id: 'keyboard-lesson', name: 'Bài kiểm tra bàn phím', rows, createdAt: Date.now(), updatedAt: Date.now() });
      await window.openDataset('keyboard-lesson');
      window.autoSound = false; window.readOnType = false;
      window.order=[0,1,2];window.mainOrder=[0,1,2];window.index=0;window.mainIndex=0;window.render();
    }, rows);
    await page.locator('#pinyinInput').focus();
    await page.waitForTimeout(300);

    const initial = await typingState(page);
    await page.keyboard.press('2'); assert.equal((await typingState(page)).pinyin, !initial.pinyin);
    await page.keyboard.press('1'); assert.equal((await typingState(page)).han, !initial.han);
    await page.keyboard.press('3'); assert.equal((await typingState(page)).vi, !initial.vi);
    assert.equal((await typingState(page)).index, initial.index);
    await page.keyboard.press('1'); await page.keyboard.press('3');
    console.log('  PASS 1/2/3 toggle Han, Pinyin and Vietnamese without changing the question');

    const guarded = await typingState(page);
    for (const overrides of [{ isComposing: true }, { keyCode: 229 }, { repeat: true }, { ctrlKey: true }, { metaKey: true }, { altKey: true }, { shiftKey: true }]) {
      await keyboardEvent(page, overrides);
      assert.deepEqual(await typingState(page), guarded, 'Shortcut must ignore ' + JSON.stringify(overrides));
    }
    await page.evaluate(() => document.getElementById('pinyinInput').dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true })));
    await keyboardEvent(page, {});
    assert.deepEqual(await typingState(page), guarded, 'Composition session must retain ownership even without isComposing on key event');
    await page.evaluate(() => document.getElementById('pinyinInput').dispatchEvent(new CompositionEvent('compositionend', { bubbles: true })));
    await keyboardEvent(page, {});
    assert.deepEqual(await typingState(page), guarded, 'IME candidate commit must not leak into a numeric shortcut');
    await page.waitForTimeout(160);
    console.log('  PASS composing, legacy IME code, repeat and modified keys never execute shortcuts');

    await page.evaluate(() => {
      const input = document.createElement('textarea'); input.id = 'shortcutOtherInput'; document.body.appendChild(input); input.focus();
    });
    await page.keyboard.press('2'); assert.deepEqual(await typingState(page), guarded);
    await page.evaluate(() => document.getElementById('shortcutOtherInput').remove());
    await page.locator('#pinyinInput').focus();
    const speechBefore = await page.evaluate(() => window.__spoken.length);
    await page.keyboard.press('4');
    await page.waitForFunction(count => window.__spoken.length > count, speechBefore);
    await page.waitForTimeout(50);
    assert.equal(await page.locator('#audioBtn kbd').innerText(), '4', 'Audio playback must preserve its shortcut badge');
    assert.equal(await page.locator('#audioBtn [data-audio-label]').innerText(), 'Nghe', 'Audio label must not shift the numbered toolbar');
    console.log('  PASS unrelated inputs retain their keys while 4 reads the active study sentence');

    await page.keyboard.press('Enter'); assert.equal((await typingState(page)).index, initial.index, 'Incomplete answer must not advance');
    await page.keyboard.press('5'); assert.equal((await typingState(page)).index, initial.index, 'Incomplete answer must not advance with 5 either');
    assert.equal((await typingState(page)).pinyin, guarded.pinyin, 'Enter must no longer toggle Pinyin');
    const beforeLegacy = await typingState(page), spokenBeforeLegacy = await page.evaluate(() => window.__spoken.length);
    for (const key of ['F1', 'F2', 'F3', 'F4', 'F6', 'F7', 'F8']) await keyboardEvent(page, { key, code: key });
    assert.deepEqual(await typingState(page), beforeLegacy);
    assert.equal(await page.evaluate(() => window.__spoken.length), spokenBeforeLegacy);
    await page.fill('#pinyinInput', await page.evaluate(() => window.currentRow().zh));
    await page.waitForFunction(() => !document.getElementById('typingNextBtn').disabled);
    const complete = await typingState(page);
    for (const key of [' ', 'Backspace']) {
      await keyboardEvent(page, { key, code: key === ' ' ? 'Space' : key });
      assert.deepEqual(await typingState(page), complete);
    }
    await keyboardEvent(page, { key: 'Enter', code: 'Enter', isComposing: true });
    assert.deepEqual(await typingState(page), complete);
    await page.keyboard.press('5');
    assert.equal((await typingState(page)).index, complete.index + 1);
    assert.equal((await typingState(page)).pinyin, complete.pinyin);
    await page.locator('#prevSentenceBtn').focus(); await page.keyboard.press('Enter');
    assert.equal((await typingState(page)).index, complete.index, 'Native button Enter must activate only Previous');
    const afterPrevious = await typingState(page);
    await page.locator('#retrySentenceBtn').focus(); await page.keyboard.press('Enter');
    assert.equal((await typingState(page)).value, '');
    assert.equal((await typingState(page)).correct, afterPrevious.correct, 'Retry must preserve the score established by Previous');
    console.log('  PASS 5 advances completed typing; legacy F keys/Space/Backspace are removed and buttons retain native Enter');

    await page.fill('#pinyinInput', [...await page.evaluate(() => window.currentRow().zh)][0]);
    const beforeOptions = await typingState(page);
    await page.locator('#typingOptionsBtn').focus(); await page.keyboard.press('Enter');
    await page.locator('#typingSettings').waitFor({ state: 'visible' });
    for (const key of ['5', '2', '4', '0']) {
      await keyboardEvent(page, { key, code: key });
      assert.deepEqual(await typingState(page), beforeOptions);
    }
    for (let i = 0; i < 15; i++) {
      await page.keyboard.press(i % 3 ? 'Tab' : 'Shift+Tab');
      assert(await page.locator('#typingSettings').evaluate(dialog => dialog.contains(document.activeElement)), 'Options focus escaped on Tab step ' + i + ': ' + await page.evaluate(() => document.activeElement.outerHTML.slice(0, 180)));
    }
    await page.keyboard.press('Escape'); await page.locator('#typingSettings').waitFor({ state: 'hidden' });
    assert.deepEqual(await typingState(page), beforeOptions);
    assert.equal(await page.evaluate(() => document.activeElement.id), 'typingOptionsBtn');
    console.log('  PASS options isolate lesson shortcuts, trap Tab and restore the trigger/input state on Escape');

    const spokenBeforeHelp = await page.evaluate(() => window.__spoken.length);
    await page.keyboard.press('?'); await page.locator('#helpModal').waitFor({ state: 'visible' });
    assert.equal(await page.evaluate(() => window.__spoken.length), spokenBeforeHelp, '? must no longer play sentence audio');
    const helpText = await page.locator('#helpModal').innerText();
    for (const key of ['?', '1', '2', '3', '4', '5', '0', 'Enter']) assert(helpText.includes(key), 'Help must document ' + key);
    await page.locator('#helpModal .modalClose').focus(); await page.keyboard.press('Enter');
    await page.locator('#helpModal').waitFor({ state: 'hidden' });
    assert.deepEqual(await typingState(page), beforeOptions);
    console.log('  PASS ? opens the complete shortcut reference and native Enter closes it without altering the lesson');

    await page.keyboard.press('0'); await page.locator('#pronCard').waitFor({ state: 'visible' });
    assert.equal(await page.evaluate(() => window.__pron._state.source), 'ds:keyboard-lesson');
    await page.evaluate(() => { window.__pron._state.settings.autoSample = false; window.__pron._state.settings.autoNext = false; });
    const pronBefore = await page.evaluate(() => ({ ...window.__pron._state.settings }));
    await page.keyboard.press('2'); await page.keyboard.press('1'); await page.keyboard.press('3');
    assert.deepEqual(await page.evaluate(() => [window.__pron._state.settings.showHan, window.__pron._state.settings.showPy, window.__pron._state.settings.showVi]), [!pronBefore.showHan, !pronBefore.showPy, !pronBefore.showVi]);
    await page.keyboard.press('2'); await page.keyboard.press('1'); await page.keyboard.press('3');
    const pronIndex = await page.evaluate(() => window.__pron._state.index);
    await page.evaluate(() => { document.activeElement.blur(); });
    await page.keyboard.press('5'); assert.equal(await page.evaluate(() => window.__pron._state.index), pronIndex, 'Pronunciation needs a result before 5 advances');
    assert.equal(await page.evaluate(() => window.__pron._state.phase), 'idle', '5 must not start the microphone');
    const sampleBefore = await page.evaluate(() => window.__spoken.length);
    await page.keyboard.press('4'); await page.waitForFunction(count => window.__spoken.length > count, sampleBefore);
    console.log('  PASS 0 opens the same course in pronunciation with shared visibility/sample shortcuts and gated 5');

    await page.evaluate(() => { const state = window.__pron._state; window.__fakeTranscript = state.items[state.order[state.index]].zh; });
    await page.keyboard.press('Enter'); await page.waitForFunction(() => window.__pron._state.phase === 'recording');
    const micCount = await page.evaluate(() => window.__micRequests);
    await keyboardEvent(page, { key: 'Enter', code: 'Enter', repeat: true });
    assert.equal(await page.evaluate(() => window.__pron._state.phase), 'recording');
    assert.equal(await page.evaluate(() => window.__micRequests), micCount);
    await page.keyboard.press('5'); assert.equal(await page.evaluate(() => window.__pron._state.phase), 'recording');
    await page.keyboard.press('Enter'); await page.waitForFunction(() => window.__pron._state.phase === 'result', null, { timeout: 10000 });
    assert.equal(await page.evaluate(() => window.__pron._state.result.mode), 'local');
    assert.equal(await page.evaluate(() => window.__pron._state.sessionTries), 1);
    await page.keyboard.press('5'); assert.equal(await page.evaluate(() => window.__pron._state.index), pronIndex + 1);
    console.log('  PASS Enter starts/stops exactly one recording, held keys are ignored and 5 advances after its result');

    await page.keyboard.press('0'); await page.locator('#appCard').waitFor({ state: 'visible' });
    const sharedSentence = await page.evaluate(() => window.__pron._state.items[window.__pron._state.order[window.__pron._state.index]].zh);
    const switchedTyping = await typingState(page);
    assert.equal(switchedTyping.row, sharedSentence, 'Switching follows the sentence currently selected in pronunciation');
    assert.equal(switchedTyping.value, '', 'A different sentence must not receive the old typing draft');
    for (const key of ['pinyin','han','vi','correct','wrong']) assert.equal(switchedTyping[key],beforeOptions[key]);
    await page.keyboard.press('0'); await page.locator('#pronCard').waitFor({ state: 'visible' });
    assert.equal(await page.evaluate(() => window.__pron._state.index), pronIndex + 1);
    assert.equal(await page.evaluate(()=>window.mainIndex),beforeOptions.index,'Following a pronunciation cursor must not advance saved typing completion');
    assert.equal(await page.locator('#pronMicBtn').getAttribute('aria-keyshortcuts'), 'Enter');
    assert.deepEqual(errors, []);
    console.log('  PASS 0 preserves both lessons and the advertised shortcut matches the working control without browser errors');

    await page.keyboard.press('0'); await page.locator('#appCard').waitFor({ state: 'visible' });
    await page.evaluate(async row => {
      await window.dbPut({ id: 'keyboard-final', name: 'Câu cuối', rows: [row], createdAt: Date.now(), updatedAt: Date.now() });
      await window.openDataset('keyboard-final');
      window.autoSound = false; window.readOnType = false;
    }, rows[0]);
    await page.fill('#pinyinInput', rows[0].zh);
    await page.waitForFunction(() => !document.getElementById('typingNextBtn').disabled);
    await page.keyboard.press('Enter'); await page.locator('#completeArea').waitFor({ state: 'visible' });
    assert.equal(await page.evaluate(() => window.stats.correct), 1);
    await keyboardEvent(page, { key: 'Enter', code: 'Enter', repeat: true });
    assert.equal(await page.evaluate(() => window.stats.correct), 1);
    console.log('  PASS final-sentence Enter opens completion once without duplicating score');
    await context.close();
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
