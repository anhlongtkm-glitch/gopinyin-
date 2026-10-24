// State and behavior owned by shared/toast. Initialization is orchestrated by app/bootstrap.js.

import { state as domState } from "./dom.js";

import { escapeHtml } from "./utils.js";

/* ═══════════════════════════════════════════════════════════
   ★ TOAST — thông báo nổi phía trên
   ═══════════════════════════════════════════════════════════ */
export function toast(msg, type = 'info', ms = 2600) {
  const host = domState.$('toastHost');
  if (!host) return;
  const el = document.createElement('div');
  el.className = 'toast ' + (type === 'ok' ? 'ok' : type === 'bad' ? 'bad' : type === 'warn' ? 'warn' : '');
  const icon = type === 'ok' ? '✅' : type === 'bad' ? '⛔' : type === 'warn' ? '⚠️' : 'ℹ️';
  el.innerHTML = '<span class="toast-icon">' + icon + '</span><span>' + escapeHtml(msg) + '</span>';
  host.appendChild(el);
  const remove = () => {
    el.classList.add('out');
    setTimeout(() => el.remove(), 220);
  };
  const timer = setTimeout(remove, ms);
  el.addEventListener('click', () => {
    clearTimeout(timer);
    remove();
  });
}

/* ═══════════════════════════════════════════════════════════
   ★ APP MODAL — thay alert / confirm / prompt gốc trình duyệt
   ═══════════════════════════════════════════════════════════ */
