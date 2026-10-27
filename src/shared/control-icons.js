// Presentation only: keep controls, their label nodes and their handlers intact.
const NS = 'http://www.w3.org/2000/svg';
const CONTROL = 'button,a.btn,a.lp-btn,a.miniBtn';
const ICON_HOLDERS = '.tgIco,.pronMicIco';
const paths = Object.freeze({
  volume: ['M11 5 6 9H3v6h3l5 4V5Z', 'M15 8a6 6 0 0 1 0 8', 'M18 5a10 10 0 0 1 0 14'],
  'volume-off': ['M11 5 6 9H3v6h3l5 4V5Z', 'm16 9 5 6m0-6-5 6'],
  keyboard: ['M4 5h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z', 'M6 9h.01M10 9h.01M14 9h.01M18 9h.01M6 13h.01M18 13h.01M9 15h6'],
  history: ['M3 11a9 9 0 1 1 2.6 7', 'M3 4v7h7', 'M12 7v5l3 2'],
  eye: ['M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z', 'M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z'],
  microphone: ['M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3Z', 'M5 10v2a7 7 0 0 0 14 0v-2M12 19v3m-4 0h8'],
  hint: ['M8 16c0-3-3-3-3-7a7 7 0 1 1 14 0c0 4-3 4-3 7H8Z', 'M9 19h6m-5 3h4'],
  help: ['M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Z', 'M9.5 9a2.5 2.5 0 1 1 4 2c-1 .6-1.5 1-1.5 2', 'M12 16h.01'],
  sun: ['M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z', 'M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5'],
  moon: ['M20 14A8.5 8.5 0 0 1 10 4a8.5 8.5 0 1 0 10 10Z'],
  pause: ['M9 5v14M15 5v14'],
  play: ['M8 4v16l12-8L8 4Z'],
  power: ['M12 2v10', 'M6 5a9 9 0 1 0 12 0'],
  close: ['m6 6 12 12M6 18 18 6'],
  previous: ['m15 5-7 7 7 7'],
  next: ['m9 5 7 7-7 7'],
  retry: ['M3 10a9 9 0 1 1 2 8', 'M3 3v7h7'],
  download: ['M12 3v12m-5-5 5 5 5-5', 'M4 16v4a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-4'],
  upload: ['M12 16V4m-5 5 5-5 5 5', 'M4 16v4a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-4'],
  save: ['M4 3h13l4 4v14H3V3h1Z', 'M7 3v6h10V3M7 21v-7h10v7'],
  trash: ['M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7'],
  lock: ['M7 10V7a5 5 0 0 1 10 0v3', 'M5 10h14v11H5V10Z', 'M12 14v3'],
  unlock: ['M7 10V7a5 5 0 0 1 9-3', 'M5 10h14v11H5V10Z', 'M12 14v3'],
  key: ['M15 3a6 6 0 1 1-4.5 10L3 20v-4l5-5A6 6 0 0 1 15 3Z', 'M16 7h.01'],
  edit: ['m16 3 5 5-12 12-6 1 1-6L16 3Z', 'm13 6 5 5'],
  target: ['M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Z', 'M12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10Z', 'M12 11a1 1 0 1 0 0 2 1 1 0 0 0 0-2Z'],
  gift: ['M3 8h18v4H3V8ZM5 12v9h14v-9M12 8v13', 'M12 8H8a3 3 0 1 1 3-3l1 3Zm0 0h4a3 3 0 1 0-3-3l-1 3Z'],
  expand: ['M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5'],
  collapse: ['M3 8h5V3m8 0v5h5M8 21v-5H3m18 0h-5v5'],
  hanzi: ['M5 7h14M12 3v4M8 7c0 6 5 11 11 13M16 7c0 6-5 11-11 13'],
  loading: ['M12 3a9 9 0 1 1-9 9', 'M3 3v6h6']
});
const glyphs = new Map([
  ['🔊', 'volume'], ['🔈', 'volume'], ['🔉', 'volume'], ['🔇', 'volume-off'],
  ['⌨', 'keyboard'], ['📜', 'history'], ['👁', 'eye'], ['🀄', 'hanzi'],
  ['🎤', 'microphone'], ['🎙', 'microphone'], ['💡', 'hint'], ['ⓘ', 'help'], ['ℹ', 'help'],
  ['🌙', 'moon'], ['☀', 'sun'], ['⏸', 'pause'], ['▶', 'play'], ['⏵', 'play'], ['⏻', 'power'],
  ['✕', 'close'], ['×', 'close'], ['◀', 'previous'], ['←', 'previous'], ['→', 'next'], ['↺', 'retry'],
  ['⭳', 'download'], ['⭱', 'upload'], ['💾', 'save'], ['🗑', 'trash'], ['🔒', 'lock'], ['🔓', 'unlock'], ['⏳', 'loading'],
  ['🔑', 'key'], ['✏', 'edit'], ['🎯', 'target'], ['🎁', 'gift'], ['⛶', 'expand'], ['⤡', 'collapse']
]);
let observer;
let initialized = false;

