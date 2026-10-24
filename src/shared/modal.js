// State and behavior owned by shared/modal. Initialization is orchestrated by app/bootstrap.js.

import { state as domState } from "./dom.js";

export const state = {};

const modalState = state;

export function _modalOpen(opts) {
  const {
    title = '',
    msg = '',
    okText = 'Đồng ý',
    cancelText = 'Hủy',
    danger = false,
    input = false,
    value = ''
  } = opts || {};
  return new Promise(resolve => {
    modalState._modalResolve = resolve;
    modalState._modalIsInput = !!input;
    const modal = domState.$('appModal'),
      ok = domState.$('appModalOk'),
      cancel = domState.$('appModalCancel'),
      inp = domState.$('appModalInput');
    domState.$('appModalTitle').textContent = title;
    domState.$('appModalMsg').textContent = msg;
    domState.$('appModalMsg').classList.toggle('hidden', !msg);
    ok.textContent = okText;
    ok.className = 'btn ' + (danger ? 'danger' : 'primary');
    if (cancelText === null) {
      cancel.classList.add('hidden');
    } else {
      cancel.classList.remove('hidden');
      cancel.textContent = cancelText;
    }
    if (input) {
      inp.classList.remove('hidden');
      inp.value = value;
    } else {
      inp.classList.add('hidden');
      inp.value = '';
    }
    modal.classList.add('show');
    modal.setAttribute('aria-hidden', 'false');
    setTimeout(() => {
      if (input) {
        inp.focus();
        inp.select();
      } else ok.focus();
    }, 30);
  });
}

export function _modalClose(result) {
  const modal = domState.$('appModal');
  if (!modal) return;
  modal.classList.remove('show');
  modal.setAttribute('aria-hidden', 'true');
  const r = modalState._modalResolve;
  modalState._modalResolve = null;
  if (r) r(result);
}
// Thay alert() — chỉ 1 nút

// Thay alert() — chỉ 1 nút
export function appAlert(msg, title = 'Thông báo') {
  return _modalOpen({
    title,
    msg,
    okText: 'Đã hiểu',
    cancelText: null
  });
}
// Thay confirm() — trả Promise<boolean>

// Thay confirm() — trả Promise<boolean>
export function appConfirm(msg, opts) {
  const {
    title = 'Xác nhận',
    okText = 'Đồng ý',
    cancelText = 'Hủy',
    danger = false
  } = opts || {};
  return _modalOpen({
    title,
    msg,
    okText,
    cancelText,
    danger
  }).then(v => v === true);
}
// Thay prompt() — trả Promise<string|null>

// Thay prompt() — trả Promise<string|null>
export function appPrompt(msg, value = '', opts) {
  const {
    title = 'Nhập thông tin',
    okText = 'Lưu'
  } = opts || {};
  return _modalOpen({
    title,
    msg,
    okText,
    input: true,
    value
  }).then(v => v == null || v === '' ? null : String(v));
}

/* ── Library ── */

export function initializeModal() {
  /* ═══════════════════════════════════════════════════════════
     ★ APP MODAL — thay alert / confirm / prompt gốc trình duyệt
     ═══════════════════════════════════════════════════════════ */
  modalState._modalResolve = null;
  modalState._modalIsInput = false;
}
