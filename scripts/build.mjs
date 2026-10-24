import * as esbuild from 'esbuild';
import { readFile, writeFile, mkdir, copyFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const outputRoot = path.join(projectRoot, 'dist');
const sourceRoot = path.join(projectRoot, 'src');
// Explicit public assets only. Never recursively copy the repository into dist.
const publicAssets = [
  'apple-touch-icon.png', 'favicon-16.png', 'favicon-32.png', 'favicon-48.png',
  'icon-192.png', 'icon-512.png', 'logo-full-dark.png', 'logo-full.png',
  'logo-icon.png', 'logo-mark.png', 'logo.png', 'qr-vietcombank.png',
  'site.webmanifest', 'vocab-pack.js'
];

export async function renderHtml(file = 'index.html', ancestors = []) {
  const absolute = path.resolve(sourceRoot, file);
  if (!absolute.startsWith(sourceRoot + path.sep)) throw new Error(`HTML include outside src: ${file}`);
  if (ancestors.includes(absolute)) throw new Error(`Circular HTML include: ${[...ancestors, absolute].join(' -> ')}`);
  let text = await readFile(absolute, 'utf8');
  const markers = [...text.matchAll(/<!--\s*@(include|inline)\s+([^>]+?)\s*-->/g)];
  for (const marker of markers) {
    const included = marker[2].trim();
    const value = await renderHtml(included, [...ancestors, absolute]);
    text = text.replace(marker[0], value.trimEnd());
  }
  return text;
}

export async function build({ development = false } = {}) {
  await mkdir(path.join(outputRoot, 'assets'), { recursive: true });
  if (!development) for (const name of ['app.js.map','app.css.map']) await rm(path.join(outputRoot,'assets',name),{force:true});
  await esbuild.build({
    absWorkingDir: projectRoot,
    entryPoints: ['src/app/main.js'],
    outfile: 'dist/assets/app.js',
    bundle: true,
    format: 'iife',
    platform: 'browser',
    target: ['chrome100', 'firefox100', 'safari15'],
    charset: 'utf8',
    minify: false,
    sourcemap: development ? 'linked' : false,
    legalComments: 'none',
    logLevel: 'warning'
  });
  for (const file of publicAssets) await copyFile(path.join(projectRoot, 'assets', file), path.join(outputRoot, 'assets', file));
  await copyFile(path.join(sourceRoot, 'app/public-config.js'), path.join(outputRoot, 'assets/config.js'));
  const html = await renderHtml();
  if (/<!--\s*@(include|inline)\b/.test(html)) throw new Error('Unresolved HTML marker in build output');
  // Publish HTML last: a failed build never serves a half-composed document.
  await writeFile(path.join(outputRoot, 'index.html'), html);
  console.log(`[build] dist/index.html, assets/app.js, assets/app.css${development ? ' + source maps' : ''}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  build().catch(error => { console.error('[build]', error.message); process.exitCode = 1; });
}