function prefix(node) {
  if (node.nodeType !== 3) return null;
  const text = node.nodeValue;
  const whitespace = text.match(/^\s*/)[0].length;
  const tail = text.slice(whitespace);
  for (const [glyph, name] of glyphs) if (tail.startsWith(glyph)) {
    let consumed = whitespace + glyph.length;
    if (text.charCodeAt(consumed) === 0xfe0f) consumed++;
    return { name, remainder: text.slice(consumed).replace(/^\s+/, '') };
  }
  return null;
}

function iconFor(element, name) {
  let svg = element.querySelector(':scope > svg[data-control-svg]');
  if (svg?.dataset.controlSvg === name) return svg;
  const next = document.createElementNS(NS, 'svg');
  next.classList.add('control-icon');
  next.dataset.controlSvg = name;
  next.setAttribute('viewBox', '0 0 24 24');
  next.setAttribute('fill', 'none');
  next.setAttribute('stroke', 'currentColor');
  next.setAttribute('stroke-width', '1.8');
  next.setAttribute('stroke-linecap', 'round');
  next.setAttribute('stroke-linejoin', 'round');
  next.setAttribute('aria-hidden', 'true');
  next.setAttribute('focusable', 'false');
  for (const d of paths[name]) {
    const path = document.createElementNS(NS, 'path');
    path.setAttribute('d', d);
    next.append(path);
  }
  if (svg) svg.replaceWith(next); else element.prepend(next);
  return next;
}

export function setControlIcon(target, name) {
  const element = typeof target === 'string' ? document.getElementById(target) : target;
  if (!element || !paths[name]) return false;
  for (const node of element.childNodes) {
    const match = prefix(node);
    if (match) node.nodeValue = match.remainder;
  }
  iconFor(element, name);
  return true;
}

function decorateLeaf(element) {
  // Explicit SVG controls already belong to the same outline icon family.
  if (element.querySelector(':scope > svg:not([data-control-svg])')) return;
  for (const node of [...element.childNodes]) {
    const match = prefix(node);
    if (!match) continue;
    node.nodeValue = match.remainder;
    iconFor(element, match.name);
    break;
  }
}

function decorateControl(control) {
  decorateLeaf(control);
  control.querySelectorAll(ICON_HOLDERS).forEach(decorateLeaf);
}

export function initializeControlIcons() {
  if (initialized) return;
  initialized = true;
  document.querySelectorAll(CONTROL).forEach(decorateControl);
  observer = new MutationObserver(records => {
    const controls = new Set();
    for (const record of records) {
      const element = record.target.nodeType === 1 ? record.target : record.target.parentElement;
      if (element && !element.closest('svg')) {
        const owner = element.closest(CONTROL);
        if (owner) controls.add(owner);
      }
      for (const node of record.addedNodes) if (node.nodeType === 1 && !node.closest('svg')) {
        if (node.matches(CONTROL)) controls.add(node);
        node.querySelectorAll(CONTROL).forEach(control => controls.add(control));
      }
    }
    for (const control of controls) if (control.isConnected) decorateControl(control);
    // No external script can run during this synchronous pass; discard our SVG edits.
    observer.takeRecords();
  });
  observer.observe(document.body, { subtree: true, childList: true, characterData: true });
}
