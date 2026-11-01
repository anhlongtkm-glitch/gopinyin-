'use strict';
const assert=require('node:assert/strict');
const {chromium}=require('playwright-core');
const {register}=require('./helpers/supabase-fixture.cjs');
const {aiRows,chooseAiKind}=require('./helpers/ai-fixture.cjs');
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
 try{
  const page=await browser.newPage(),errors=[],prompts=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(process.env.TEST_URL,{waitUntil:'networkidle'});await register(page,'AI content modes');
  await page.route('**/__kind_ai__',r=>{
   const prompt=r.request().postDataJSON().prompt;prompts.push(prompt);
   let rows=aiRows(0);
   if(prompt.includes('chia ĐỀU'))rows=rows.map((x,i)=>i%2?{zh:'我喜欢'+x.zh+'。',py:'wǒ xǐ huān '+x.py,vi:'Tôi thích '+x.vi}:x);
   return r.fulfill({contentType:'application/json',body:JSON.stringify({text:JSON.stringify(rows)})});
  });
  await page.evaluate(()=>{window.APP_CONFIG.AI_PROXY_URL='/__kind_ai__';return window.showView('ai');});
  assert(await page.locator('#aiSentenceChoice').isChecked());assert.equal(await page.locator('#aiWordChoice').isChecked(),false);
  await chooseAiKind(page,'word');assert.match(await page.locator('#aiPromptLabelText').textContent(),/TỪ VỰNG/);
  assert.equal(await page.inputValue('#aiKind'),'word');
  await chooseAiKind(page,'both');assert(await page.locator('#aiSentenceChoice').isChecked());assert(await page.locator('#aiWordChoice').isChecked());
  assert.match(await page.locator('#aiPromptLabelText').textContent(),/CÂU và TỪ VỰNG/);
  console.log('  PASS visible independent Câu/Từ vựng controls support either kind or both and update the labels');
  await chooseAiKind(page,'word');await page.fill('#aiPrompt','Từ vựng ngành bao bì, dưới 3 chữ');await page.click('#aiStartBtn');await page.click('#aiCreateDialog [value="save"]');await page.locator('#appCard').waitFor({state:'visible'});
  assert.match(prompts[0],/đúng 10 TỪ hoặc CỤM TỪ/);assert.match(prompts[0],/ngành bao bì/);assert.equal(await page.evaluate(()=>window.rows.length),10);
  await page.fill('#pinyinInput',aiRows(0)[0].zh);await page.waitForFunction(()=>window.awaitingEnter);assert.match(await page.locator('#feedback').textContent(),/từ tiếp theo/);
  await page.click('#typingNextBtn');assert.equal(await page.evaluate(()=>window.index),1);
  await page.evaluate(()=>window.showView('ai'));assert.match(await page.locator('#aiSets .aiSetBadge').first().textContent(),/Từ vựng/);assert.match(await page.locator('#aiSets .libraryMeta').first().textContent(),/10 từ/);
  console.log('  PASS word-only generation requests ten short items; typing and saved badges use vocabulary units');
  await chooseAiKind(page,'both');await page.fill('#aiPrompt','Giao tiếp trong quán trà');await page.click('#aiStartBtn');await page.click('#aiCreateDialog [value="save"]');await page.locator('#appCard').waitFor({state:'visible'});
  assert.match(prompts.at(-1),/chia ĐỀU/);assert.match(prompts.at(-1),/Xen kẽ/);
  const types=await page.evaluate(()=>({type:window.activeDataset.contentType,short:window.rows.filter(r=>!r.zh.endsWith('。')).length,sentences:window.rows.filter(r=>r.zh.endsWith('。')).length}));
  assert.deepEqual(types,{type:'both',short:5,sentences:5});assert.deepEqual(errors,[]);
  console.log('  PASS selecting both creates a ten-item lesson containing five words and five sentences');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
