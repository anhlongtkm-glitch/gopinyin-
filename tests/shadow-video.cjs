'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {chromium}=require('playwright-core');
const {register}=require('./helpers/supabase-fixture.cjs');
const moduleFile=async file=>import('data:text/javascript;base64,'+Buffer.from(fs.readFileSync(path.join(__dirname,'../src/features/shadowing/',file),'utf8')).toString('base64'));
(async()=>{
 const {VIDEOS,filterVideos}=await moduleFile('catalog.js');
 assert.equal(new Set(VIDEOS.map(v=>v.id)).size,14);
 for(const level of [1,2,3,4])assert(filterVideos({level:String(level)}).length>=3);
 assert(filterVideos({query:'gioi thieu'}).some(v=>v.id==='8MTp5dZoFGM'));
 assert(filterVideos({level:'4',topic:'shopping'}).some(v=>v.id==='0U-nmIcrHXU'));
 assert(VIDEOS.every(v=>v.transcriptStatus==='pending'&&/^[\w-]{11}$/.test(v.id)));
 console.log('  PASS curated catalog has 14 unique YouTube links, HSK 1–4 coverage and accent-insensitive topic search');
 const {parseSubtitles,cueAt,normalizeAnswer}=await moduleFile('model.js');
 const id='4xuzuLAAzt8';
 // Test-only original text, never shipped or labeled as a YouTube transcript.
 const cues=[{id:'one',start:0,end:3,hanzi:'你好。',words:[['你好。','nǐ hǎo']],vi:'Xin chào.'},{id:'two',start:4,end:7,hanzi:'谢谢。',words:[['谢谢。','xiè xie']],vi:'Cảm ơn.'}];
 const text=JSON.stringify({videoId:id,cues});
 assert.equal(parseSubtitles(text,'test.json',id).length,2);
 assert.throws(()=>parseSubtitles(text,'test.json','8MTp5dZoFGM'),/khớp/);
 assert.throws(()=>parseSubtitles(JSON.stringify(cues),'test.json',id),/khớp/);
 assert.throws(()=>parseSubtitles(JSON.stringify({videoId:id,cues:[cues[0],{...cues[1],start:2}]}),'test.json',id),/chồng/);
 assert.equal(cueAt(cues,3.5),-1);assert.equal(cueAt(cues,4),1);assert.equal(normalizeAnswer('你 好，'),'你好');
 assert.equal(parseSubtitles('WEBVTT\n\n00:00.000 --> 00:02.000\n你好。','test.vtt',id)[0].words[0][1],'');
 console.log('  PASS timed subtitles reject wrong-video JSON and overlaps; gaps and VTT without invented Pinyin work');
 const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream']});
 try{
 const context=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce'});
 await context.addInitScript(()=>{
  window.__ytPlayers=[];
  window.YT={Player:class{
   constructor(host,config){this.config=config;this.time=0;this.playing=false;this.dead=false;this.frame=document.createElement('iframe');this.frame.title='YouTube player test double';this.frame.id=host;document.getElementById(host).replaceWith(this.frame);window.__ytPlayers.push(this);setTimeout(()=>config.events.onReady(),10);}
   getDuration(){return 100;}getCurrentTime(){return this.time;}getAvailablePlaybackRates(){this.rateRead=(this.rateRead||0)+1;return this.rateRead===1?undefined:[.75,1,1.25];}setVolume(){}mute(){}unMute(){}
   cueVideoById({startSeconds}){this.time=startSeconds;this.config.events.onStateChange({data:5});}
   seekTo(t){this.time=t;}setPlaybackRate(rate){this.config.events.onPlaybackRateChange({data:rate});}
   playVideo(){this.playing=true;this.config.events.onStateChange({data:1});}pauseVideo(){this.playing=false;this.config.events.onStateChange({data:2});}
   destroy(){this.dead=true;this.frame.remove();}
  }};
 });
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(process.env.TEST_URL,{waitUntil:'networkidle'});await register(page,'Video learner');
 await page.evaluate(()=>window.showView('shadow'));assert.equal(await page.locator('#sv-grid [data-sv-video]').count(),14);assert.equal(await page.locator('#sv-videoStage iframe').count(),0);
 await page.click('[data-sv-level="4"]');await page.selectOption('#sv-topic','grammar');await page.fill('#sv-search','can nhac');assert.equal(await page.locator('#sv-grid [data-sv-video]').count(),1);
 await page.click(`#sv-grid [data-sv-video="${id}"]`);await page.locator('#shadowVideoCard').waitFor({state:'visible'});
 assert.match(page.url(),/shadowVideo\?video=4xuzuLAAzt8/);assert.match(await page.textContent('#sv-transcript'),/nhập riêng/);assert(await page.locator('#sv-record').isDisabled());
 await page.click('#sv-loadYoutube');await page.waitForFunction(()=>document.getElementById('sv-playerStatus').textContent.includes('Đã kết nối'));
 assert.equal(await page.evaluate(()=>window.__ytPlayers.at(-1).config.videoId),id);
 assert.equal(await page.evaluate(()=>window.__ytPlayers.at(-1).playing),false,'Opening a video must not autoplay');
 await page.click('#sv-backVideos');assert.equal(await page.inputValue('#sv-search'),'can nhac');assert.equal(await page.inputValue('#sv-topic'),'grammar');assert.equal(await page.getAttribute('[data-sv-level="4"]','aria-pressed'),'true');assert.equal(await page.evaluate(()=>window.__ytPlayers.at(-1).dead),true);
 console.log('  PASS library selection opens the correct video, captions remain truthful and Back preserves all filters');
 await page.click(`#sv-grid [data-sv-video="${id}"]`);
 await page.setInputFiles('#sv-subtitleFile',{name:'wrong.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({videoId:'wrong',cues}))});assert.match(await page.textContent('#sv-importStatus'),/khớp/);
 await page.setInputFiles('#sv-subtitleFile',{name:'test.json',mimeType:'application/json',buffer:Buffer.from(text)});await page.waitForFunction(()=>document.querySelectorAll('#sv-transcript .cue').length===2);
 await page.click('#sv-loadYoutube');await page.waitForFunction(()=>document.getElementById('sv-playerStatus').textContent.includes('Đã kết nối'));
 await page.click('[data-seek-cue="0"]');await page.waitForTimeout(120);assert.equal(await page.getAttribute('[data-seek-cue="0"]','aria-current'),'true');
 await page.click('#sv-loop');await page.evaluate(()=>window.__ytPlayers.at(-1).time=3.2);await page.waitForFunction(()=>window.__ytPlayers.at(-1).time===0);
 await page.click('#sv-autoPause');assert.equal(await page.getAttribute('#sv-loop','aria-pressed'),'false');await page.evaluate(()=>window.__ytPlayers.at(-1).time=3.2);await page.waitForFunction(()=>!window.__ytPlayers.at(-1).playing);
 await page.click('[data-seek-cue="0"]');
 await page.click('[data-bookmark="0"]');await page.click('#sv-bookmarksOnly');assert(await page.locator('[data-cue="1"]').isHidden());await page.click('#sv-bookmarksOnly');
 await page.click('#sv-hideVideo');assert.equal(await page.evaluate(()=>window.__ytPlayers.at(-1).playing),false);assert(await page.locator('#sv-collapsedVideo').isVisible());await page.click('#sv-showVideo');
 await page.click('[data-mode="dictation"]');await page.fill('#sv-answer','你 好！');await page.locator('#sv-dictationForm button[type=submit]').click();assert.match(await page.textContent('#sv-dictationResult'),/Chính xác/);
 await page.fill('#sv-answer','你好');await page.evaluate(()=>{const input=document.getElementById('sv-answer');input.dispatchEvent(new CompositionEvent('compositionstart'));document.getElementById('sv-dictationResult').textContent='IME giữ nguyên';});await page.keyboard.press('Enter');assert.equal(await page.textContent('#sv-dictationResult'),'IME giữ nguyên');await page.evaluate(()=>document.getElementById('sv-answer').dispatchEvent(new CompositionEvent('compositionend')));await page.waitForTimeout(140);await page.fill('#sv-answer','你 好！');
 await page.click('[data-layer="pinyin"]');assert.equal(await page.inputValue('#sv-answer'),'你 好！');await page.click('#sv-revealAnswer');assert(await page.locator('[data-cue="0"] .han').isVisible());assert(await page.locator('[data-cue="1"] .han').isHidden());
 await page.click('#sv-settingsButton');await page.keyboard.press('2');assert.equal(await page.getAttribute('[data-layer="pinyin"]','aria-pressed'),'false');await page.keyboard.press('Escape');
 console.log('  PASS imported transcript synchronizes, bookmarks filter, hiding pauses and dictation/layers/dialog shortcuts preserve state');
 await page.click('[data-mode="shadow"]');await page.evaluate(()=>document.activeElement.blur());await page.keyboard.press('Enter');await page.waitForFunction(()=>document.getElementById('sv-recordStatus').textContent.includes('Đang thu'));
 await page.waitForTimeout(2200);await page.keyboard.press('Enter');await page.locator('#sv-recordPlayback').waitFor({state:'visible'});
 await page.click('#sv-backVideos');assert.equal(await page.getAttribute('#sv-recordPlayback','src'),null);
 await page.reload({waitUntil:'networkidle'});await page.evaluate(()=>window.showView('shadow'));await page.click(`#sv-grid [data-sv-video="${id}"]`);await page.waitForFunction(()=>document.querySelectorAll('#sv-transcript .cue').length===2);
 assert.equal(await page.getAttribute('[data-bookmark="0"]','aria-pressed'),'true');assert.equal(await page.getAttribute('[data-layer="pinyin"]','aria-pressed'),'false');
 console.log('  PASS local microphone blob clears on exit while account-owned captions/bookmarks/preferences survive reload');
 await page.click('#sv-loadYoutube');await page.waitForFunction(()=>document.getElementById('sv-playerStatus').textContent.includes('Đã kết nối'));
 await page.evaluate(()=>window.__ytPlayers.at(-1).config.events.onError({data:101}));assert.match(await page.textContent('#sv-playerStatus'),/không cho phép nhúng/);assert(await page.locator('#sv-loadYoutube').isVisible());
 await page.click('#sv-loadYoutube');await page.waitForFunction(()=>document.getElementById('sv-playerStatus').textContent.includes('Đã kết nối'));
 await page.evaluate(()=>{window.__realGetMedia=navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);navigator.mediaDevices.getUserMedia=()=>new Promise(resolve=>window.__resolveMic=resolve);});await page.click('#sv-record');await page.waitForFunction(()=>!!window.__resolveMic);await page.click('#sv-backVideos');
 assert(await page.evaluate(async()=>{const stream=await window.__realGetMedia({audio:true});window.__resolveMic(stream);await new Promise(r=>setTimeout(r,50));navigator.mediaDevices.getUserMedia=window.__realGetMedia;return stream.getTracks().every(t=>t.readyState==='ended');}));
 await page.click('#wsLogoutBtn');await page.waitForFunction(()=>!document.getElementById('wsLoginBtn').hidden);await register(page,'Second video learner');await page.evaluate(()=>window.showView('shadow'));await page.click(`#sv-grid [data-sv-video="${id}"]`);assert.equal(await page.locator('#sv-transcript .cue').count(),0);assert(await page.locator('#sv-record').isDisabled());
 console.log('  PASS embed errors retry, late microphone permission releases tracks and a second account cannot see previous captions');
 for(const theme of ['light','dark'])for(const [width,height]of [[360,740],[390,844],[768,1024],[1024,768],[1440,1000],[844,390],[720,500]]){
  await page.setViewportSize({width,height});await page.evaluate(theme=>window.applyTheme(theme),theme);
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`player ${theme}/${width}`);
  await page.click('#sv-backVideos');assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`library ${theme}/${width}`);
  await page.click(`#sv-grid [data-sv-video="${id}"]`);
 }
 await page.evaluate(()=>window.showView('shadow'));await page.evaluate(()=>history.pushState(null,'','#/shadowVideo?video=missing'));await page.evaluate(()=>dispatchEvent(new PopStateEvent('popstate')));await page.locator('#shadowCard').waitFor({state:'visible'});
 assert.deepEqual(errors,[]);console.log('  PASS responsive light/dark, narrow/short screens and invalid video routes have no runtime errors');
 await context.close();
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
