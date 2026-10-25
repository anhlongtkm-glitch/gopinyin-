// State and behavior owned by features/auth/controller. Initialization is orchestrated by app/bootstrap.js.

import { renderUserChip, enterWorkspace } from "../../app/navigation.js";

import { doRegister, doLogin, doGuest, doLogout } from "./service.js";


import { state as accountStorageState } from "../../shared/account-storage.js";

import { state as audioEffectsState } from "../../shared/audio/effects.js";

import { fireConfetti } from "../../shared/confetti.js";

import { closeModal } from "../../shared/dialogs.js";

import { toast } from "../../shared/toast.js";

export const state = {};

const authControllerState = state;

export function setAuthMode(mode) {
  authControllerState.authMode = mode;
  accountStorageState.$$('.authTab').forEach(t => {
    const on = t.dataset.authtab === mode;
    t.classList.toggle('active', on);
    t.setAttribute('aria-selected', on ? 'true' : 'false');
  });
  accountStorageState.$('authNameField').hidden = mode !== 'register';
  accountStorageState.$('authSubmit').textContent = mode === 'register' ? 'Tạo tài khoản' : 'Đăng nhập';
  accountStorageState.$('authError').hidden = true;
  accountStorageState.$('authTitle').textContent = mode === 'register' ? 'Tạo tài khoản GoPinyin' : 'Đăng nhập GoPinyin';
  accountStorageState.$('authSubtitle').textContent = mode === 'register' ? 'Tạo tài khoản để lưu tiến độ học của bạn.' : 'Đăng nhập tài khoản trên trình duyệt này.';
  /* ★ Không dùng minlength trên ô mật khẩu: form dùng chung cho cả Đăng nhập —
     minlength sẽ chặn luôn tài khoản cũ có mật khẩu ngắn. Chỉ đổi gợi ý. */
  const pw = accountStorageState.$('authPass');
  if (pw) {
    pw.placeholder = mode === 'register' ? 'Ít nhất 8 ký tự' : 'Mật khẩu của bạn';
    pw.setAttribute('autocomplete', mode === 'register' ? 'new-password' : 'current-password');
  }
  audioEffectsState.Sfx.click();
}

export function initializeAuthController() {
  /* ═══════════════ MODAL ĐĂNG NHẬP ═══════════════ */
  authControllerState.authMode = 'login';
  accountStorageState.$$('.authTab').forEach(t => t.addEventListener('click', () => setAuthMode(t.dataset.authtab)));
  accountStorageState.$('authForm').addEventListener('submit', async e => {
    e.preventDefault();
    if (accountStorageState.$('authSubmit').dataset.busy === '1') return; // chặn bấm gửi 2 lần
    const name = accountStorageState.$('authName').value,
      email = accountStorageState.$('authEmail').value,
      pass = accountStorageState.$('authPass').value;
    const err = accountStorageState.$('authError'),
      btn = accountStorageState.$('authSubmit');
    const mode = authControllerState.authMode;
    btn.dataset.busy = '1';
    btn.disabled = true;
    const oldTxt = btn.textContent;
    btn.textContent = '⏳ Đang xử lý…';
    let r;
    try {
      r = mode === 'register' ? await doRegister(name, email, pass) : await doLogin(email, pass);
    } catch (ex) {
      r = {
        ok: false,
        msg: 'Không xử lý được: ' + (ex && ex.message || ex)
      };
    } finally {
      btn.dataset.busy = '0';
      btn.disabled = false;
      btn.textContent = oldTxt;
    }
    if (!r.ok) {
      err.textContent = r.msg;
      err.hidden = false;
      audioEffectsState.Sfx.wrong();
      return;
    }
    err.hidden = true;
    closeModal('authModal');
    renderUserChip();
    enterWorkspace();
    toast((mode === 'register' ? 'Đăng ký' : 'Đăng nhập') + ' thành công. Chúc bạn học tốt!', 'ok');
    audioEffectsState.Sfx.unlock();
    fireConfetti(120);
  });
  accountStorageState.$('authGoogleBtn').addEventListener('click', () => {
    toast('Đăng nhập Google sẽ được bật khi kết nối backend. Hiện dùng email hoặc khách nhé!', 'warn');
    audioEffectsState.Sfx.click();
  });
  accountStorageState.$('authGuestBtn').addEventListener('click', () => {
    doGuest();
    closeModal('authModal');
    renderUserChip();
    enterWorkspace();
    toast('Đang học với tư cách khách — tiến độ lưu trên máy này.', 'ok');
  });
  accountStorageState.$('wsLogoutBtn').addEventListener('click', () => {
    doLogout();
    audioEffectsState.Sfx.click();
  });

}
