'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const {chromium}=require('playwright-core');
const {register}=require('./helpers/supabase-fixture.cjs');
const output=path.resolve('.cache/panda-mobile-controls'),observations=[];
(async()=>{
 fs.mkdirSync(output,{recursive:true});
 const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
 try{
  const context=await browser.newContext({viewport:{width:320,height:568},isMobile:true,hasTouch:true,reducedMotion:'reduce'});
  await context.addInitScript(()=>{if(window.speechSynthesis){speechSynthesis.speak=()=>{};speechSynthesis.getVoices=()=>[];}});
  const page=await context.newPage(),errors=[];page.setDefaultTimeout(12000);
  page.on('pageerror',e=>errors.push(e.message));
  const tap=async selector=>{await page.locator(selector).scrollIntoViewIfNeeded();await page.locator(selector).tap();};
  const state=()=>page.evaluate(()=>{const g=window.__game._state;return {score:g.score,buffer:g.buffer,lives:g.lives,elapsed:g.elapsed};});
  await page.goto(process.env.TEST_URL||'http://localhost:8080/');await register(page,'Mobile controls');
  await page.tap('[data-mobile-view="games"]');await page.tap('[data-view="game"]');
  await tap('[data-mode="practice"]');
  await page.locator('#pdReadyPinyin').uncheck();
  await tap('#gaStartBtn');await page.waitForFunction(()=>window.__game._state.running);
  await page.locator('#vkbd').waitFor({state:'visible'});
  assert(await page.locator('#gaFocusBtn').isDisabled());
  assert.match(await page.locator('#gaFocusBtn').getAttribute('aria-label'),/Cần 5/);
  for(const size of [{width:320,height:568},{width:360,height:640},{width:390,height:844},{width:412,height:915}]){
   await page.setViewportSize(size);await page.waitForTimeout(150);
   const bounds=await page.evaluate(()=>{
    const keyboard=document.querySelector('#vkbd').getBoundingClientRect(),stage=document.querySelector('#gaStage').getBoundingClientRect();
    const controls=['gaFocusBtn','gaPyBtn','gaKbdBtn','gaOptionsBtn','gaPauseBtn'].map(id=>{
     const e=document.getElementById(id),r=e.getBoundingClientRect(),hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);
     return {id,width:r.width,height:r.height,top:r.top,bottom:r.bottom,hit:hit===e||e.contains(hit)};
    });return {width:innerWidth,height:innerHeight,stage:stage.height,keyboardTop:keyboard.top,controls,scrollWidth:document.documentElement.scrollWidth};
   });
   observations.push(bounds);
   assert(bounds.stage>=112);assert(bounds.scrollWidth<=bounds.width);
   assert(bounds.controls.every(c=>c.hit&&c.width>=44&&c.height>=44&&c.top>=0&&c.bottom<=bounds.keyboardTop),JSON.stringify(bounds));
   await page.screenshot({path:path.join(output,size.width+'x'+size.height+'-controls.png'),scale:'css'});
  }
  console.log('  PASS all five touch controls remain visible and unobscured at 320, 360, 390 and 412px widths');
  await page.setViewportSize({width:320,height:568});
  async function target(){
   for(let tick=0;tick<5;tick++){
    const value=await page.evaluate(()=>window.__game._state.items.filter(i=>!i.caught&&!i.dying&&!i.heart).sort((a,b)=>b.y-a.y||a.id-b.id)[0]?.src.pyPlain);
    if(value)return value;
    await page.evaluate(()=>window.__game._update(8));
   }throw Error('No live vocabulary target');
  }
  for(let word=1;word<=5;word++){
   const py=await target();
   for(const ch of py)await page.tap('#vkbd [data-vk="'+ch+'"]');
   await page.waitForFunction(n=>window.__game._state.wordsDone===n,word);
  }
  assert.equal(await page.evaluate(()=>window.__game._state.cleanWords),5);
  assert.equal(await page.evaluate(()=>window.__game._state.focusCharges),1);
  await page.waitForFunction(()=>!document.getElementById('gaFocusBtn').disabled);
  await page.tap('#gaFocusBtn');
  assert.equal(await page.evaluate(()=>window.__game._state.focusCharges),0);
  assert(await page.evaluate(()=>window.__game._state.focusLeft>0&&window.__game._state.focusLeft<=4));
  assert(await page.locator('#gaFocusBtn').isDisabled());
  assert.equal(await page.locator('#gaFocusBtn').getAttribute('aria-pressed'),'true');
  assert.match(await page.locator('#pdFeedback').innerText(),/Tập trung/);
  await page.screenshot({path:path.join(output,'focus-active.png'),scale:'css'});
  console.log('  PASS five clean words typed through touch earn one Focus charge and a single tap activates it once');

  const py=await target();await page.tap('#vkbd [data-vk="'+py[0]+'"]');
  const before=await state();
  await page.tap('#gaOptionsBtn');await page.locator('#pdSoundSetting').waitFor({state:'visible'});
  assert(await page.locator('#vkbd').isHidden());assert.equal(await page.evaluate(()=>localStorage.getItem('gp:vk')),'1');
  assert.equal(await page.evaluate(()=>window.__game._state.paused),true);
  const paused=await state();await page.waitForTimeout(200);assert.deepEqual(await state(),paused);
  assert.equal(paused.buffer,before.buffer);assert.equal(paused.score,before.score);
  await page.locator('.pdPanel').focus();await page.keyboard.press('Space');
  assert.equal(await page.evaluate(()=>window.__game._state.paused),true);
  await page.locator('#pdSoundSetting').uncheck();
  await page.screenshot({path:path.join(output,'options-mobile.png'),scale:'css'});
  await tap('[data-pd="close-options"]');await page.locator('#vkbd').waitFor({state:'visible'});
  assert.equal(await page.evaluate(()=>window.__game._state.paused),false);
  assert.equal((await state()).buffer,before.buffer);
  console.log('  PASS options pauses the flight and hides the keyboard without changing its preference, then restores input and play');

  await page.tap('#gaPauseBtn');await page.tap('#gaOptionsBtn');
  assert.equal(await page.locator('#pdSoundSetting').isChecked(),false);
  await page.locator('#pdSoundSetting').focus();await page.keyboard.press('Escape');
  await page.locator('#vkbd').waitFor({state:'visible'});
  assert.equal(await page.evaluate(()=>window.__game._state.paused),true);
  await tap('[data-pd="resume"]');
  await page.tap('#vkbd [data-vk="hide"]');await tap('#gaOptionsBtn');await tap('[data-pd="close-options"]');
  assert(await page.locator('#vkbd').isHidden());assert.equal(await page.evaluate(()=>localStorage.getItem('gp:vk')),'0');
  await tap('#gaKbdBtn');
  console.log('  PASS options preserves an existing pause, sound setting and an explicitly hidden keyboard; Escape works from an input');

  await page.tap('#gaOptionsBtn');await tap('[data-pd="fullscreen"]');
  await page.waitForFunction(()=>document.fullscreenElement?.id==='gameCard');
  await page.waitForFunction(()=>document.querySelector('[data-pd="fullscreen"]').getAttribute('aria-pressed')==='true');
  assert.match(await page.locator('[data-pd="fullscreen"]').innerText(),/Thoát/);
  await tap('[data-pd="close-options"]');await page.locator('#vkbd').waitFor({state:'visible'});
  assert.equal(await page.evaluate(()=>document.querySelector('#vkbd').parentElement===document.fullscreenElement),true);
  await page.waitForFunction(()=>document.querySelector('#gaStage').getBoundingClientRect().bottom<=document.querySelector('#vkbd').getBoundingClientRect().top);
  await page.tap('#gaOptionsBtn');await tap('[data-pd="fullscreen"]');
  await page.waitForFunction(()=>!document.fullscreenElement);
  await tap('[data-pd="close-options"]');await page.locator('#vkbd').waitFor({state:'visible'});
  console.log('  PASS real fullscreen is reachable through options and restores a working keyboard inside and after fullscreen');

  await page.tap('#gaOptionsBtn');await page.setViewportSize({width:844,height:390});
  await tap('[data-pd="close-options"]');await page.locator('#pdViewportNotice').waitFor({state:'visible'});
  assert.equal(await page.evaluate(()=>window.__game._state.paused),true);
  await page.setViewportSize({width:320,height:568});await page.locator('#pdViewportNotice').waitFor({state:'hidden'});
  await tap('[data-pd="resume"]');await page.tap('#gaOptionsBtn');await tap('[data-pd="leave"]');
  await page.locator('#gamesCard').waitFor({state:'visible'});assert(await page.locator('#vkbd').isHidden());
  console.log('  PASS closing options after rotation respects the viewport pause; leaving from options dismisses keyboard and flight');

  await page.tap('[data-view="game"]');await tap('#gaNewBtn');await tap('[data-mode="challenge"]');await tap('#gaStartBtn');
  await page.waitForFunction(()=>window.__game._state.running);
  await page.locator('#vkbd').waitFor({state:'visible'});await page.tap('#gaOptionsBtn');
  assert.equal(await page.evaluate(()=>window.__game._state.mode),'practice');
  assert.equal(await page.evaluate(()=>window.__game._state.interruptedChallenge),true);
  await tap('[data-pd="close-options"]');
  assert.equal(await page.evaluate(()=>window.__game._state.paused),false);
  assert.deepEqual(errors,[]);
  console.log('  PASS opening options during a challenge follows the existing pause rule and resumes as practice');
  await page.evaluate(()=>window.showView('games'));
 }finally{await browser.close();fs.writeFileSync(path.join(output,'observations.json'),JSON.stringify(observations,null,2));}
})().catch(error=>{console.error(error);process.exitCode=1});
