'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require('playwright-core');
const root = path.resolve(__dirname, '..');
(async () => {
  const { build, renderHtml } = await import('../scripts/build.mjs');
  const built=path.join(root,'.cache/build-test');
  await build({outputDirectory:built});
  const html = fs.readFileSync(path.join(built,'index.html'),'utf8');
  assert(!/<!--\s*@(include|inline)\b/.test(html), 'All HTML partials must be composed');
  await assert.rejects(()=>renderHtml('../server/serve.js'),/outside src/);
  const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);
  assert.equal(ids.length,new Set(ids).size,'Duplicate HTML IDs');
  for(const match of html.matchAll(/\b(?:src|href)="([^"#]+)"/g)) {
    const value=match[1].split(/[?#]/)[0];
    if(!value||/^(https?:|data:|mailto:|tel:)/i.test(value))continue;
    assert(fs.existsSync(path.join(built,value)),`Missing public resource: ${value}`);
  }
  const files=[];
  function walk(directory){for(const entry of fs.readdirSync(directory,{withFileTypes:true})){const file=path.join(directory,entry.name);if(entry.isDirectory())walk(file);else files.push(path.relative(built,file));}}
  walk(built);
  assert(files.every(f=>f==='index.html'||f.startsWith('assets'+path.sep)), 'dist contains non-public directories');
  assert(!files.some(f=>/(^|[\\/])\.|server|pro-paid|pro-content|package|README|tests[\\/]/i.test(f)), 'Private files leaked into dist');
  const js=fs.readFileSync(path.join(built,'assets/app.js'),'utf8');
  assert(!/^\s*(import|export)\s/m.test(js),'Browser entry must be a classic script');
  const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
  try {
    const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.goto(pathToFileURL(path.join(built,'index.html')).href,{waitUntil:'domcontentloaded'});
    assert.equal(await page.evaluate(()=>typeof window.showView),'function');
    assert.equal(await page.evaluate(()=>!!window.__pron&&!!window.__game&&!!window.VK&&!!window.__gpBridge),true);
    assert(await page.locator('#dashView').isVisible(),'file:// guest dashboard works');
    assert.equal(await page.locator('[data-catalog-sentences]').textContent(),'4.969','Only HSK lessons contribute to the HSK sentence total');
    await page.locator('.ws-navItem[data-view="library"]').click();
    await page.locator('#vocabList [data-vsrc="hsk1"]').click();
    assert(await page.locator('#authModal').isVisible(),'file:// practice requires configured online authentication');
    assert.equal(await page.locator('#appCard').isVisible(),false);
    assert.deepEqual(errors,[],'file:// runtime errors');
    await page.close();
  } finally {await browser.close();}
  console.log(`PASS build: composed HTML, unique IDs, ${files.length} public files, classic IIFE, file:// smoke`);
})().catch(error=>{console.error(error);process.exitCode=1;});
