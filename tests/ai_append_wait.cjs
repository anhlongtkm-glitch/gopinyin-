'use strict';
const assert=require('node:assert/strict');
const {chromium}=require('playwright-core');
const {register}=require('./helpers/supabase-fixture.cjs');
const {aiRows,chooseAiKind,autoAiChoice,advanceAi}=require('./helpers/ai-fixture.cjs');
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
 try{
  for(const saved of [false,true]){
   const page=await browser.newPage(),errors=[],held=[];let requests=0;
   page.on('pageerror',e=>errors.push(e.message));await page.goto(process.env.TEST_URL,{waitUntil:'networkidle'});await register(page,'AI waiting '+saved);await autoAiChoice(page,saved);
   const respond=(route,batch)=>route.fulfill({contentType:'application/json',body:JSON.stringify({text:JSON.stringify(aiRows(batch))})});
   await page.route('**/__waiting_ai__',async route=>{requests++;if(requests===1)return respond(route,0);held.push(route);});
   await page.evaluate(()=>{window.APP_CONFIG.AI_PROXY_URL='/__waiting_ai__';return window.showView('ai');});await chooseAiKind(page,'word');await page.fill('#aiPrompt','Đồ uống và hoa quả');await page.click('#aiStartBtn');await page.locator('#appCard').waitFor({state:'visible'});
   for(let i=0;i<10;i++)await advanceAi(page);
   await page.waitForFunction(()=>window.index===10&&window.aiSession.pending===1);
   assert.equal(requests,2);assert.equal(await page.locator('#pinyinInput').evaluate(i=>i.readOnly),true);
   assert.equal(held.length,1);await respond(held.shift(),1);
   await page.waitForFunction(()=>window.rows.length===20&&!document.getElementById('pinyinInput').readOnly);
   assert.equal(await page.evaluate(()=>window.currentRow().zh),aiRows(1)[0].zh);
   for(let i=0;i<100&&!held.length;i++)await page.waitForTimeout(10);
   assert.equal(requests,3,'The ten-item milestone follows the delayed five-item request');
   console.log('  PASS '+(saved?'saved':'temporary')+' AI leaves the exhausted waiting screen as soon as delayed content arrives');
   for(let i=0;i<10;i++)await advanceAi(page);
   const failing=held.shift();assert(failing);
   await failing.fulfill({status:429,headers:{'Retry-After':'0'},contentType:'application/json',body:'{"error":"quota"}'});
   await page.waitForFunction(()=>window.aiSession.stopped&&window.aiSession.pending===0);
   assert(await page.locator('#completeArea').isVisible());assert(await page.locator('#aiRetryBtn').isVisible());
   await page.click('#aiRetryBtn');
   for(let batch=2;batch<=4;batch++){
    for(let i=0;i<100&&!held.length;i++)await page.waitForTimeout(10);
    const next=held.shift();assert(next,'Expected one pending request for the next learned milestone');await respond(next,batch);
   }
   await page.waitForFunction(()=>window.rows.length===50&&window.aiSession.pending===0);
   assert.equal(requests,6);assert.equal(await page.evaluate(()=>window.index),20);
   assert.equal(await page.evaluate(()=>window.currentRow().zh),aiRows(2)[0].zh);
   assert.equal(await page.locator('#pinyinInput').evaluate(i=>i.readOnly),false);
   assert.equal(await page.locator('#aiCreateDialog').isVisible(),false);
   if(saved)assert.equal(await page.evaluate(()=>window.activeDataset.rows.length),50);
   assert.deepEqual(errors,[]);console.log('  PASS '+(saved?'saved':'temporary')+' quota Retry unlocks study and services each missed five-item milestone once');
   await page.close();
  }
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
