'use strict';
const assert = require('node:assert/strict');
const { chromium } = require('playwright-core');
const { register } = require('./helpers/supabase-fixture.cjs');

(async () => {
  const browser = await chromium.launch({executablePath:process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
  try {
    const page = await browser.newPage({viewport:{width:1440,height:1000}}), errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.addInitScript(() => {
      window.__pronSpeech = [];
      window.__blockSpeech = false;
      window.SpeechSynthesisUtterance = class {constructor(text){this.text=text;}};
      speechSynthesis.getVoices = () => [{name:'Google Mandarin Female',lang:'zh-CN'}];
      speechSynthesis.cancel = () => {};
      speechSynthesis.speak = utterance => {
        window.__pronSpeech.push({text:utterance.text,rate:utterance.rate,voice:utterance.voice?.name});
        if (window.__blockSpeech) utterance.onerror?.({error:'not-allowed'});
        else {utterance.onstart?.();setTimeout(() => utterance.onend?.({}),0);}
      };
    });
    await page.goto(process.env.TEST_URL,{waitUntil:'networkidle'});
    await register(page,'Pronunciation audio learner');
    // Use the actual persisted account record, as older accounts have it.
    await page.evaluate(() => {
      const tokenKey = Object.keys(localStorage).find(key => key.endsWith('-auth-token'));
      const userId = JSON.parse(localStorage.getItem(tokenKey)).user.id;
      const key = 'gp:account-cache:' + userId;
      const records = JSON.parse(localStorage.getItem(key) || '{}');
      records[JSON.stringify(['kv','gp:pron:settings'])] = {
        kind:'kv',record_id:'gp:pron:settings',payload:JSON.stringify({autoSample:false,rate:1,voice:''}),
        version:0,dirty:true,deleted:false,edit:1
      };
      localStorage.setItem(key,JSON.stringify(records));
    });
    await page.reload({waitUntil:'networkidle'});
    await page.waitForFunction(() => document.getElementById('accountSyncStatus').textContent === 'Đã đồng bộ');
    await page.evaluate(() => window.showView('practice'));
    await page.click('[data-hsk-level="1"]');
    await page.click('[data-practice-group="0"]');
    await page.locator('#appCard').waitFor({state:'visible'});
    await page.waitForTimeout(300);
    await page.evaluate(() => window.__pronSpeech=[]);
    await page.click('#appCard [data-practice-mode="speaking"]');
    await page.locator('#pronCard').waitFor({state:'visible'});
    await page.waitForTimeout(1000);
    assert.equal(await page.evaluate(() => window.__pron._state.settings.autoSample),true,'Legacy false must migrate to the requested automatic sample default');
    let spoken = await page.evaluate(() => window.__pronSpeech);
    assert.equal(spoken.length,1,'Entering speaking must read the initial sentence once');
    assert.equal(spoken[0].rate,1);assert.match(spoken[0].voice,/Google/);
    await page.evaluate(() => window.__pronSpeech=[]);
    await page.click('#pronNextBtn');
    await page.waitForTimeout(700);
    spoken=await page.evaluate(() => window.__pronSpeech);
    assert.equal(spoken.length,1,'The next sentence must be read once');
    console.log('  PASS old saved sample-off defaults migrate and initial/next sentences each read once');

    await page.click('#pronOptionsBtn');
    await page.click('#pronSettings [data-settings-tab="audio"]');
    await page.click('#pronAutoSample');
    await page.keyboard.press('Escape');
    await page.evaluate(() => window.__pronSpeech=[]);
    await page.click('#pronNextBtn');
    await page.waitForTimeout(700);
    assert.equal(await page.evaluate(() => window.__pronSpeech.length),0);
    await page.waitForFunction(() => document.getElementById('accountSyncStatus').textContent === 'Đã đồng bộ');
    await page.reload({waitUntil:'networkidle'});
    await page.locator('#pronCard').waitFor({state:'visible'});
    await page.waitForTimeout(800);
    assert.equal(await page.evaluate(() => window.__pron._state.settings.autoSample),false);
    assert.equal(await page.evaluate(() => window.__pronSpeech.length),0,'An explicit new opt-out must survive reload');
    console.log('  PASS an explicit audio opt-out survives navigation and reload');

    await page.click('#pronOptionsBtn');
    await page.click('#pronSettings [data-settings-tab="audio"]');
    await page.click('#pronAutoSample');
    await page.keyboard.press('Escape');
    await page.waitForTimeout(700);
    await page.evaluate(() => {window.__pronSpeech=[];window.__blockSpeech=true;});
    await page.click('#pronNextBtn');
    await page.waitForTimeout(700);
    assert.equal(await page.evaluate(() => window.__pronSpeech.length),1);
    assert.match(await page.locator('#toastHost').innerText(),/Nhấn.*Nghe/);
    await page.evaluate(() => window.__blockSpeech=false);
    await page.click('#pronSampleBtn');
    await page.waitForTimeout(100);
    assert.equal(await page.evaluate(() => window.__pronSpeech.length),2,'The visible Listen control must recover blocked browser autoplay');
    assert.deepEqual(errors,[]);
    console.log('  PASS browser autoplay errors explain how to play the sample and manual Listen recovers');
  } finally {await browser.close();}
})().catch(error => {console.error(error);process.exitCode=1;});
