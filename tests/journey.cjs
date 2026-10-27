'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {chromium}=require('playwright-core');
const {register}=require('./helpers/supabase-fixture.cjs');
(async()=>{
 const source=fs.readFileSync(path.join(__dirname,'../src/features/journey/model.js'),'utf8');
 const {applyActivity,emptyDay,bearLevel,localDay,weeklyProgress}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
 let day=emptyDay();
 for(let i=0;i<5;i++)day=applyActivity(day,'typing','sentence'+i).day;
 assert.equal(day.xp,20); assert.deepEqual(day.claimed,['typing']);
 assert.strictEqual(applyActivity(day,'typing','sentence0').day,day);
 for(let i=0;i<3;i++)day=applyActivity(day,'game','stage'+i).day;
 assert.equal(day.gameXp,20);assert.equal(day.xp,40);
 assert.equal(bearLevel(99).level,1);assert.deepEqual(bearLevel(100),{level:2,current:0,needed:125});assert.equal(bearLevel(225).level,3);assert.equal(bearLevel(999999).level,20);
 assert.equal(localDay(new Date(2026,0,2,0,1)), '2026-01-02');
 const history=[1,2,3,4].map(d=>({date:`2026-06-0${d}`,events:{a:true}}));
 assert.deepEqual(weeklyProgress(history,new Date(2026,5,5)),{activeDays:4,earned:['2026-06-01']});
 assert.deepEqual(weeklyProgress(history,new Date(2026,5,9)),{activeDays:0,earned:['2026-06-01']});
 console.log('  PASS reward IDs deduplicate, daily quests pay once, game cap and level boundaries are exact');
 const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream']});
 try{
 const context=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce'});
 const page=await context.newPage(),errors=[]; page.on('pageerror',e=>errors.push(e.message));
 await page.goto(process.env.TEST_URL,{waitUntil:'networkidle'});await register(page,'Journey learner');
 await page.evaluate(()=>window.showView('readings'));
 assert.equal(await page.locator('[data-reading]').count(),6);
 await page.click('[data-reading="hello"]');
 await page.check('[name=q0][value="0"]');await page.check('[name=q1][value="1"]');await page.check('[name=q2][value="0"]');
 await page.click('#readingQuiz button[type=submit]');assert.match(await page.textContent('#readingResult'),/2\/3/);
 await page.click('#readingQuiz button[type=submit]');
 await page.evaluate(()=>window.showView('bear'));assert.match(await page.textContent('#bearProgress'),/25 XP/);
 console.log('  PASS original reading grades comprehension and grants completion plus quest XP once');
 await page.evaluate(()=>window.showView('tones'));await page.click('#toneStart');
 const hanToTone={'妈':0,'麻':1,'马':2,'骂':3,'吗':4};
 for(let i=0;i<5;i++){const han=(await page.locator('#toneQuiz [lang]').textContent()).trim();await page.click(`[data-tone-answer="${hanToTone[han]}"]`);}
 await page.evaluate(()=>window.showView('bear'));assert.match(await page.textContent('#bearProgress'),/35 XP/);
 console.log('  PASS tone round accepts five correct answers and stores the earned XP');
 await page.evaluate(()=>window.showView('shadowText'));await page.click('#shadowRecord');await page.waitForFunction(()=>document.getElementById('shadowStatus').textContent.includes('Đang ghi âm'));
 await page.waitForTimeout(2200);await page.click('#shadowRecord');await page.locator('#shadowPlayback').waitFor({state:'visible'});
 assert.match(await page.textContent('#shadowStatus'),/chưa phải kết quả chấm/);
 await page.evaluate(()=>window.showView('bear'));assert.match(await page.textContent('#bearProgress'),/40 XP/);assert.equal(await page.locator('#shadowPlayback').getAttribute('src'),null);
 console.log('  PASS shadowing records a real local blob, awards one valid clip and clears it on navigation');
 await page.click('.bearPreferences summary');await page.selectOption('#journeyEffects','off');assert.equal(await page.evaluate(()=>document.documentElement.dataset.effects),'off');
 await page.evaluate(async()=>{await window.dbPut({id:'journey-draft',name:'Nháp Gõ / Nói',rows:[{id:0,zh:'你好。',py:'nǐ hǎo',vi:'Xin chào.'}],createdAt:Date.now(),updatedAt:Date.now()});await window.openDataset('journey-draft');window.autoSound=false;window.readOnType=false;});
 await page.fill('#pinyinInput','你');await page.evaluate(()=>{const el=document.getElementById('pinyinInput');el.setSelectionRange(0,1);});
 await page.click('#appCard [data-practice-mode=speaking]');await page.locator('#pronCard').waitFor({state:'visible'});
 await page.click('#pronCard [data-practice-mode=typing]');await page.locator('#appCard').waitFor({state:'visible'});
 assert.equal(await page.inputValue('#pinyinInput'),'你');assert.deepEqual(await page.evaluate(()=>{const el=document.getElementById('pinyinInput');return[el.selectionStart,el.selectionEnd];}),[0,1]);
 console.log('  PASS same-sentence Gõ / Nói preserves partial text and selection; effects preference changes no study data');
 await page.evaluate(()=>window.__pron.start('hsk:hsk2'));await page.locator('#pronCard').waitFor({state:'visible'});
 const expectedSentence=await page.evaluate(()=>window.__pron._state.items[window.__pron._state.order[window.__pron._state.index]].zh);
 await page.click('#pronCard [data-practice-mode=typing]');await page.locator('#appCard').waitFor({state:'visible'});
 assert.equal(await page.evaluate(()=>window.activeDataset.id),'vocab:hsk2');assert.equal(await page.evaluate(()=>window.currentRow().zh),expectedSentence);
 console.log('  PASS legacy pronunciation sources also switch into the matching typing dataset and sentence');
 for(const theme of ['light','dark'])for(const [width,height]of [[360,740],[390,844],[768,1024],[1024,768],[1440,1000],[844,390]]){
  await page.setViewportSize({width,height});await page.evaluate(theme=>{document.documentElement.dataset.theme=theme;},theme);
  for(const view of ['dash','practice','readings','tones','shadow','bear']){
   await page.evaluate(view=>window.showView(view),view);await page.waitForTimeout(100);
   const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1);assert.equal(overflow,false,`${view} ${theme} ${width} overflows`);
  }
 }
 assert.deepEqual(errors,[]);console.log('  PASS new views fit mobile and desktop in both themes without runtime errors');
 await context.close();
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
