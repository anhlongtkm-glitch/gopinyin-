const fs=require('node:fs'),path=require('node:path');
const {chromium}=require('playwright-core');
const {register}=require('../../tests/helpers/supabase-fixture.cjs');
const out=path.resolve('docs/mobile-audit-2026-10-30');fs.mkdirSync(out,{recursive:true});
const results=[];
async function measure(page){return page.evaluate(()=>{
 const rect=e=>{if(!e||!e.getClientRects().length)return null;const r=e.getBoundingClientRect();const x=Math.min(innerWidth-1,Math.max(0,r.x+r.width/2)),y=Math.min(innerHeight-1,Math.max(0,r.y+r.height/2));const hit=document.elementFromPoint(x,y);return {x:r.x,y:r.y,w:r.width,h:r.height,bottom:r.bottom,hit:!!hit&&(hit===e||e.contains(hit)),coveredBy:hit?.id||hit?.className};};
 return {width:innerWidth,height:innerHeight,scrollWidth:document.documentElement.scrollWidth,scrollHeight:document.documentElement.scrollHeight,scrollY,coarse:matchMedia('(pointer:coarse)').matches,touch:navigator.maxTouchPoints,keyboard:rect(document.querySelector('#vkbd:not([hidden])')),card:rect(document.querySelector('#gameCard:not(.hidden)')),stage:rect(document.querySelector('#gameCard:not(.hidden) #gaStage')),ship:rect(document.querySelector('#gameCard:not(.hidden) #gaPlayer')),controls:Object.fromEntries(['gaFocusBtn','gaKbdBtn','gaOptionsBtn','gaPyBtn','gaPauseBtn','gaStartBtn','pronMicBtn','pinyinInput','typingNextBtn','pronNextBtn'].map(id=>[id,rect(document.getElementById(id))]))};
 });}
async function capture(page,label){await page.waitForTimeout(200);const row={label,...await measure(page)};results.push(row);await page.screenshot({path:path.join(out,label+'.png')});console.log(JSON.stringify(row));}
(async()=>{
 const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream']});
 try{
 const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,permissions:['microphone'],reducedMotion:'reduce'});
 await context.addInitScript(()=>{if(window.speechSynthesis){speechSynthesis.speak=()=>{};speechSynthesis.getVoices=()=>[];}});
 const page=await context.newPage();page.setDefaultTimeout(8000);page.on('pageerror',e=>results.push({pageerror:e.message}));
 await page.goto('http://127.0.0.1:8092/');await register(page,'Mobile audit');
 for(const size of [{width:390,height:844},{width:360,height:640},{width:320,height:568},{width:844,height:390}]){
  await page.setViewportSize(size);
  for(const view of ['dash','practice','games','bear','readings','ai','rank']){
   await page.evaluate(v=>window.showView(v),view);await page.evaluate(()=>scrollTo(0,0));await capture(page,`${size.width}x${size.height}-${view}`);
  }
 }
 await page.setViewportSize({width:390,height:844});
 await page.evaluate(async()=>{await window.dbPut({id:'mobile-audit',name:'Mobile audit',rows:[{id:0,zh:'你好。',py:'nǐ hǎo',vi:'Xin chào.'}],createdAt:Date.now(),updatedAt:Date.now()});await window.openDataset('mobile-audit');});
 await capture(page,'390-typing');await page.tap('#pinyinInput');await page.fill('#pinyinInput','你好');await capture(page,'390-typing-correct');
 await page.evaluate(()=>scrollTo(0,document.documentElement.scrollHeight));await capture(page,'390-typing-scrolled');await page.evaluate(()=>scrollTo(0,0));
 await page.locator('#appCard [data-practice-mode="speaking"]').click();await page.locator('#pronMicBtn').waitFor({state:'visible'});await capture(page,'390-speaking');
 // Fault injection: deterministic browser API failures, no real speech claimed.
 for(const mode of ['throw','network','end-interim','valid-final']){
  await page.evaluate(mode=>{
   window.__auditAsr=null;
   window.SpeechRecognition=class {constructor(){window.__auditAsr=this;}start(){if(mode==='throw')throw new DOMException('Test startup failure','InvalidStateError');if(mode==='network')setTimeout(()=>{this.onerror?.({error:'network'});this.onend?.();},100);}stop(){this.onend?.();}};
   window.webkitSpeechRecognition=window.SpeechRecognition;
  },mode);
  await page.tap('#pronMicBtn');await page.waitForTimeout(700);
  const start=await page.locator('#pronStatus').innerText();
  if(mode==='end-interim'||mode==='valid-final')await page.evaluate(mode=>{
   const emit=(t,final)=>window.__auditAsr.onresult({resultIndex:0,results:[Object.assign([{transcript:t,confidence:0.9}],{isFinal:final})]});
   emit('你好',mode==='valid-final');
   window.__auditAsr.onend?.();
  },mode);
  const state=await page.evaluate(()=>({phase:window.__pron._state.phase,asrText:window.__pron._state.asrText,asrInterim:window.__pron._state.asrInterim,asrErr:window.__pron._state.asrErr,lang:window.__auditAsr?.lang}));
  await capture(page,'speech-'+mode+'-listening');
  await page.tap('#pronMicBtn');await page.waitForTimeout(3100);
  results.push({speechCase:mode,start,state,after:await page.locator('#pronStatus').innerText()});
 }
 await page.evaluate(()=>{localStorage.removeItem('gp:vk');window.showView('games');});await page.tap('[data-view="game"]');await page.locator('#gaStartBtn').waitFor({state:'visible'});
 await capture(page,'390-game-ready');await page.tap('#gaStartBtn');await page.waitForFunction(()=>window.__game._state.running);await page.locator('#vkbd').waitFor({state:'visible'});
 for(const size of [{width:390,height:844},{width:360,height:640},{width:320,height:568},{width:844,height:390}]){await page.setViewportSize(size);await capture(page,`${size.width}x${size.height}-game-keyboard`);}
 await page.setViewportSize({width:390,height:844});
 const next=await page.evaluate(()=>window.__game._state.items.find(i=>!i.caught&&!i.missed)?.src.pyPlain[0]);
 if(next){await page.tap('#vkbd [data-vk="'+next+'"]');results.push({keyboardExpected:next,keyboardInput:await page.evaluate(()=>window.__game._state.buffer)});}
 try{await page.tap('#gaOptionsBtn');await capture(page,'390-game-settings-keyboard');}catch(e){results.push({settingsUnreachable:e.message});}
 await page.tap('#vkbd [data-vk="hide"]');await page.tap('#gaOptionsBtn');await capture(page,'390-game-settings-after-hide');
 await page.evaluate(()=>window.showView('games'));await capture(page,'390-game-exit');
 await context.close();
 }finally{await browser.close();fs.writeFileSync(path.join(out,'observations.json'),JSON.stringify(results,null,2));}
})().catch(e=>{console.error(e);process.exitCode=1});
