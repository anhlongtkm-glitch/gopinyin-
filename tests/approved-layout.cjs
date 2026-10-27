'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {chromium}=require('playwright-core');
const {register}=require('./helpers/supabase-fixture.cjs');
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
 const out=path.resolve(process.env.GP_REVIEW_SHOTS||path.join(__dirname,'../.cache/test-run/approved-layout'));fs.mkdirSync(out,{recursive:true});
 try{
 const page=await browser.newPage({viewport:{width:1440,height:1100},reducedMotion:'reduce'}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(process.env.TEST_URL,{waitUntil:'networkidle'});await register(page,'Người học GoPinyin');
 const view=async name=>{await page.evaluate(name=>window.showView(name),name);await page.waitForTimeout(120);};
 const shot=async name=>{for(const toast of await page.locator('#toastHost .toast').all())if(await toast.isVisible())await toast.click();await page.mouse.move(0,0);await page.evaluate(()=>document.fonts.ready);await page.waitForFunction(()=>[...document.querySelectorAll('.mascot-image')].filter(img=>img.getClientRects().length).every(img=>img.complete));await page.screenshot({path:path.join(out,name+'.png'),fullPage:true});};
 const rect=selector=>page.locator(selector).boundingBox();
 await page.evaluate(()=>window.applyTheme('light'));await view('dash');
 const header=await rect('#topBar'),hero=await rect('.dashHero'),art=await rect('.dashWelcomeArt'),choice=await rect('.dashChoose'),quests=await rect('.dashQuestPanel'),bear=await rect('.dashBearPanel');
 assert(header.width>=1400&&header.height<120,'Header must be horizontal, with no vertical sidebar');
 assert(hero.x<=44&&hero.width>=1340&&hero.height>=330,'Approved full-width hero was not applied');
 assert(art.width>=300&&art.x>hero.x+hero.width/2,'Large bear must sit inside the right half of the hero');
 assert(choice.y>=hero.y+hero.height&&Math.abs(quests.y-bear.y)<2&&bear.x>quests.x+quests.width,'Choice strip and quest/bear columns must match the approved structure');
 await shot('dashboard-light-1440');console.log('  PASS horizontal header, large right-side bear, choice strip and quest/bear columns match approved geometry');
 await view('practice');assert.equal(await page.locator('.practiceGroupCard').count(),6);await page.click('[data-hsk-level="2"]');assert.equal(await page.locator('.practiceGroupCard').count(),6);
 const total=await page.locator('.practiceGroupCard>span:not(.featureEyebrow):not(.groupIcon)').allTextContents();assert.equal(total.reduce((sum,text)=>sum+Number(text.match(/\/\s*(\d+)/)?.[1]||0),0),558,'Six HSK 2 stages must cover every existing sentence');
 await page.click('[data-hsk-level="1"]');await shot('practice-light-1440');
 await page.click('[data-practice-group="0"]');await page.locator('#appCard').waitFor({state:'visible'});assert.equal(await page.evaluate(()=>window.activeDataset.id),'practice:hsk1-topic:hello');
 const preservedGroup=await page.locator('[data-practice-group="0"]').elementHandle();
 const main=await rect('#appCard .studyMainPanel'),aside=await rect('#appCard .studyContext');assert(aside.x>=main.x+main.width+18&&main.width>900,'Typing must use a wide learning card and a distinct right-hand context column');
 await page.click('#hintBtn');await page.locator('#appCard').scrollIntoViewIfNeeded();await page.evaluate(()=>scrollTo(0,0));await shot('typing-light-1440');
 await page.click('#appCard [data-practice-mode=speaking]');await page.locator('#pronCard').waitFor({state:'visible'});await page.evaluate(()=>scrollTo(0,0));await shot('speaking-light-1440');
 assert(await preservedGroup.evaluate(node=>node.isConnected),'Switching study mode must not rebuild the hidden HSK catalog');
 console.log('  PASS HSK topic/stage cards load real content and both study modes use the approved two-column shell');
 await view('readings');await page.click('[data-reading="family"]');await page.evaluate(()=>scrollTo(0,0));await shot('reading-light-1440');
 await page.click('[data-reading-shadow="family"]');await page.locator('#shadowTextCard').waitFor({state:'visible'});assert.equal(await page.inputValue('#shadowSource'),'1');await shot('shadow-light-1440');
 await view('tones');await page.click('#toneStart');assert(await page.locator('#toneExamples').isHidden());await shot('tones-light-1440');
 await view('games');await shot('games-light-1440');await view('bear');assert.equal(await page.locator('#bearBadges .bearBadge').count(),6);assert.equal(await page.locator('.bearMilestone').count(),4);await shot('bear-light-1440');
 console.log('  PASS reading-to-shadowing keeps the selected lesson; feature pages and badge/milestone panels have distinct approved structures');
 for(const theme of ['light','dark'])for(const width of [360,390,768,1024,1440]){
  await page.setViewportSize({width,height:width<500?844:1000});await page.evaluate(theme=>window.applyTheme(theme),theme);
  for(const name of ['dash','practice','tones','shadow','games','bear']){
   await view(name);assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`${name}/${theme}/${width} overflows`);
   if([390,1440].includes(width))await shot(`${name}-${theme}-${width}`);
  }
 }
 // The pilot remembers speaking independently from the saved typing cursor.
 await view('practice');await page.click('[data-hsk-level="1"]');await page.click('[data-practice-group="0"]');await page.locator('#pronCard').waitFor({state:'visible'});
 for(const theme of ['light','dark'])for(const width of [390,1440]){
  await page.setViewportSize({width,height:width===390?844:1100});await page.evaluate(theme=>window.applyTheme(theme),theme);
  await page.click('#pronCard [data-practice-mode=typing]');await page.locator('#appCard').waitFor({state:'visible'});await page.evaluate(()=>scrollTo(0,0));await shot(`typing-${theme}-${width}`);
  await page.click('#appCard [data-practice-mode=speaking]');await page.locator('#pronCard').waitFor({state:'visible'});await page.evaluate(()=>scrollTo(0,0));await shot(`speaking-${theme}-${width}`);
 }
 // At 720 CSS px this exercises the same layout width as a 1440px window zoomed to 200%.
 await page.setViewportSize({width:720,height:500});await page.click('#pronCard [data-practice-mode=typing]');await page.locator('#appCard').waitFor({state:'visible'});
 assert(await page.locator('#appCard .studyContext').isHidden());await page.click('#typingOptionsBtn');assert(await page.locator('#typingSettings').isVisible());await page.keyboard.press('Escape');
 assert.deepEqual(errors,[]);console.log('  PASS five widths, light/dark, reduced-motion and narrow study/settings remain usable without runtime errors');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
