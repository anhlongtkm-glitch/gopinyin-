'use strict';
const assert = require('node:assert/strict');
const {chromium} = require('playwright-core');
const {register} = require('./helpers/supabase-fixture.cjs');
const batches = [
  [['茶叶','chá yè','lá trà'],['红茶','hóng chá','trà đen'],['绿茶','lǜ chá','trà xanh'],['白茶','bái chá','trà trắng'],['茶水','chá shuǐ','nước trà']],
  [['杯子','bēi zi','cốc'],['牛奶','niú nǎi','sữa bò'],['咖啡','kā fēi','cà phê'],['开水','kāi shuǐ','nước đun sôi'],['果汁','guǒ zhī','nước trái cây']],
  [['苹果','píng guǒ','táo'],['西瓜','xī guā','dưa hấu'],['香蕉','xiāng jiāo','chuối'],['葡萄','pú tao','nho'],['草莓','cǎo méi','dâu tây']]
].map(batch=>batch.map(([zh,py,vi])=>({zh,py,vi})));
async function advance(page) {
  const answer=await page.evaluate(()=>window.currentRow().zh);
  await page.fill('#pinyinInput',answer);
  await page.waitForFunction(()=>window.awaitingEnter===true);
  await page.click('#typingNextBtn');
}
async function assertResumed(page,total,first) {
  await page.waitForFunction(total=>window.rows.length===total&&window.aiSession.pending===0,total);
  assert.equal(await page.locator('#pinyinInput').evaluate(input=>input.readOnly),false,'A successful append must unlock the input after the learner reaches the waiting screen');
  assert.equal(await page.locator('#chinese').evaluate(node=>node.textContent.replace(/[^\u3400-\u9fff]/g,'')),first.zh);
  assert.equal(await page.locator('#vietnamese').textContent(),first.vi);
  assert(await page.locator('#completeArea').isHidden());
  assert(await page.locator('#aiGenBar').isHidden());
}
(async()=>{
  const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
  try {
    for(const saved of [false,true]) {
      const page=await browser.newPage(),errors=[];
      page.on('pageerror',error=>errors.push(error.message));
      await page.addInitScript(()=>localStorage.setItem('gp:aiVerify','0'));
      await page.goto(process.env.TEST_URL,{waitUntil:'networkidle'});
      await register(page,'AI waiting '+(saved?'saved':'temporary'));
      let held,requests=0;
      const respond=(route,items)=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({text:JSON.stringify(items)})});
      await page.route('**/api/ai',async route=>{
        requests++;
        if(requests===1)return respond(route,batches[0]);
        held=route;
      });
      await page.evaluate(()=>{window.APP_CONFIG.AI_PROXY_URL='/api/ai';return window.showView('ai');});
      await page.selectOption('#aiKind','word');
      await page.fill('#aiPrompt','từ vựng đồ uống và hoa quả');
      await page.click('#aiStartBtn');
      await page.locator('#appModal.show').waitFor();
      await page.click(saved?'#appModalOk':'#appModalCancel');
      if(saved){await page.fill('#appModalInput','Bộ AI không treo');await page.click('#appModalOk');}
      await page.locator('#appCard').waitFor({state:'visible'});
      await page.evaluate(()=>{window.autoSound=false;window.readOnType=false;});
      assert.equal(requests,1);
      for(let i=0;i<3;i++)await advance(page);
      await page.waitForFunction(()=>window.aiSession.pending===1);
      for(let i=0;i<100&&!held;i++)await page.waitForTimeout(10);
      assert(held);assert.equal(requests,2);
      for(let i=0;i<2;i++)await advance(page);
      assert.equal(await page.evaluate(()=>window.index),5);
      assert.equal(await page.locator('#chinese').textContent(),'⏳');
      assert.equal(await page.locator('#pinyinInput').evaluate(input=>input.readOnly),true);
      const delayed=held;held=null;await respond(delayed,batches[1]);
      await assertResumed(page,10,batches[1][0]);
      assert.equal(requests,2,'Finishing the last two items must reuse the pending request');
      console.log('  PASS '+(saved?'saved':'temporary')+' AI resumes immediately when a prefetched batch arrives after the last answer');

      for(let i=0;i<3;i++)await advance(page);
      for(let i=0;i<100&&!held;i++)await page.waitForTimeout(10);
      assert(held);assert.equal(requests,3);
      for(let i=0;i<2;i++)await advance(page);
      const failing=held;held=null;
      await failing.fulfill({status:429,headers:{'Retry-After':'0'},contentType:'application/json',body:JSON.stringify({error:'quota'})});
      await page.waitForFunction(()=>window.aiSession.stopped&&window.aiSession.pending===0);
      assert(await page.locator('#completeArea').isVisible());
      assert(await page.locator('#quizArea').isHidden());
      assert.match(await page.locator('#completeArea h2').textContent(),/Tạm dừng/);
      assert(await page.locator('#aiRetryBtn').isVisible());
      await page.click('#aiRetryBtn');
      for(let i=0;i<100&&!held;i++)await page.waitForTimeout(10);
      assert(held,JSON.stringify({requests,errors,state:await page.evaluate(()=>({pending:window.aiSession.pending,stopped:window.aiSession.stopped,paused:window.aiSession.paused,index:window.index,retryAt:window.aiSession.retryAt,now:Date.now()}))}));assert.equal(requests,4);
      const retried=held;held=null;await respond(retried,batches[2]);
      await assertResumed(page,15,batches[2][0]);
      await advance(page);
      assert.equal(await page.evaluate(()=>window.index),11);
      if(saved)assert.equal(await page.evaluate(()=>window.activeDataset.rows.length),15);
      assert.deepEqual(errors,[]);
      console.log('  PASS '+(saved?'saved':'temporary')+' AI leaves the waiting screen on quota failure and resumes after Retry');
      await page.close();
    }
  } finally {await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
