'use strict';
// Phone UA/capture-contract simulation in Chromium, not real Android/iOS speech.
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const {chromium}=require('playwright-core');
const {register}=require('./helpers/supabase-fixture.cjs');
const output=path.resolve('.cache/pronunciation-native-mobile'),observations=[];
(async()=>{
 fs.mkdirSync(output,{recursive:true});
 const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
 try{
  for(const profile of [
   {name:'android-chrome',ua:'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36'},
   {name:'iphone-safari-profile',ua:'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1'}
  ]){
   const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,userAgent:profile.ua,reducedMotion:'reduce'});
   await context.addInitScript(()=>{
    if(window.speechSynthesis){speechSynthesis.speak=()=>{};speechSynthesis.getVoices=()=>[];}
    window.__captureCalls=0;window.__recorderCalls=0;window.__recognizers=[];
    if(navigator.mediaDevices)navigator.mediaDevices.getUserMedia=async()=>{window.__captureCalls++;throw new Error('Parallel capture interrupts native mobile recognition');};
    window.MediaRecorder=class{constructor(){window.__recorderCalls++;throw new Error('Parallel recording must not start');}};
    window.__phoneMode='normal';
    window.__emitPhoneFinal=r=>{const s=window.__pron._state;r.onresult?.({resultIndex:0,results:[Object.assign([{transcript:s.items[s.order[s.index]].zh,confidence:0.98}],{isFinal:true})]});};
    window.SpeechRecognition=window.webkitSpeechRecognition=class{
     constructor(){window.__phoneRecognizer=this;window.__recognizers.push(this);}
     start(){this.onstart?.();this.onaudiostart?.();if(window.__phoneMode!=='empty')this.onspeechstart?.();}
     stop(){if(window.__phoneMode==='late')setTimeout(()=>{window.__emitPhoneFinal(this);this.onend?.();},100);else this.onend?.();}
     abort(){this.onend?.();}
    };
   });
   const page=await context.newPage(),errors=[];page.setDefaultTimeout(12000);page.on('pageerror',e=>errors.push(e.message));
   await page.goto(process.env.TEST_URL||'http://localhost:8080/');await register(page,'Native speech '+profile.name);
   await page.evaluate(async()=>{await window.dbPut({id:'native-speech',name:'Native speech',rows:[{id:0,zh:'你好。',py:'nǐ hǎo',vi:'Xin chào.'}],createdAt:Date.now(),updatedAt:Date.now()});await window.openDataset('native-speech');});
   await page.tap('#appCard [data-practice-mode="speaking"]');await page.locator('#pronMicBtn').waitFor({state:'visible'});
   for(let attempt=1;attempt<=3;attempt++){
    await page.tap('#pronMicBtn');await page.waitForFunction(()=>window.__pron._state.phase==='recording');
    assert.equal(await page.evaluate(()=>window.__phoneRecognizer.lang),'zh-CN');
    assert.equal(await page.evaluate(()=>window.__phoneRecognizer.continuous),false);
    if(attempt===1){await page.waitForTimeout(1800);assert.equal(await page.evaluate(()=>window.__pron._state.phase),'recording');}
    await page.evaluate(()=>{window.__emitPhoneFinal(window.__phoneRecognizer);window.__phoneRecognizer.onend();});
    await page.waitForFunction(()=>window.__pron._state.phase==='result');
    assert.equal(await page.evaluate(()=>window.__pron._state.sessionTries),attempt);
    assert.equal(await page.evaluate(()=>window.__pron._state.result.score),100);
   }
   const capture=await page.evaluate(()=>({gum:window.__captureCalls,recorder:window.__recorderCalls,unique:new Set(window.__recognizers).size,stream:window.__pron._state.stream,diagnostics:window.__pron._state.asrDiagnostics}));
   assert.equal(capture.gum,0);assert.equal(capture.recorder,0);assert.equal(capture.unique,3);assert.equal(capture.stream,null);
   assert.equal(capture.diagnostics.captureMode,'browser-microphone');assert.equal(capture.diagnostics.finalResults,1);
   assert(await page.locator('#pronPlayMineBtn').isDisabled());
   observations.push({profile:profile.name,...capture});
   console.log('  PASS '+profile.name+' receives three Chinese finals without parallel getUserMedia, recording or premature meter stop');
   await page.screenshot({path:path.join(output,profile.name+'-result.png'),scale:'css'});

   await page.evaluate(()=>window.__phoneMode='late');await page.tap('#pronMicBtn');await page.waitForFunction(()=>window.__pron._state.phase==='recording');
   await page.tap('#pronMicBtn');await page.waitForFunction(()=>window.__pron._state.phase==='result');
   assert.equal(await page.evaluate(()=>window.__pron._state.sessionTries),4);
   console.log('  PASS '+profile.name+' manual stop accepts the delayed final and saves exactly once');
   await page.evaluate(()=>window.__phoneMode='empty');await page.tap('#pronMicBtn');await page.waitForFunction(()=>window.__pron._state.phase==='recording');
   await page.evaluate(()=>window.__phoneRecognizer.onend());await page.waitForFunction(()=>window.__pron._state.phase==='error');
   assert.match(await page.locator('#pronStatus').innerText(),/không trả về chữ nhận dạng/);
   assert.equal(await page.evaluate(()=>window.__pron._state.sessionTries),4);
   assert.equal(await page.evaluate(()=>window.__pron._state.asrDiagnostics.resultEvents),0);
   await page.screenshot({path:path.join(output,profile.name+'-empty-result.png'),scale:'css'});
   console.log('  PASS '+profile.name+' distinguishes an empty browser recognition response from unclear user speech');
   await page.tap('#pronMicBtn');await page.waitForFunction(()=>window.__pron._state.phase==='recording');
   await page.evaluate(()=>window.__phoneRecognizer.onerror({error:'not-allowed'}));await page.waitForFunction(()=>window.__pron._state.phase==='error');
   assert.match(await page.locator('#pronStatus').innerText(),/chặn nhận dạng/);
   await page.evaluate(()=>window.showView('games'));assert.deepEqual(errors,[]);
   console.log('  PASS '+profile.name+' handles native permission denial and releases the recognition session on navigation');
   await context.close();
  }
 }finally{await browser.close();fs.writeFileSync(path.join(output,'observations.json'),JSON.stringify(observations,null,2));}
})().catch(e=>{console.error(e);process.exitCode=1});
