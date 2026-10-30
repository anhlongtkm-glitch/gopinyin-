'use strict';
// Package approved generated artwork; keep the masters outside the public asset allowlist.
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright-core');
const root = path.resolve(__dirname, '..');
(async () => {
  const browser = await chromium.launch({ executablePath:process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless:true });
  const report = [];
  try {
    const page = await browser.newPage();
    for (const asset of [
      { source:'word-frame-master.png', target:'word-frame.webp', width:768, crop:true },
      { source:'word-frame-master.png', target:'word-frame-small.webp', width:384, crop:true },
      { source:'space-approved-master.png', target:'space-approved.webp', width:1672 },
      { source:'space-approved-master.png', target:'space-approved-small.webp', width:1024 }
    ]) {
      const input = fs.readFileSync(path.join(root, 'design-review/panda-du-hanh/refinement', asset.source));
      const prepared = await page.evaluate(async ({ data, width, crop }) => {
        const img = new Image(); img.src = data; await img.decode();
        const src = document.createElement('canvas'); src.width = img.naturalWidth; src.height = img.naturalHeight;
        const ctx = src.getContext('2d', { willReadFrequently:true }); ctx.drawImage(img, 0, 0);
        let x = 0, y = 0, w = src.width, h = src.height;
        if (crop) {
          const pixels = ctx.getImageData(0, 0, w, h).data;
          let left = w, right = 0, top = h, bottom = 0, transparent = 0;
          for (let row = 0; row < h; row++) for (let col = 0; col < w; col++) {
            const a = pixels[(row * w + col) * 4 + 3];
            if (a < 16) transparent++;
            if (a > 32) { left = Math.min(left, col); right = Math.max(right, col); top = Math.min(top, row); bottom = Math.max(bottom, row); }
          }
          if (transparent < w * h * .1) throw new Error('Frame must have real transparent alpha');
          x = Math.max(0, left - 8); y = Math.max(0, top - 8); w = Math.min(src.width - x, right - x + 9); h = Math.min(src.height - y, bottom - y + 9);
        }
        const out = document.createElement('canvas'); out.width = width; out.height = Math.round(width * h / w);
        const dest = out.getContext('2d'); dest.imageSmoothingQuality = 'high'; dest.drawImage(src, x, y, w, h, 0, 0, out.width, out.height);
        return { base64:out.toDataURL('image/webp', .9).split(',')[1], width:out.width, height:out.height, sourceBounds:{ x,y,w,h } };
      }, { data:'data:image/png;base64,' + input.toString('base64'), width:asset.width, crop:!!asset.crop });
      const bytes = Buffer.from(prepared.base64, 'base64');
      fs.writeFileSync(path.join(root, 'assets/game/panda-du-hanh', asset.target), bytes);
      report.push({ file:asset.target, width:prepared.width, height:prepared.height, bytes:bytes.length, sourceBounds:prepared.sourceBounds });
    }
    fs.writeFileSync(path.join(root, 'design-review/panda-du-hanh/refinement/asset-report.json'), JSON.stringify(report, null, 2));
    console.log(JSON.stringify(report.map(({file,width,height,bytes}) => ({file,width,height,bytes}))));
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
