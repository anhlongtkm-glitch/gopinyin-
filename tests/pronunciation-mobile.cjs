'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright-core');
const { register } = require('./helpers/supabase-fixture.cjs');

const output = path.resolve('.cache/pronunciation-mobile');
const observations = [];
async function phase(page, expected) {
  await page.waitForFunction(value => window.__pron._state.phase === value, expected);
}
async function observe(page, name) {
  const row = await page.evaluate(() => {
    const s = window.__pron._state;
    return { phase:s.phase, timer:s.timer, maxTimer:s.maxTimer, recorder:!!s.rec, meter:!!s.analyser,
      tries:s.sessionTries, status:document.querySelector('#pronStatus').textContent, diagnostics:s.asrDiagnostics };
  });
  observations.push({ name, ...row });
  return row;
}
async function cleanError(page, name, pattern) {
  await phase(page, 'error');
  const row = await observe(page, name);
  assert.match(row.status, pattern);
  assert.equal(row.timer, 0); assert.equal(row.maxTimer, 0);
  assert.equal(row.recorder, false); assert.equal(row.meter, false);
  assert.equal(await page.locator('#pronMicBtn').isEnabled(), true);
  assert.equal(row.tries, 0);
  console.log('  PASS ' + name);
}
async function begin(page, mode = 'normal') {
  const previous = await page.evaluate(value => {
    window.__asrMode = value;
    return { count:window.__asrConstructions || 0, status:document.querySelector('#pronStatus').textContent };
  }, mode);
  await page.tap('#pronMicBtn');
  await page.waitForFunction(previous => (window.__asrConstructions || 0) > previous.count ||
    window.__pron._state.phase !== 'error' || document.querySelector('#pronStatus').textContent !== previous.status, previous);
}

