// State and behavior owned by shared/theme. Initialization is orchestrated by app/bootstrap.js.

import { state as domState } from "./dom.js";

export const state = {};

const themeState = state;

export function applyTheme(t) {
  document.documentElement.setAttribute('data-theme', t);
  const btn = domState.$('themeToggle');
  if (btn) {
    btn.textContent = t === 'dark' ? '☀️' : '🌙';
    btn.setAttribute('aria-pressed', t === 'dark' ? 'true' : 'false');
    btn.title = t === 'dark' ? 'Chuyển sang giao diện sáng' : 'Chuyển sang giao diện tối';
  }
}

export function initTheme() {
  let saved = null;
  try {
    saved = localStorage.getItem(themeState.THEME_KEY);
  } catch {}
  const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  applyTheme(saved === 'dark' || saved === 'light' ? saved : prefersDark ? 'dark' : 'light');
}

export function toggleTheme() {
  const next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
  applyTheme(next);
  try {
    localStorage.setItem(themeState.THEME_KEY, next);
  } catch {}
}

/* ═══════════════════════════════════════════════════════════
   ★ TOAST — thông báo nổi phía trên
   ═══════════════════════════════════════════════════════════ */

export function initializeTheme() {
  /* ═══════════════════════════════════════════════════════════
     ★ THEME (sáng / tối)
     ═══════════════════════════════════════════════════════════ */
  themeState.THEME_KEY = 'cts:theme';
}
