// State and behavior owned by app/shell-startup. Initialization is orchestrated by app/bootstrap.js.

import { renderUserChip, enterWorkspace, showView } from "./navigation.js";

import { currentUser } from "../features/auth/service.js";

import { landingFX } from "../features/landing/controller.js";

import { state as proCheckoutState, renderPricing, syncLandingPlan } from "../features/pro/checkout.js";

import { renderProState, migrateGlobalPro, verifyProWithServer, renderTrial, isPro } from "../features/pro/entitlements.js";

import { state as accountStorageState } from "../shared/account-storage.js";

import { closeModal } from "../shared/dialogs.js";

import { syncThemeButtons } from "../shared/theme-controls.js";

export const state = {};

const appShellStartupState = state;

export function renderLandingShell() {
  accountStorageState.$('landing').classList.remove('hidden');
  accountStorageState.$('workspace').classList.add('hidden');
  renderUserChip();
  renderProState();
}
/* ★ Landing chỉ hiện LẦN ĐẦU — đã đăng nhập & đã từng xem landing → vào thẳng workspace,
   các lần sau không hiện landing nữa. Chưa đăng nhập thì vẫn hiện landing để đăng nhập. */

export function initializeAppShellStartup() {
  /* ═══════════════ KHỞI TẠO ═══════════════ */
  /* ★ Bọc try/catch: hiệu ứng landing KHÔNG được phép làm chết khối khởi tạo
     (đăng nhập, Pro, render) phía dưới. */
  try {
    landingFX();
  } catch (e) {
    try {
      console.warn('[gopinyin] landingFX lỗi:', e && e.message);
    } catch (_) {}
  }
  /* ★ Landing chỉ hiện LẦN ĐẦU — đã đăng nhập & đã từng xem landing → vào thẳng workspace,
     các lần sau không hiện landing nữa. Chưa đăng nhập thì vẫn hiện landing để đăng nhập. */
  migrateGlobalPro(); /* chuyển quyền Pro của bản cũ sang tài khoản đang đăng nhập */
  /* ★ Khi có server đối soát: xác thực Pro qua server ngay khi tải + định kỳ (chống giả mạo localStorage) */
  if (proCheckoutState.PRO_VERIFY_URL) {
    verifyProWithServer();
    setInterval(verifyProWithServer, 60000);
  }
  if (currentUser() && accountStorageState.lsGet(accountStorageState.LS.seenLanding, false)) enterWorkspace();else {
    accountStorageState.lsSet(accountStorageState.LS.seenLanding, true);
    renderLandingShell();
  }
  renderPricing();
  syncLandingPlan();
  renderTrial();
  syncThemeButtons();
  /* Trạng thái Pro lúc tải */
  document.body.classList.toggle('is-pro', isPro());
  /* Phím tắt: Escape đóng modal đang mở */
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      const open = accountStorageState.$$('.modal:not([hidden])');
      if (open.length) closeModal(open[open.length - 1].id);
    }
  });
  /* Logo click ở sidebar → về bảng điều khiển */
  appShellStartupState.sideBrand = document.querySelector('.ws-sideBrand');
  if (appShellStartupState.sideBrand) appShellStartupState.sideBrand.addEventListener('click', () => showView('dash'));
}
