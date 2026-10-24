// State and behavior owned by features/pronunciation/utils. Initialization is orchestrated by app/bootstrap.js.

import { lessonRepository } from "../../shared/lesson-bridge.js";

import { state as pronunciationSessionState } from "./session.js";

export const state = {};

const pronunciationUtilsState = state;

export function B() {
  return lessonRepository;
}

export function esc(s) {
  const b = B();
  return b ? b.escapeHtml(String(s == null ? '' : s)) : String(s == null ? '' : s).replace(/[&<>"']/g, c => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[c]);
}

export function toast(m, k, ms) {
  const b = B();
  if (b) {
    try {
      b.toast(m, k, ms);
      return;
    } catch (e) {}
  }
}

export function clamp(n, a, b) {
  return Math.max(a, Math.min(b, n));
}

export function toneOf(syl) {
  for (const ch of String(syl || '')) {
    if (pronunciationSessionState.TONE_MARK[ch]) return pronunciationSessionState.TONE_MARK[ch];
  }
  return 0;
}

export function isHan(ch) {
  const b = B();
  return b ? b.isHanChar(ch) : /[\u3400-\u9fff]/.test(ch);
}

export function hanChars(s) {
  const b = B();
  return b ? b.hanChars(s) : Array.from(String(s || '')).filter(isHan);
}

export function lsGet(k, d) {
  try {
    const v = localStorage.getItem(k);
    return v == null ? d : v;
  } catch (e) {
    return d;
  }
}

export function lsSet(k, v) {
  try {
    localStorage.setItem(k, v);
  } catch (e) {}
}

export function lsJson(k, d) {
  try {
    const v = localStorage.getItem(k);
    return v ? JSON.parse(v) : d;
  } catch (e) {
    return d;
  }
}

/* ═══════════════════════════════════════════════════════════
   PronRepo — nội dung lấy từ kho sẵn có
   ═══════════════════════════════════════════════════════════ */

export function initializePronunciationUtils() {
  /* ── Tiện ích ── */
  pronunciationUtilsState.$ = id => document.getElementById(id);
}