(async () => {
  fs.mkdirSync(output, { recursive:true });
  const browser = await chromium.launch({ executablePath:process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless:true,
    args:['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] });
  try {
    const context = await browser.newContext({ viewport:{width:390,height:844}, isMobile:true, hasTouch:true, permissions:['microphone'], reducedMotion:'reduce' });
    await context.addInitScript(() => {
      if (window.speechSynthesis) { speechSynthesis.speak = () => {}; speechSynthesis.getVoices = () => []; }
      window.__asrMode = 'normal';
      window.__emitFinal = (recognizer, text = window.__pron._state.items[window.__pron._state.order[window.__pron._state.index]].zh) => recognizer.onresult?.({resultIndex:0, results:[Object.assign([{transcript:text,confidence:0.98}],{isFinal:true})]});
      class FakeRecognition {
        constructor() {
          window.__asrConstructions = (window.__asrConstructions || 0) + 1;
          if (window.__asrMode === 'constructor-throw') throw new DOMException('Fixture constructor failure', 'InvalidStateError');
          window.__asr = this;
        }
        start() {
          if (window.__asrMode === 'throw') throw new DOMException('Fixture startup failure', 'InvalidStateError');
          if (window.__asrMode !== 'no-start') setTimeout(() => this.onstart?.(), 30);
        }
        stop() {
          if (window.__asrMode === 'stop-final') {
            setTimeout(() => { window.__emitFinal(this); this.onend?.(); }, 80);
          } else this.onend?.();
        }
        abort() { this.onend?.(); }
      }
      window.__FakeRecognition = FakeRecognition;
      window.SpeechRecognition = window.webkitSpeechRecognition = FakeRecognition;
      const acquire = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
      navigator.mediaDevices.getUserMedia = async constraints => {
        if (window.__denyMic) throw new DOMException('Fixture denied', 'NotAllowedError');
        const stream = await acquire(constraints);
        if (window.__delayMic) {
          window.__pendingTracks = stream.getTracks();
          await new Promise(resolve => { window.__resolveMic = resolve; });
        }
        return stream;
      };
    });
    const page = await context.newPage(), errors = [];
    page.setDefaultTimeout(12000);
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(process.env.TEST_URL || 'http://localhost:8080/');
    await register(page, 'Mobile speech lifecycle');
    await page.evaluate(async () => {
      await window.dbPut({id:'speech-lifecycle',name:'Speech lifecycle',rows:[
        {id:0,zh:'你好。',py:'nǐ hǎo',vi:'Xin chào.'},
        {id:1,zh:'谢谢。',py:'xiè xie',vi:'Cảm ơn.'}
      ],createdAt:Date.now(),updatedAt:Date.now()});
      await window.openDataset('speech-lifecycle');
    });
    await page.tap('#appCard [data-practice-mode="speaking"]');
    await page.locator('#pronMicBtn').waitFor({state:'visible'});

    await begin(page, 'constructor-throw');
    await cleanError(page, 'constructor failure is reported without recording or false listening', /Không khởi động/);
    await begin(page, 'throw');
    await cleanError(page, 'start failure releases attempt resources and permits retry', /Không khởi động/);

    await begin(page, 'no-start'); await phase(page, 'starting');
    assert.match(await page.locator('.pronMicTxt').innerText(), /Đang mở/);
    assert.equal(await page.locator('#pronMicBtn').getAttribute('aria-busy'), 'true');
    assert.equal(await page.evaluate(() => !!window.__pron._state.rec), false);
    await cleanError(page, 'missing onstart times out instead of pretending to listen', /không phản hồi/);

    for (const error of ['network', 'not-allowed', 'service-not-allowed', 'audio-capture', 'no-speech', 'aborted']) {
      await begin(page); await phase(page, 'recording');
      await page.evaluate(error => { const r=window.__asr; r.onerror({error}); r.onend(); }, error);
      await cleanError(page, error + ' stops listening immediately and does not save a result', /dịch vụ|Dịch vụ|chặn|âm thanh|gián đoạn/);
    }

    await begin(page); await phase(page, 'recording');
    await page.evaluate(() => {
      const r=window.__asr;
      r.onresult({resultIndex:0,results:[Object.assign([{transcript:'你好',confidence:0.9}],{isFinal:false})]});
      r.onend();
    });
    await cleanError(page, 'interim-only end asks for another attempt without awarding progress', /kết quả cuối/);
    await page.screenshot({path:path.join(output,'interim-ended-mobile.png')});

    await begin(page, 'no-start'); await phase(page, 'starting');
    await page.evaluate(() => { window.__cancelledRecognizer = window.__asr; });
    await page.tap('#pronOptionsBtn');
    await phase(page, 'idle');
    await page.evaluate(() => { const r=window.__cancelledRecognizer; r.onstart(); window.__emitFinal(r,'stale'); r.onerror({error:'network'}); r.onend(); });
    assert.equal(await page.evaluate(() => window.__pron._state.phase), 'idle');
    await page.locator('#pronSettings [data-settings-close]').first().tap();
    console.log('  PASS opening settings cancels startup and ignores every callback from the cancelled recognizer');

    for (let attempt=1; attempt<=3; attempt++) {
      await begin(page); await phase(page, 'recording');
      await page.evaluate(() => { const r=window.__asr; window.__emitFinal(r); r.onend(); r.onend(); });
      await phase(page, 'result');
      assert.equal(await page.evaluate(() => window.__pron._state.sessionTries), attempt);
      assert.equal(await page.evaluate(() => window.__pron._state.result.score), 100);
      const row=await observe(page, 'natural-final-' + attempt);
      assert.equal(row.recorder,false); assert.equal(row.meter,false); assert.equal(row.timer,0); assert.equal(row.maxTimer,0);
    }
    console.log('  PASS three consecutive Chinese final results each finish and save exactly once');
    await page.screenshot({path:path.join(output,'final-result-mobile.png')});

    await begin(page, 'stop-final'); await phase(page, 'recording');
    await page.evaluate(() => { window.__oldRecorder = window.__pron._state.rec; });
    await page.tap('#pronMicBtn'); await phase(page, 'result');
    assert.equal(await page.evaluate(() => window.__pron._state.sessionTries), 4);
    console.log('  PASS manual stop accepts a delayed final result without double assessment');

    await begin(page); await phase(page, 'recording');
    const stale = await page.evaluate(() => {
      const s=window.__pron._state, before=s.chunks.length;
      window.__oldRecorder.ondataavailable({data:new Blob(['old attempt'])});
      return {before,after:s.chunks.length};
    });
    assert.equal(stale.before,stale.after);
    await page.evaluate(() => { window.__cancelledRecognizer=window.__asr; });
    await page.tap('#pronNextBtn'); await phase(page, 'idle');
    await page.evaluate(() => { const r=window.__cancelledRecognizer; window.__emitFinal(r,'old sentence'); r.onerror({error:'network'}); r.onend(); });
    assert.equal(await page.evaluate(() => window.__pron._state.phase),'idle');
    assert.equal(await page.evaluate(() => window.__pron._state.sessionTries),4);
    console.log('  PASS changing question rejects stale recognition and recorder data from the previous attempt');

    await page.evaluate(() => { window.__liveTracks=window.__pron._state.stream.getTracks(); window.showView('games'); });
    assert.equal(await page.evaluate(() => window.__liveTracks.every(track=>track.readyState==='ended')),true);
    await page.evaluate(() => window.__pron.start('ds:speech-lifecycle'));
    await page.locator('#pronMicBtn').waitFor({state:'visible'});
    await page.evaluate(() => { window.__denyMic=true; });
    await begin(page); await phase(page,'error');
    assert.match(await page.locator('#pronStatus').innerText(),/chưa được cấp quyền/);
    await page.evaluate(() => { window.__denyMic=false; window.SpeechRecognition=window.webkitSpeechRecognition=undefined; });
    await begin(page); await phase(page,'error');
    assert.match(await page.locator('#pronStatus').innerText(),/không hỗ trợ/);
    console.log('  PASS leaving closes microphone tracks; denied permission and missing API have distinct messages');

    await page.evaluate(() => { window.SpeechRecognition=window.webkitSpeechRecognition=window.__FakeRecognition; window.__delayMic=true; });
    await begin(page); await phase(page,'requesting');
    await page.waitForFunction(() => !!window.__resolveMic);
    await page.evaluate(() => window.showView('games'));
    await page.evaluate(() => window.__resolveMic());
    await page.waitForFunction(() => window.__pendingTracks.every(track=>track.readyState==='ended'));
    assert.equal(await page.locator('#pronCard').isVisible(),false);
    assert.deepEqual(errors,[]);
    console.log('  PASS navigating away during microphone acquisition closes late tracks without reopening the study');
    await context.close();
  } finally {
    fs.writeFileSync(path.join(output,'observations.json'),JSON.stringify(observations,null,2));
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode=1; });
