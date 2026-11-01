'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {chromium}=require('playwright-core');
const {register}=require('./helpers/supabase-fixture.cjs');
const URL=process.env.TEST_URL||'http://localhost:8080/',out=path.resolve('.cache/panda-simple');
fs.mkdirSync(out,{recursive:true});
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
 const page=await browser.newPage({viewport:{width:1440,height:950}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{
  window.gameAudioNodes=0;const AC=window.AudioContext||window.webkitAudioContext;
  if(AC){const create=AC.prototype.createOscillator;AC.prototype.createOscillator=function(...args){window.gameAudioNodes++;return create.apply(this,args);};}
 });
 try{
  await page.goto(URL);await register(page,'Panda pilot');await page.evaluate(()=>window.showView('game'));
  assert.equal(await page.locator('[data-mode],#pdReadyPinyin,#gaFocusBtn,.pdRules,[data-pd="boss"]').count(),0);
  assert.equal(await page.locator('#gaOverlay button').count(),2);
  assert.equal(await page.evaluate(()=>window.__game._state.showPinyin),true);
  await page.screenshot({path:path.join(out,'desktop-ready.png')});
  console.log('  PASS ready screen has one start action and level chooser, with no modes, preflight controls or boss UI');
  await page.evaluate(()=>{window.adCalls=0;window.__pandaAds={showPreroll:async()=>{window.adCalls++;}};});
  await page.locator('#gaStartBtn').dblclick();await page.waitForFunction(()=>window.__game._state.running);
  assert.equal(await page.evaluate(()=>window.adCalls),1);
  assert.equal(await page.locator('#gaOverlay').isVisible(),false);
  const target=await page.evaluate(()=>window.__game._state.items.find(i=>!i.caught).src.pyPlain);
  const beforeShotAudio=await page.evaluate(()=>window.gameAudioNodes);
  await page.locator('#gaStage').focus();await page.keyboard.type(target[0]);
  assert((await page.evaluate(()=>window.gameAudioNodes))>beforeShotAudio,'typing a target character should play the shot sound');
  await page.evaluate(()=>window.__game.draw());
  const kick=await page.evaluate(()=>{
   const player=document.querySelector('#gaPlayer'),image=player.querySelector('img'),a=player.getBoundingClientRect(),b=image.getBoundingClientRect();
   return {recoil:Number(player.style.getPropertyValue('--pd-ship-recoil')),deltaY:(b.top+b.bottom-a.top-a.bottom)/2};
  });
  assert(kick.recoil>0&&kick.deltaY>0,JSON.stringify(kick));
  await page.screenshot({path:path.join(out,'desktop-recoil.png')});
  const beforeImpactAudio=await page.evaluate(()=>window.gameAudioNodes);
  await page.keyboard.type(target.slice(1));assert.equal(await page.evaluate(()=>window.__game._state.wordsDone),1);
  assert((await page.evaluate(()=>window.gameAudioNodes))>beforeImpactAudio,'destroying a target should play the impact sound');
  await page.waitForFunction(()=>Number(document.querySelector('#gaPlayer').style.getPropertyValue('--pd-ship-recoil'))===0);
  console.log('  PASS double start runs once, real typing recoils the ship and completes the word, then the ship settles');
  await page.click('#gaPyBtn');assert.equal(await page.evaluate(()=>window.__game._state.showPinyin),false);
  await page.locator('#gaStage').focus();await page.keyboard.press('Enter');assert.equal(await page.evaluate(()=>window.__game._state.showPinyin),true);
  await page.click('#gaKbdBtn');await page.locator('#vkbd').waitFor({state:'visible'});
  await page.click('#vkbd [data-vk="hint"]');assert.equal(await page.evaluate(()=>window.__game._state.showPinyin),false);
  await page.click('#vkbd [data-vk="hide"]');
  await page.click('#gaPauseBtn');const frozen=await page.evaluate(()=>window.__game._state.elapsed);
  await page.waitForTimeout(150);assert.equal(await page.evaluate(()=>window.__game._state.elapsed),frozen);
  await page.click('[data-pd="resume"]');
  console.log('  PASS Pinyin, keyboard hints and pause/resume remain usable in the single learning flow');
  await page.click('#gaOptionsBtn');await page.uncheck('#pdSoundSetting');await page.click('[data-pd="close-options"]');
  const muted=await page.evaluate(()=>window.gameAudioNodes);
  await page.evaluate(()=>{window.__game._update(8);const item=window.__game._state.items.find(i=>!i.caught);if(item)for(const ch of item.src.pyPlain)window.__game.typeChar(ch);});
  assert.equal(await page.evaluate(()=>window.gameAudioNodes),muted);
  await page.evaluate(()=>window.showView('games'));assert.equal(await page.evaluate(()=>window.__game._state.running),false);
  await page.evaluate(()=>window.showView('game'));await page.click('[data-pd="resume-flight"]');
  const ids=await page.evaluate(()=>window.__game._state.spawnedWordIds);assert.equal(ids.length,new Set(ids).size);
  console.log('  PASS muting suppresses game sounds and leaving/resuming preserves unique word progress');
  await page.evaluate(()=>window.showView('games'));await page.evaluate(()=>window.showView('game'));
  await page.click('#gaNewBtn');await page.click('[data-topic="family"]');
  await page.evaluate(()=>{window.__pandaAds={showPreroll:()=>new Promise(resolve=>{window.resolveLateAd=resolve;})};});
  await page.click('#gaStartBtn');await page.locator('[data-pd="cancel"]').waitFor({state:'visible'});
  await page.click('[data-pd="cancel"]');await page.evaluate(()=>window.resolveLateAd());
  assert.equal(await page.evaluate(()=>window.__game._state.running),false);
  assert(await page.locator('.pdLevelList').isVisible());
  await page.evaluate(()=>{window.__pandaAds=null;});await page.click('[data-topic="family"]');
  console.log('  PASS cancelling a preroll cannot launch a delayed game');
  for(const width of [320,390,768,1440]){
   await page.setViewportSize({width,height:844});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
   assert(await page.locator('#gaStartBtn').isVisible());await page.screenshot({path:path.join(out,width+'-simple-ready.png')});
  }
  assert.deepEqual(errors,[]);
  console.log('  PASS simplified game remains readable from 320px to desktop without runtime errors');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
