'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright-core');
const { register } = require('./helpers/supabase-fixture.cjs');
const root = path.resolve(__dirname,'..');
const saved = async page => {
  try { await page.waitForFunction(() => document.querySelector('#accountSyncStatus').textContent === 'Đã đồng bộ'); }
  catch (error) {
    const detail=await page.evaluate(()=>({status:document.querySelector('#accountSyncStatus')?.textContent,conflictVisible:!document.querySelector('#syncConflictModal')?.hidden,record:document.querySelector('#syncConflictRecord')?.textContent,alerts:[...document.querySelectorAll('[role=alert]')].filter(e=>!e.hidden).map(e=>e.textContent)}));
    throw new Error('Account did not synchronize: '+JSON.stringify(detail),{cause:error});
  }
};
async function session(page) {
  return page.evaluate(() => JSON.parse(localStorage.getItem(Object.keys(localStorage).find(k=>k.startsWith('sb-')&&k.endsWith('-auth-token')))));
}
async function login(page,email,password='password123') {
  await page.click('#wsLoginBtn'); await page.click('[data-authtab="login"]');
  await page.fill('#authEmail',email); await page.fill('#authPass',password); await page.click('#authSubmit');
  await page.locator('#authModal').waitFor({state:'hidden'}); await saved(page);
}
(async()=>{
  const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
  try {
    const context=await browser.newContext({viewport:{width:1440,height:900}}),page=await context.newPage(),errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    await page.goto(process.env.TEST_URL,{waitUntil:'networkidle'});
    assert(await page.locator('#dashView').isVisible());
    assert.equal(await page.locator('#authGoogleBtn,#authGuestBtn,#landing,#proModal').count(),0);
    for(const [view,selector] of [['practice','#libraryCard'],['readings','#readingsCard'],['games','#gamesCard'],['rank','#rankCard']]) {
      await page.click(`.ws-navItem[data-view="${view}"]`);assert(await page.locator(selector).isVisible());
    }
    await page.evaluate(()=>window.showView('game'));
    assert(await page.locator('#authModal').isVisible());
    await page.click('#authModal .modalClose');
    await page.evaluate(()=>window.__pron.open());
    assert(await page.locator('#authModal').isVisible());
    await page.click('#authModal .modalClose');
    await page.click('[data-view="practice"]');await page.click('[data-vsrc="hsk9"]');
    assert(await page.locator('#authModal').isVisible());assert.equal(await page.locator('#appCard').isVisible(),false);
    console.log('  PASS public browsing and internal practice guards');
    // Register while a protected action is pending: it must resume the selected HSK level.
    await page.click('[data-authtab="register"]');
    const email='account-'+Date.now()+'@example.test';
    await page.fill('#authName','Account learner');await page.fill('#authEmail',email);await page.fill('#authPass','password123');await page.click('#authSubmit');
    await page.locator('#appCard').waitFor({state:'visible'});await saved(page);
    assert.match(await page.locator('#fileInfo').textContent(),/9/);
    await page.evaluate(()=>{window.index=3;window.save();});await saved(page);
    const first=await session(page);
    assert(first.user.id);
    await page.click('#wsProfileBtn');
    await page.fill('#profileName','Updated learner');
    const png=await page.locator('#wsAvatar').screenshot();
    await page.setInputFiles('#profileFile',{name:'avatar.png',mimeType:'image/png',buffer:png});
    await page.waitForFunction(()=>!document.getElementById('profilePreview').hidden);
    await page.click('#profileSave');await page.locator('#profileModal').waitFor({state:'hidden'});
    assert.equal(await page.locator('#wsUserName').textContent(),'Updated learner');
    assert.equal(await page.locator('#wsAvatar img').count(),1);
    console.log('  PASS pending action resumes; profile image and display name persist');
    const secondContext=await browser.newContext(),second=await secondContext.newPage();
    await second.goto(process.env.TEST_URL,{waitUntil:'networkidle'});await login(second,email);
    assert.equal(await second.locator('#wsUserName').textContent(),'Updated learner');
    await second.click('[data-view="practice"]');await second.click('[data-vsrc="hsk9"]');await second.locator('#appCard').waitFor({state:'visible'});
    assert.equal(await second.evaluate(()=>window.index),3);
    // Force genuine CAS conflict between devices without changing either UI's cache.
    const config=await page.evaluate(()=>window.APP_CONFIG);
    const body={p_kind:'kv',p_record_id:'gp:dailyGoal',p_payload:'21',p_expected_version:0,p_deleted:false};
    const headers={'Content-Type':'application/json',apikey:config.SUPABASE_PUBLISHABLE_KEY,Authorization:'Bearer '+first.access_token};
    const record=await (await fetch(config.SUPABASE_URL+'/rest/v1/rpc/put_learning_record',{method:'POST',headers,body:JSON.stringify(body)})).json();
    const collision=await (await fetch(config.SUPABASE_URL+'/rest/v1/rpc/put_learning_record',{method:'POST',headers,body:JSON.stringify({...body,p_payload:'22'})})).json();
    assert.equal(record.record.version,1);assert.equal(collision.conflict,true);
    // Seed before the app starts: live sync timers must not overwrite this conflict fixture.
    await second.addInitScript(uid=>{
      const key='gp:account-cache:'+uid,cache=JSON.parse(localStorage.getItem(key)||'{}');
      cache[JSON.stringify(['kv','gp:dailyGoal'])]={kind:'kv',record_id:'gp:dailyGoal',payload:'22',deleted:false,dirty:true,version:0,edit:1};
      localStorage.setItem(key,JSON.stringify(cache));
    },first.user.id);
    await second.reload({waitUntil:'networkidle'});
    await second.locator('#syncConflictModal').waitFor({state:'visible'});
    await second.click('#syncKeepRemote');await saved(second);
    assert.equal(await second.evaluate(uid=>JSON.parse(localStorage.getItem('gp:account-cache:'+uid))[JSON.stringify(['kv','gp:dailyGoal'])].payload,first.user.id),'21');
    await context.setOffline(true);
    await page.waitForFunction(()=>!document.getElementById('accountAccessNotice').hidden);
    await page.fill('#pinyinInput','test').catch(()=>{});
    await context.setOffline(false);await saved(page);
    console.log('  PASS cross-device progress, version checks and reconnect');
    await page.click('#wsProfileBtn');await page.locator('.passwordDetails summary').click();
    await page.fill('#currentPassword','wrong');await page.fill('#newPassword','changed123');await page.click('#passwordForm button');
    await page.waitForFunction(()=>!document.getElementById('passwordError').hidden);
    await page.fill('#currentPassword','password123');await page.click('#passwordForm button');
    await page.waitForFunction(()=>document.getElementById('currentPassword').value==='');
    await page.click('#profileModal .modalClose');await page.click('#wsLogoutBtn');
    assert.equal(await page.locator('#wsUserName').textContent(),'Khách');assert(await page.locator('#dashView').isVisible());
    assert.equal(await page.evaluate(()=>localStorage.getItem('gp:local-signout')),'true');
    await page.click('#wsLoginBtn');await page.click('#authForgotBtn');await page.fill('#authEmail',email);
    await Promise.all([page.waitForResponse(r=>new URL(r.url()).pathname==='/auth/v1/recover'&&r.request().method()==='POST'),page.click('#authSubmit')]);
    await page.goto(new URL('?account=recovery&code='+encodeURIComponent('fixture-recovery:'+email),process.env.TEST_URL).href,{waitUntil:'networkidle'});
    await page.waitForFunction(()=>document.getElementById('authTitle').textContent==='Đặt lại mật khẩu');
    assert(await page.locator('#authModal').isVisible());
    assert.equal(await page.evaluate(()=>localStorage.getItem('gp:local-signout')),null);
    await page.fill('#authPass','recovered123');await page.click('#authSubmit');
    await page.locator('#authModal').waitFor({state:'hidden'});await saved(page);
    await page.click('#wsLogoutBtn');
    console.log('  PASS PKCE password recovery after explicit logout restores the reset form');
    await register(page,'Other account');
    assert.equal(await page.evaluate(()=>window.__gpBridge.loadProgress('vocab:hsk9')),null);
    const other=await session(page);
    const forbidden=await fetch(config.SUPABASE_URL+'/rest/v1/profiles?id=eq.'+first.user.id,{headers:{apikey:config.SUPABASE_PUBLISHABLE_KEY,Authorization:'Bearer '+other.access_token}});
    assert.equal(forbidden.status,403);
    await page.click('#wsLogoutBtn');await login(page,email,'recovered123');
    assert.equal(await page.locator('#wsUserName').textContent(),'Updated learner');
    assert.deepEqual(errors,[]);
    console.log('  PASS password reauthentication, account isolation and logout');
    await secondContext.close();await context.close();
    const legacyContext=await browser.newContext(),legacy=await legacyContext.newPage();
    await legacy.goto(process.env.TEST_URL,{waitUntil:'networkidle'});
    const oldProgress=JSON.stringify({mainOrder:[0,1,2],mainIndex:2,stats:{correct:2}});
    await legacy.evaluate(value=>{localStorage.setItem('cts:progress:vocab:hsk1',value);localStorage.setItem('gp:users','{"old":{"pass":"do-not-upload"}}');},oldProgress);
    await legacy.click('#wsLoginBtn');await legacy.click('[data-authtab="register"]');
    await legacy.fill('#authName','Legacy learner');await legacy.fill('#authEmail','legacy-'+Date.now()+'@example.test');await legacy.fill('#authPass','password123');await legacy.click('#authSubmit');
    await legacy.locator('#legacyImportModal').waitFor({state:'visible'});await legacy.click('#legacyImport');
    await legacy.locator('#legacyImportModal').waitFor({state:'hidden'});await saved(legacy);
    assert.equal(await legacy.evaluate(()=>window.__gpBridge.loadProgress('vocab:hsk1').mainIndex),2);
    assert.equal(await legacy.evaluate(()=>localStorage.getItem('cts:progress:vocab:hsk1')),oldProgress);
    assert.equal(await legacy.evaluate(()=>Object.values(JSON.parse(localStorage.getItem(Object.keys(localStorage).find(k=>k.startsWith('gp:account-cache:'))))).some(r=>r.record_id==='gp:users')),false);
    await legacyContext.close();
    console.log('  PASS explicit legacy import preserves originals and excludes old password hashes');
    // Public no-config mode must remain usable and fail closed for practice.
    for(const theme of ['light','dark'])for(const device of ['desktop','mobile']) {
      const ctx=await browser.newContext({viewport:device==='desktop'?{width:1440,height:900}:{width:390,height:844}});
      await ctx.addInitScript(theme=>localStorage.setItem('cts:theme',theme),theme);
      await ctx.route('**/assets/config.js',route=>route.fulfill({contentType:'text/javascript',body:'window.APP_CONFIG = {};'}));
      const p=await ctx.newPage();await p.goto(process.env.TEST_URL,{waitUntil:'networkidle'});
      assert(await p.locator('#dashView').isVisible());assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
      await p.click(device==='mobile'?'[data-mobile-view="practice"]':'.ws-navItem[data-view="practice"]');await p.click('[data-vsrc="hsk4"]');assert(await p.locator('#authModal').isVisible());
      fs.mkdirSync(path.join(root,'.cache/accounts'),{recursive:true});
      await p.screenshot({path:path.join(root,`.cache/accounts/${theme}-${device}.png`),fullPage:true});
      await ctx.close();
    }
    console.log('  PASS missing configuration and responsive light/dark guest UI');
  } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
