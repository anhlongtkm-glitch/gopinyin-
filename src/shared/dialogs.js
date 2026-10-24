// State and behavior owned by shared/dialogs. Initialization is orchestrated by app/bootstrap.js.

import { syncProPlan } from "../features/pro/checkout.js";

import { renderTrial } from "../features/pro/entitlements.js";

import { state as accountStorageState } from "./account-storage.js";

import { state as audioEffectsState } from "./audio/effects.js";

export const state = {};

const dialogsState = state;

export function resolveModal(id) {
  if (!id) return null;
  return accountStorageState.$(id) || accountStorageState.$(dialogsState.MODAL_ALIAS[id] || '') || null;
}

export function openModal(id) {
  const m = resolveModal(id);
  if (!m) return;
  m.hidden = false;
  document.body.style.overflow = 'hidden';
  audioEffectsState.Sfx.pop();
  /* mở bảng Pro → làm mới QR + số tiền theo đúng khách đang đăng nhập */
  if (m.id === 'proModal') {
    renderTrial();
    if (typeof syncProPlan === 'function') syncProPlan();
  }
}

export function closeModal(id) {
  const m = resolveModal(id);
  if (!m) return;
  m.hidden = true;
  /* trả focus về nơi mở modal để bàn phím không bị "kẹt" trong modal đã đóng */
  try {
    if (m.contains(document.activeElement)) document.activeElement.blur();
  } catch (e) {}
  if (!accountStorageState.$$('.modal:not([hidden])').length) document.body.style.overflow = '';
}

export function initializeDialogs() {
  /* ═══════════════ MODAL PLUMBING ═══════════════ */
  /* ★ Các nút đóng dùng data-close="auth" / "pro" nhưng id thật là authModal / proModal
     → phải ánh xạ lại, nếu không closeModal() không tìm thấy phần tử và nút ✕ "chết". */
  dialogsState.MODAL_ALIAS = {
    auth: 'authModal',
    pro: 'proModal'
  };
  accountStorageState.$$('[data-close]').forEach(el => el.addEventListener('click', () => closeModal(el.dataset.close)));
  accountStorageState.$$('.modal').forEach(m => m.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeModal(m.id);
  }));

  /* ═══════════════ MODAL ĐĂNG NHẬP ═══════════════ */
}
