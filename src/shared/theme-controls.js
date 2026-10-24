// State and behavior owned by shared/theme-controls. Initialization is orchestrated by app/bootstrap.js.

import { state as accountStorageState } from "./account-storage.js";

import { state as audioEffectsState } from "./audio/effects.js";

import { toggleTheme } from "./theme.js";

/* ═══════════════ THEME ĐỒNG BỘ ═══════════════ */
export function syncThemeButtons() {
  const dark = document.documentElement.getAttribute('data-theme') === 'dark';
  const lp = accountStorageState.$('lpThemeBtn');
  if (lp) {
    lp.textContent = dark ? '☀️' : '🌙';
    lp.title = dark ? 'Chuyển sang giao diện sáng' : 'Chuyển sang giao diện tối';
  }
}

export function initializeThemeControls() {
  accountStorageState.$('lpThemeBtn').addEventListener('click', () => {
    if (typeof toggleTheme === 'function') toggleTheme();
    syncThemeButtons();
    audioEffectsState.Sfx.click();
  });
  accountStorageState.$('themeToggle').addEventListener('click', () => setTimeout(syncThemeButtons, 0));

  /* ═══════════════ DASHBOARD ═══════════════ */
}
