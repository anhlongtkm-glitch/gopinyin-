// State and behavior owned by shared/utils. Initialization is orchestrated by app/bootstrap.js.

import { normalize } from "./language/normalization.js";

export function headerScore(h, type) {
  const n = normalize(h);
  if (type === 'vi') return /tieng viet|vietnamese|nghia viet|dich/.test(n) ? 10 : n === 'viet' ? 8 : 0;
  if (type === 'py') return /pinyin|phien am/.test(n) ? 10 : 0;
  if (type === 'zh') return /tieng trung|chinese|中文|han tu/.test(n) ? 10 : 0;
  if (type === 'wv') return /nghia tu|word meaning|tu vung|vocab|dinh nghia|tu don/.test(n) ? 10 : 0;
  return 0;
}

export function detectColumns(headers) {
  const best = t => headers.map((h, i) => ({
    i,
    s: headerScore(h, t)
  })).sort((a, b) => b.s - a.s)[0];
  const vi = best('vi'),
    py = best('py'),
    zh = best('zh'),
    wv = best('wv');
  if (!vi || !py || vi.s === 0 || py.s === 0) throw new Error('Không tìm thấy cột Tiếng Việt hoặc Pinyin.');
  return {
    vi: vi.i,
    py: py.i,
    zh: zh && zh.s ? zh.i : -1,
    wv: wv && wv.s ? wv.i : -1
  };
}

export function shuffle(a) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function uid() {
  return crypto.randomUUID ? crypto.randomUUID() : 'ds_' + Date.now() + '_' + Math.random().toString(36).slice(2);
}

export function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[c]);
}

/* ═══════════════════════════════════════════════════════════
   ★ THEME (sáng / tối)
   ═══════════════════════════════════════════════════════════ */
