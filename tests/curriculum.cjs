'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright-core');
const { register } = require('./helpers/supabase-fixture.cjs');
async function sourceModule(file) {
  return import('data:text/javascript;base64,' + Buffer.from(fs.readFileSync(path.join(__dirname, '..', file), 'utf8')).toString('base64'));
}
(async () => {
  const { readings } = await sourceModule('src/features/journey/content.js');
  const catalog = await sourceModule('src/data/catalog.js');
  catalog.initializeDataCatalog();
  assert.equal(readings.length, 18);
  assert.equal(new Set(readings.map(r => r.id)).size, 18);
  for (const level of [1, 2, 3]) {
    const lessons = readings.filter(r => r.level === level);
    assert.equal(lessons.length, 6);
    for (const lesson of lessons) {
      assert.equal(lesson.lines.length, 10 + 2 * level, lesson.id);
      assert(Number.isInteger(lesson.revision) && lesson.revision > 0);
      assert(lesson.vocabulary.length >= 3);
      assert.equal(lesson.questions.length, 3);
      for (const [zh, py, vi, speaker] of lesson.lines) {
        assert.match(zh, /[\u3400-\u9fff]/u, lesson.id);
        assert(py.trim() && vi.trim() && speaker.trim(), lesson.id);
        assert(!/\uFFFD/.test(zh + py + vi + speaker), lesson.id);
      }
      for (const [question, options, answer] of lesson.questions) {
        assert(question.trim() && options.length === 3);
        assert(Number.isInteger(answer) && answer >= 0 && answer < options.length);
        assert.equal(new Set(options).size, options.length);
      }
    }
  }
  console.log('  PASS 18 original dialogues have complete translations, speakers, vocabulary and valid quizzes');
  const browser = await chromium.launch({executablePath:process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless:true});
  try {
    const page = await browser.newPage({viewport:{width:1440,height:1000}}), errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.addInitScript(() => {
      window.__sampleSpeech = [];
      window.SpeechSynthesisUtterance = class { constructor(text) {this.text=text;this.rate=1;} };
      speechSynthesis.getVoices = () => [{name:'Microsoft Yunxi Male',lang:'zh-CN'},{name:'Google 普通话（中国大陆）',lang:'zh-CN'}];
      speechSynthesis.cancel = () => {};
      speechSynthesis.speak = utterance => {
        window.__sampleSpeech.push({text:utterance.text,rate:utterance.rate,voice:utterance.voice?.name});
        utterance.onstart?.(); setTimeout(() => utterance.onend?.(),0);
      };
    });
    await page.goto(process.env.TEST_URL, {waitUntil:'networkidle'});
    await register(page, 'Curriculum learner');
    assert(await page.locator('.ws-nav [data-view="ai"]').isVisible());
    assert.equal(await page.locator('[data-view="tones"],[data-view="shadow"],[data-more-view="tones"],[data-more-view="shadow"]').count(), 0);
    await page.evaluate(() => window.showView('practice'));
    for (let level = 1; level <= 9; level++) {
      await page.click(`[data-hsk-level="${level}"]`);
      const counts = await page.locator('.practiceGroupCard progress').evaluateAll(nodes => nodes.map(node => node.max));
      const expected = catalog.state.HSK_DATA['hsk' + level].filter(r => r && r[0] && r[2]).length;
      assert.equal(counts.reduce((sum,n) => sum+n,0), expected, 'Every HSK sentence must be in a stage');
      assert.deepEqual(await page.locator('.practiceGroupCard>b').allTextContents(), ['Chặng 01','Chặng 02','Chặng 03','Chặng 04','Chặng 05','Chặng 06']);
    }
    await page.click('[data-hsk-level="1"]');
    const hsk1 = catalog.state.HSK_DATA.hsk1;
    for (let stage = 0; stage < 6; stage++) {
      await page.click(`[data-practice-group="${stage}"]`);
      await page.locator('#appCard').waitFor({state:'visible'});
      const actual = await page.evaluate(() => ({id:window.activeDataset.id,rows:window.activeDataset.rows.map(r => [r.zh,r.py,r.vi])}));
      assert.equal(actual.id, 'practice:hsk1-part:' + (stage+1));
      assert.deepEqual(actual.rows, hsk1.slice(stage*51,(stage+1)*51));
      const style = await page.locator('#pinyinInput').evaluate(node => {const s=getComputedStyle(node);return {align:s.textAlign,left:s.paddingLeft,right:s.paddingRight};});
      assert.equal(style.align,'center'); assert.equal(style.left,style.right);
      await page.evaluate(() => window.showView('practice'));
    }
    console.log('  PASS HSK 1 stages cover all 301 rows exactly once and typing text is centered');
    await page.click('[data-practice-group="0"]');
    await page.locator('#appCard').waitFor({state:'visible'});
    await page.waitForTimeout(300);
    await page.evaluate(() => window.__sampleSpeech=[]);
    await page.click('#appCard [data-practice-mode="speaking"]');
    await page.locator('#pronCard').waitFor({state:'visible'});
    await page.waitForFunction(() => window.__sampleSpeech.length > 0);
    await page.waitForTimeout(300);
    let spoken = await page.evaluate(() => window.__sampleSpeech);
    assert.equal(spoken.length,1); assert.equal(spoken[0].rate,1); assert.match(spoken[0].voice,/Google/);
    await page.click('#pronOptionsBtn'); await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
    assert.equal(await page.evaluate(() => window.__sampleSpeech.length),1,'Opening settings must not repeat the sample');
    await page.evaluate(() => window.__sampleSpeech=[]);
    await page.click('#pronNextBtn');
    await page.waitForFunction(() => window.__sampleSpeech.length > 0);
    await page.waitForTimeout(300);
    spoken=await page.evaluate(() => window.__sampleSpeech);
    assert.equal(spoken.length,1); assert.equal(spoken[0].rate,1); assert.match(spoken[0].voice,/Google/);
    await page.click('#pronOptionsBtn');
    await page.click('#pronSettings [data-settings-tab="audio"]');
    await page.selectOption('#pronRate','1.25'); await page.selectOption('#pronVoice','Microsoft Yunxi Male');
    await page.keyboard.press('Escape');
    await page.evaluate(() => window.__sampleSpeech=[]);
    await page.click('#pronNextBtn');
    await page.waitForFunction(() => window.__sampleSpeech.length > 0);
    spoken=await page.evaluate(() => window.__sampleSpeech);
    assert.equal(spoken[0].rate,1.25); assert.equal(spoken[0].voice,'Microsoft Yunxi Male');
    console.log('  PASS pronunciation reads each new sentence once with Google at 1.0, then honors custom audio choices');
    for (const level of [1,2,3]) {
      await page.evaluate(() => window.showView('readings'));
      if (await page.locator('#readingBack').isVisible()) await page.click('#readingBack');
      await page.click(`[data-reading-level="${level}"]`);
      const lesson = readings.find(r => r.level === level);
      assert.equal(await page.locator('[data-reading]').count(),6);
      await page.click(`[data-reading="${lesson.id}"]`);
      assert.equal(await page.locator('.readingLine').count(),lesson.lines.length);
      await page.click(`[data-reading-practice="${lesson.id}"]`);
      await page.locator('#appCard').waitFor({state:'visible'});
      const actual = await page.evaluate(() => ({id:window.activeDataset.id,count:window.activeDataset.rows.length,index:window.index}));
      assert.equal(actual.id,`practice:reading:hsk${level}:${lesson.id}:v${lesson.revision}`);
      assert.equal(actual.count,lesson.lines.length); assert.equal(actual.index,0);
    }
    assert.deepEqual(errors,[]);
    console.log('  PASS reading filters and versioned practice preserve the selected HSK level and content');
  } finally { await browser.close(); }
})().catch(error => {console.error(error);process.exitCode=1;});
