'use strict';
// Deterministic asset packaging only: resize and encode the imagegen masters.
// Uses the Chrome already required by the project's browser checks; no image dependency.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { chromium } = require('playwright-core');

const POSES = [
  'welcome', 'guide', 'search', 'connection', 'reading', 'typing', 'listening', 'speaking',
  'thinking', 'ready', 'approve', 'encourage', 'clap', 'celebrate', 'star', 'trophy',
  'face-neutral', 'face-focus', 'face-happy', 'face-thinking', 'face-encourage', 'face-excited'
];
const root = path.resolve(__dirname, '..');

async function prepare() {
  const mapArgument = process.argv.find(argument => argument.startsWith('--map='));
  const mapFile = path.resolve(root, mapArgument ? mapArgument.slice(6) : '.cache/mascot-generated.json');
  const sources = JSON.parse(fs.readFileSync(mapFile, 'utf8').replace(/^\uFEFF/, ''));
  const partial = process.argv.includes('--partial');
  if (!partial) for (const pose of POSES) assert(sources[pose], 'Missing imagegen master: ' + pose);
  const output = path.join(root, 'assets/mascot');
  fs.mkdirSync(output, { recursive: true });
  const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
  const report = [];
  try {
    const page = await browser.newPage();
    for (const pose of POSES) {
      if (!sources[pose]) continue;
      const source = path.resolve(root, sources[pose]);
      const mime = path.extname(source).toLowerCase() === '.webp' ? 'image/webp' : 'image/png';
      const data = 'data:' + mime + ';base64,' + fs.readFileSync(source).toString('base64');
      const result = await page.evaluate(async ({ data, face }) => {
        const image = new Image();
        image.src = data;
        await image.decode();
        const sourceCanvas = document.createElement('canvas');
        sourceCanvas.width = image.naturalWidth;
        sourceCanvas.height = image.naturalHeight;
        const sourceContext = sourceCanvas.getContext('2d', { willReadFrequently: true });
        sourceContext.drawImage(image, 0, 0);
        const pixels = sourceContext.getImageData(0, 0, sourceCanvas.width, sourceCanvas.height).data;
        let transparent = 0, visible = 0;
        for (let i = 3; i < pixels.length; i += 4) {
          if (pixels[i] < 16) transparent++;
          if (pixels[i] > 128) visible++;
        }
        const encode = size => {
          const canvas = document.createElement('canvas');
          canvas.width = size; canvas.height = size;
          const context = canvas.getContext('2d');
          context.imageSmoothingEnabled = true;
          context.imageSmoothingQuality = 'high';
          const ratio = Math.min(size / image.naturalWidth, size / image.naturalHeight);
          const width = Math.round(image.naturalWidth * ratio), height = Math.round(image.naturalHeight * ratio);
          context.drawImage(image, Math.floor((size - width) / 2), Math.floor((size - height) / 2), width, height);
          const encoded = canvas.toDataURL('image/webp', .86);
          return { size, encoded, alpha: context.getImageData(0, 0, 1, 1).data[3] };
        };
        return {
          sourceWidth: image.naturalWidth, sourceHeight: image.naturalHeight,
          transparentRatio: transparent / (pixels.length / 4), visibleRatio: visible / (pixels.length / 4),
          versions: [encode(face ? 256 : 512), encode(face ? 128 : 256)]
        };
      }, { data, face: pose.startsWith('face-') });
      assert(result.transparentRatio > .01, pose + ' must have genuine transparent pixels');
      assert(result.visibleRatio > .01, pose + ' must contain visible character artwork');
      const versions = [];
      for (let i = 0; i < result.versions.length; i++) {
        const version = result.versions[i];
        assert(version.encoded.startsWith('data:image/webp;base64,'), 'Chrome failed WebP encoding');
        const file = pose + (i ? '-small' : '') + '.webp';
        const bytes = Buffer.from(version.encoded.split(',')[1], 'base64');
        fs.writeFileSync(path.join(output, file), bytes);
        versions.push({ file, size: version.size, bytes: bytes.length, cornerAlpha: version.alpha });
      }
      report.push({ pose, source: path.relative(root, source), sourceWidth: result.sourceWidth, sourceHeight: result.sourceHeight, transparentRatio: result.transparentRatio, visibleRatio: result.visibleRatio, versions });
      console.log('[mascot] ' + pose + ': ' + versions.map(v => v.size + 'px/' + Math.round(v.bytes / 1024) + 'KB').join(', '));
    }
    // A labeled review board; checkerboard displays the packaged alpha accurately.
    const thumbnails = report.map(item => ({ pose: item.pose, src: 'data:image/webp;base64,' + fs.readFileSync(path.join(output, item.pose + '.webp')).toString('base64') }));
    const review = await page.evaluate(async entries => {
      const columns = 4, cellWidth = 300, cellHeight = 320;
      const canvas = document.createElement('canvas');
      canvas.width = columns * cellWidth; canvas.height = Math.ceil(entries.length / columns) * cellHeight;
      const context = canvas.getContext('2d');
      context.fillStyle = '#f4faf7'; context.fillRect(0, 0, canvas.width, canvas.height);
      for (let i = 0; i < entries.length; i++) {
        const x = (i % columns) * cellWidth, y = Math.floor(i / columns) * cellHeight;
        for (let cy = 0; cy < 280; cy += 20) for (let cx = 0; cx < 280; cx += 20) {
          context.fillStyle = (cx / 20 + cy / 20) % 2 ? '#e5efea' : '#ffffff';
          context.fillRect(x + 10 + cx, y + 8 + cy, 20, 20);
        }
        const image = new Image(); image.src = entries[i].src; await image.decode();
        context.drawImage(image, x + 10, y + 8, 280, 280);
        context.fillStyle = '#173b34'; context.font = 'bold 17px sans-serif';
        context.textAlign = 'center'; context.fillText(entries[i].pose, x + cellWidth / 2, y + 310);
      }
      return canvas.toDataURL('image/png').split(',')[1];
    }, thumbnails);
    fs.writeFileSync(path.join(root, '.cache/mascot-review.png'), Buffer.from(review, 'base64'));
    const result = { generatedAt: new Date().toISOString(), poses: report.length, files: report.length * 2, totalBytes: report.reduce((sum, item) => sum + item.versions.reduce((n, v) => n + v.bytes, 0), 0), assets: report };
    fs.writeFileSync(path.join(root, '.cache/mascot-assets-report.json'), JSON.stringify(result, null, 2) + '\n');
    console.log('[mascot] packaged ' + result.poses + ' poses; review .cache/mascot-review.png');
  } finally { await browser.close(); }
}

module.exports = { POSES };
if (require.main === module) prepare().catch(error => { console.error(error); process.exitCode = 1; });
