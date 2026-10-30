'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const {chromium}=require('playwright-core');
const {register}=require('./helpers/supabase-fixture.cjs');
const output=path.resolve('.cache/study-mobile-next'),observations=[];
(async()=>{
 fs.mkdirSync(output,{recursive:true});
 const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream']});
 try{
  const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,reducedMotion:'reduce',permissions:['microphone']});
  await context.addInitScript(()=>{
   if(window.speechSynthesis){speechSynthesis.speak=()=>{};speechSynthesis.getVoices=()=>[];}
   window.SpeechRecognition=window.webkitSpeechRecognition=class{
    start(){window.__nextRecognizer=this;this.onstart?.();}
    stop(){this.onend?.();}abort(){this.onend?.();}
   };
  });
  const page=await context.newPage(),errors=[];page.setDefaultTimeout(10000);page.on('pageerror',e=>errors.push(e.message));
  await page.goto(process.env.TEST_URL||'http://localhost:8080/');await register(page,'Next action mobile');
  await page.getByText('Đăng nhập thành công.',{exact:true}).waitFor({state:'hidden'});
  let sequence=0;
  async function lesson(rows=[{id:0,zh:'你好。',py:'nǐ hǎo',vi:'Xin chào.'}]){
   await page.evaluate(async({id,rows})=>{await window.dbPut({id,name:'Mobile Next',rows,createdAt:Date.now(),updatedAt:Date.now()});await window.openDataset(id);window.autoSound=false;window.readOnType=false;},{id:'next-'+(++sequence),rows});
   await page.waitForTimeout(240);await page.tap('#pinyinInput');
  }
  async function visibleNext(selector,label){
   await page.waitForFunction(selector=>{
    const e=document.querySelector(selector);if(!e||e.disabled||!e.getClientRects().length)return false;
    const r=e.getBoundingClientRect(),v=visualViewport,head=document.querySelector('.top').getBoundingClientRect();
    let bottom=v.offsetTop+v.height-12;
    for(const selector of ['.mobile-nav','#vkbd']){const el=document.querySelector(selector);if(el?.getClientRects().length&&getComputedStyle(el).visibility!=='hidden')bottom=Math.min(bottom,el.getBoundingClientRect().top-12);}
    const hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);
    return r.top>=Math.max(v.offsetTop+12,head.bottom+12)-1&&r.bottom<=bottom+1&&(hit===e||e.contains(hit));
   },selector);
   const bounds=await page.locator(selector).evaluate(e=>{const r=e.getBoundingClientRect();return{top:r.top,bottom:r.bottom,scroll:scrollY,focus:document.activeElement.id,width:innerWidth,height:innerHeight,inset:document.documentElement.style.getPropertyValue('--study-bottom-inset')};});
   observations.push({label,...bounds});await page.screenshot({path:path.join(output,label+'.png'),scale:'css'});
  }
  for(const size of [{width:390,height:844},{width:360,height:640}]){
   await page.setViewportSize(size);await lesson();await page.fill('#pinyinInput','你好');
   await visibleNext('#typingNextBtn',size.width+'-correct-next');
   assert.equal(await page.evaluate(()=>document.activeElement.id),'pinyinInput');
   await page.tap('#typingNextBtn');assert.equal(await page.evaluate(()=>window.index),1);
  }
  console.log('  PASS correct answers at 390 and 360px reveal a tappable Next above navigation without stealing input focus');
  await lesson();
  const before=await page.evaluate(()=>{const e=document.querySelector('#pinyinInput');e.dispatchEvent(new CompositionEvent('compositionstart',{bubbles:true}));e.value='你好';e.dispatchEvent(new InputEvent('input',{bubbles:true,isComposing:true}));return scrollY;});
  await page.waitForTimeout(100);assert(await page.locator('#typingNextBtn').isDisabled());assert.equal(await page.evaluate(()=>scrollY),before);
  await page.evaluate(()=>document.querySelector('#pinyinInput').dispatchEvent(new CompositionEvent('compositionend',{bubbles:true,data:'你好'})));
  await visibleNext('#typingNextBtn','ime-committed-next');
  console.log('  PASS IME composition does not grade or move the page until committed Chinese input is complete');
  await lesson();await page.tap('#vkBtn');await page.locator('#vkbd').waitFor({state:'visible'});
  await page.fill('#pinyinInput','你好');await visibleNext('#typingNextBtn','virtual-keyboard-next');
  await page.tap('#vkbd [data-vk="hide"]');await visibleNext('#typingNextBtn','virtual-keyboard-closed');
  console.log('  PASS Next accounts for the app keyboard and navigation using the most restrictive edge');
  await page.setViewportSize({width:390,height:844});await lesson();
  await page.evaluate(()=>{Object.defineProperty(visualViewport,'height',{configurable:true,value:500});visualViewport.dispatchEvent(new Event('resize'));});
  await page.waitForTimeout(100);await page.fill('#pinyinInput','你好');await visibleNext('#typingNextBtn','native-viewport-shrunk');
  assert(await page.evaluate(()=>parseFloat(document.documentElement.style.getPropertyValue('--study-bottom-inset'))>0));
  await page.evaluate(()=>{delete visualViewport.height;visualViewport.dispatchEvent(new Event('resize'));});
  await visibleNext('#typingNextBtn','native-viewport-restored');
  assert.equal(await page.evaluate(()=>document.documentElement.style.getPropertyValue('--study-bottom-inset')),'0px');
  console.log('  PASS a shrinking visual viewport reserves enough scroll space and removes the extra inset after keyboard close');
  await lesson([{id:0,zh:'我们今天一起去学校学习中文然后和朋友一起吃饭。',py:'wǒ men jīn tiān yì qǐ qù xué xiào xué xí zhōng wén rán hòu hé péng you yì qǐ chī fàn',vi:'Chúng tôi cùng nhau đi học tiếng Trung rồi ăn cơm với bạn bè. '.repeat(5)}]);
  await page.fill('#pinyinInput',await page.evaluate(()=>window.currentRow().zh));await visibleNext('#typingNextBtn','long-sentence-next');
  await page.tap('#typingQuickViToggle');await visibleNext('#typingNextBtn','long-sentence-layout');
  console.log('  PASS multiline sentences and changing long meanings leave the completed action reachable');
  await lesson();
  const deliberate=await page.evaluate(()=>{const e=document.querySelector('#pinyinInput');e.value='你好';e.dispatchEvent(new Event('input',{bubbles:true}));document.dispatchEvent(new WheelEvent('wheel',{bubbles:true,deltaY:-100}));scrollTo(0,0);return scrollY;});
  await page.waitForTimeout(200);assert.equal(await page.evaluate(()=>scrollY),deliberate);
  await lesson();
  await page.evaluate(()=>{const e=document.querySelector('#pinyinInput');e.value='你好';e.dispatchEvent(new Event('input',{bubbles:true}));document.querySelector('#typingOptionsBtn').click();});
  await page.waitForTimeout(150);assert(await page.locator('#typingSettings').evaluate(e=>e.open));assert(await page.locator('#typingSettings').evaluate(e=>e.contains(document.activeElement)));
  await page.keyboard.press('Escape');
  console.log('  PASS deliberate scrolling and an open dialog cancel pending reveals and preserve dialog focus');
  await page.waitForTimeout(550);await lesson();
  const routed=await page.evaluate(async()=>{
   const e=document.querySelector('#pinyinInput');e.value='你好';e.dispatchEvent(new Event('input',{bubbles:true}));
   await window.showView('games');scrollTo(0,0);return scrollY;
  });
  await page.waitForTimeout(180);assert(await page.locator('#gamesCard').isVisible());assert.equal(await page.evaluate(()=>scrollY),routed);
  console.log('  PASS navigating away cancels a completed question reveal before it can scroll the next screen');
  await lesson([{id:0,zh:'我们今天一起去学校学习中文然后和朋友一起吃饭。',py:'wǒ men jīn tiān yì qǐ qù xué xiào xué xí zhōng wén rán hòu hé péng you yì qǐ chī fàn',vi:'Chúng tôi cùng đi học và ăn cơm với bạn bè. '.repeat(8)}]);await page.tap('#appCard [data-practice-mode="speaking"]');
  await page.locator('#pronMicBtn').waitFor({state:'visible'});await page.tap('#pronMicBtn');await page.waitForFunction(()=>window.__pron._state.phase==='recording');
  await page.evaluate(()=>{const s=window.__pron._state,r=window.__nextRecognizer,t=s.items[s.order[s.index]].zh;r.onresult({resultIndex:0,results:[Object.assign([{transcript:t,confidence:0.98}],{isFinal:true})]});r.onend();});
  await page.waitForFunction(()=>window.__pron._state.phase==='result');await visibleNext('#pronNextBtn','speaking-result-next');
  await page.tap('#pronNextBtn');assert.equal(await page.evaluate(()=>window.__pron._state.index),1);
  console.log('  PASS a completed speech result reveals Next without the older result-scroll competing with it');
  await page.evaluate(()=>window.showView('games'));assert.equal(await page.evaluate(()=>document.documentElement.style.getPropertyValue('--study-bottom-inset')),'0px');assert.deepEqual(errors,[]);
 }finally{await browser.close();fs.writeFileSync(path.join(output,'observations.json'),JSON.stringify(observations,null,2));}
})().catch(e=>{console.error(e);process.exitCode=1;});
