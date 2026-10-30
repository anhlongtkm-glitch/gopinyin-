'use strict';
// Run from the project root against the isolated local fixture server.
const fs=require('node:fs'),path=require('node:path');
const assert=require('node:assert/strict');
const {chromium}=require('playwright-core');
const {register}=require('../../../tests/helpers/supabase-fixture.cjs');
const output=path.resolve('.cache/mobile-phase-5-audit');
const auditUrl=new URL(process.env.AUDIT_URL||'http://127.0.0.1:8092/');
assert(['localhost','127.0.0.1','[::1]'].includes(auditUrl.hostname),'This account fixture audit must run on a local server');
const rows=[],errors=[];
(async()=>{
 fs.mkdirSync(output,{recursive:true});
 const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
 try{
  const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,reducedMotion:'reduce'});
  await context.addInitScript(()=>{if(window.speechSynthesis){speechSynthesis.speak=()=>{};speechSynthesis.getVoices=()=>[];}});
  const page=await context.newPage();page.setDefaultTimeout(12000);page.on('pageerror',e=>errors.push(e.message));
  await page.goto(auditUrl.href);await register(page,'Final mobile acceptance');
  await page.getByText('Đăng nhập thành công.',{exact:true}).waitFor({state:'hidden'});
  if(await page.evaluate(()=>document.documentElement.dataset.theme==='dark'))await page.tap('#themeToggle');
  const views={dash:'#dashView',practice:'#libraryCard',games:'#gamesCard',bear:'#bearCard',readings:'#readingsCard',ai:'#aiCard',rank:'#rankCard'};
  async function visit(view){
   if(['dash','practice','games','bear'].includes(view))await page.tap('[data-mobile-view="'+view+'"]');
   else{await page.tap('#mobileMoreBtn');await page.tap('[data-more-view="'+view+'"]');}
   await page.locator(views[view]).waitFor({state:'visible'});await page.evaluate(()=>scrollTo(0,0));await page.waitForTimeout(120);
  }
  async function capture(label){
   const result=await page.evaluate(()=>{
    const nav=[...document.querySelectorAll('.mobile-nav>button')].map(e=>{
     const r=e.getBoundingClientRect(),hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);
     return{label:e.textContent.trim(),width:r.width,height:r.height,hit:hit===e||e.contains(hit)};
    });return{width:innerWidth,height:innerHeight,scrollWidth:document.documentElement.scrollWidth,theme:document.documentElement.dataset.theme,body:document.body.className,nav};
   });
   rows.push({label,...result});assert(result.scrollWidth<=result.width,JSON.stringify(result));
   assert.equal(result.nav.length,5);assert(result.nav.every(b=>b.hit&&b.width>=44&&b.height>=44),JSON.stringify(result));
   assert(!result.body.includes('panda-active'));assert(!result.body.includes('keyboard-open'));
   await page.screenshot({path:path.join(output,label+'.png'),scale:'css'});
  }
  for(const size of [{width:320,height:568},{width:360,height:640},{width:390,height:844},{width:844,height:390}]){
   await page.setViewportSize(size);
   for(const view of Object.keys(views)){await visit(view);await capture(size.width+'x'+size.height+'-'+view);}
   console.log('  PASS seven mobile routes render without overflow and retain usable navigation at '+size.width+'x'+size.height);
  }
  await page.setViewportSize({width:390,height:844});await page.tap('#themeToggle');
  assert.equal(await page.evaluate(()=>document.documentElement.dataset.theme),'dark');
  for(const view of ['dash','practice','games']){await visit(view);await capture('dark-'+view);}
  await page.tap('#themeToggle');
  console.log('  PASS dark dashboard, library and games retain mobile navigation and viewport bounds');

  await visit('games');await page.tap('[data-view="game"]');await page.locator('#gaStartBtn').scrollIntoViewIfNeeded();await page.tap('#gaStartBtn');
  await page.waitForFunction(()=>window.__game._state.running);await page.locator('#vkbd').waitFor({state:'visible'});
  await page.tap('#gaOptionsBtn');await page.locator('[data-pd="leave"]').scrollIntoViewIfNeeded();await page.tap('[data-pd="leave"]');
  await visit('practice');await capture('game-to-practice');
  assert(await page.locator('#vkbd').isHidden());
  assert.equal(await page.locator('.workspaceHeader').evaluate(e=>getComputedStyle(e).visibility),'visible');
  await page.tap('#mobileMoreBtn');await page.locator('#mobileMoreModal').waitFor({state:'visible'});
  await page.waitForFunction(()=>document.querySelector('#mobileMoreModal').contains(document.activeElement));
  assert(await page.locator('#mobileMoreModal').evaluate(e=>e.contains(document.activeElement)));
  await page.keyboard.press('Escape');assert.deepEqual(errors,[]);
  console.log('  PASS leaving game through options restores the study navigation, header and More dialog without runtime errors');
  fs.writeFileSync(path.join(output,'environment.json'),JSON.stringify({browser:browser.version(),userAgent:await page.evaluate(()=>navigator.userAgent),emulatedMobile:true,realPhone:false,secureContext:await page.evaluate(()=>isSecureContext),origin:await page.evaluate(()=>location.origin)},null,2));
 }finally{
  await browser.close();fs.writeFileSync(path.join(output,'observations.json'),JSON.stringify({rows,errors},null,2));
 }
})().catch(e=>{console.error(e);process.exitCode=1;});
