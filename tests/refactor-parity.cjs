/* Record before refactoring; compare against the same isolated browser afterwards.
   Artifacts are kept outside source in .cache/refactor-parity. */
const { chromium } = require('playwright-core');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const recording = process.argv.includes('--record');
const dir = path.join(root, '.cache/refactor-parity', recording ? 'before' : 'after');
const url = process.env.TEST_URL || 'http://localhost:8080/';
if(!recording&&!fs.existsSync(path.join(root,'.cache/refactor-parity/before/light-desktop-landing.json'))) {
  throw new Error('Missing baseline. Record the pre-change application first: TEST_URL=<baseline URL> node tests/refactor-parity.cjs --record');
}
(async () => {
  fs.mkdirSync(dir, { recursive: true });
  const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
  const failures = [];
  try {
    for (const theme of ['light', 'dark']) for (const device of ['desktop', 'mobile']) {
      const context = await browser.newContext({ viewport: device === 'desktop' ? { width:1440,height:900 } : { width:390,height:844 }, reducedMotion:'reduce' });
      // Remove network/font/voice variability; no API or microphone calls are made.
      await context.route(/fonts\.(googleapis|gstatic)\.com/, route => route.fulfill({ status:200,contentType:'text/css',body:'' }));
      await context.addInitScript(theme => { localStorage.setItem('cts:theme',theme); Object.defineProperty(speechSynthesis,'getVoices',{value:()=>[]}); let seed=12345; Math.random=()=>((seed=(seed*1664525+1013904223)>>>0)/4294967296); },theme);
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', e=>errors.push(e.message));
      await page.goto(url,{waitUntil:'networkidle'});
      await page.addStyleTag({content:'*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important} .toast{visibility:hidden!important}'});
      const take = async screen => {
        await page.waitForTimeout(screen === 'landing' ? 1800 : 650);
        const name = `${theme}-${device}-${screen}`;
        const snapshot = await page.evaluate(() => [...document.querySelectorAll('[id]')].filter(e=>e.getBoundingClientRect().width&&e.getBoundingClientRect().height&&!e.closest('#toastHost')).map(e=>{
          const r=e.getBoundingClientRect(),s=getComputedStyle(e);
          return {id:e.id,tag:e.tagName,cls:e.className?.baseVal??e.className,rect:[r.x,r.y,r.width,r.height].map(v=>Math.round(v*100)/100),color:s.color,bg:s.backgroundColor,font:s.fontFamily,fontSize:s.fontSize};
        }));
        fs.writeFileSync(path.join(dir,name+'.json'),JSON.stringify(snapshot,null,2));
        await page.screenshot({path:path.join(dir,name+'.png'),fullPage:true});
        if(!recording){
          const expected=JSON.parse(fs.readFileSync(path.join(root,'.cache/refactor-parity/before',name+'.json'),'utf8'));
          try{assert.deepEqual(snapshot,expected);}catch{failures.push(name);}
          if(!fs.readFileSync(path.join(dir,name+'.png')).equals(fs.readFileSync(path.join(root,'.cache/refactor-parity/before',name+'.png'))))failures.push(name+'/pixels');
        }
      };
      await take('landing');
      await page.locator('#lpLoginBtn').evaluate(e=>e.click());await page.click('#authGuestBtn');
      await take('dashboard');
      await page.locator('.ws-navItem[data-view="library"]').click();
      await page.locator('#vocabList [data-vsrc="hsk1"]').click();
      await take('typing');
      await page.locator('.ws-navItem[data-view="pron"]').click();
      await take('pronunciation-picker');
      await page.locator('#pronLibCard [data-psrc="hsk:hsk1"]').click();
      await take('pronunciation');
      if(errors.length)failures.push({theme,device,errors});
      await context.close();
    }
    const result={mode:recording?'record':'compare',screens:20,failures};
    fs.writeFileSync(path.join(dir,'result.json'),JSON.stringify(result,null,2));
    console.log(JSON.stringify(result,null,2));
    assert.equal(failures.length,0,'Parity check failed');
  } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
