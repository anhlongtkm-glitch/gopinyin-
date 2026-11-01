'use strict';
const assert=require('node:assert/strict');
const {chromium}=require('playwright-core');
const {register}=require('./helpers/supabase-fixture.cjs');
const {aiRows,chooseAiKind}=require('./helpers/ai-fixture.cjs');
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
 try{
  const page=await browser.newPage(),errors=[];
  await page.addInitScript(()=>Object.defineProperty(window.crypto,'randomUUID',{value:undefined,configurable:true}));
  page.on('pageerror',e=>errors.push(e.message));await page.goto(process.env.TEST_URL,{waitUntil:'networkidle'});await register(page,'AI save flow');
  let n=0;await page.route('**/__save_ai__',r=>r.fulfill({contentType:'application/json',body:JSON.stringify({text:JSON.stringify(aiRows(n++))})}));
  const open=()=>page.evaluate(()=>{window.APP_CONFIG.AI_PROXY_URL='/__save_ai__';return window.showView('ai');});
  const start=async(prompt,save,name)=>{
   await open();await page.fill('#aiPrompt',prompt);await page.click('#aiStartBtn');await page.locator('#aiCreateDialog').waitFor({state:'visible'});
   if(name!==undefined)await page.fill('#aiCreateName',name);
   await page.click('#aiCreateDialog [value="'+(save?'save':'temporary')+'"]');await page.locator('#appCard').waitFor({state:'visible'});
  };
  await open();assert(await page.locator('#aiPane').isVisible());assert(await page.locator('#aiSetsWrap').isVisible());
  await page.click('[data-ai-create]');assert(await page.locator('#aiPrompt').evaluate(e=>e===document.activeElement));
  await chooseAiKind(page,'word');await start('Giao tiếp hằng ngày',false);
  assert.equal(await page.evaluate(()=>window.activeDataset),null);assert.equal(await page.evaluate(async()=>(await window.dbGetAll()).filter(d=>d.kind==='ai').length),0);
  console.log('  PASS temporary study opens after its explicit choice and creates no saved set');
  await start('Đồ uống',true,'Bài trà');const id=await page.evaluate(()=>window.activeDataset.id);
  assert.equal(await page.evaluate(()=>window.activeDataset.name),'Bài trà');assert.equal(await page.evaluate(()=>window.rows.length),10);
  await page.evaluate(()=>{window.index=1;window.save();});await open();
  await page.fill('#aiSetSearch','không tồn tại');assert.equal(await page.locator('#aiSets article').count(),0);
  await page.fill('#aiSetSearch','Đồ uống');assert.equal(await page.locator('#aiSets article').count(),1);
  await page.click('#aiSets [data-aiact="study"]');await page.locator('#appCard').waitFor({state:'visible'});assert.equal(await page.evaluate(()=>window.index),1);
  console.log('  PASS a saved lesson retains its custom name, searchable prompt and cursor');
  await start('Bài thứ hai',true,'');const second=await page.evaluate(()=>window.activeDataset.id);assert.equal(await page.evaluate(()=>window.activeDataset.name),'Bài thứ hai');
  await open();await page.fill('#aiSetSearch','');
  await page.locator('[data-aiact="rename"][data-id="'+id+'"]').click();await page.fill('#appModalInput','Trà đổi tên');await page.click('#appModalOk');
  await page.waitForFunction(id=>document.querySelector('[data-aiid="'+id+'"] h3')?.textContent==='Trà đổi tên',id);
  assert.equal(await page.locator('#aiSets article:first-child').getAttribute('data-aiid'),second);
  await page.waitForFunction(()=>document.getElementById('accountSyncStatus').textContent==='Đã đồng bộ');await page.reload({waitUntil:'networkidle'});await open();
  await page.locator('[data-aiact="study"][data-id="'+id+'"]').click();await page.locator('#appCard').waitFor({state:'visible'});assert.equal(await page.evaluate(()=>window.index),1);
  await open();await page.locator('[data-aiact="del"][data-id="'+id+'"]').click();await page.click('#appModalOk');
  await page.waitForFunction(id=>!document.querySelector('[data-aiid="'+id+'"]'),id);
  assert.equal(await page.evaluate(async id=>(await window.dbGetAll()).some(d=>d.id===id),id),false);assert.deepEqual(errors,[]);
  console.log('  PASS default naming, renaming, recency, reload and deletion work in the unified screen');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
