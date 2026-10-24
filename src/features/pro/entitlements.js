// State and behavior owned by features/pro/entitlements. Initialization is orchestrated by app/bootstrap.js.

import { publishLegacy, legacy } from "../../app/compatibility.js";

import { state as dataCatalogState } from "../../data/catalog.js";

import { currentUser } from "../auth/service.js";

import { renderVocab } from "../library/catalog.js";

import { normalizeProPlanKey, state as proCheckoutState, proTransferNote } from "./checkout.js";

import { state as accountStorageState } from "../../shared/account-storage.js";

export const state = {};

const proEntitlementsState = state;

export function trialOf(u) {
  u = u || currentUser();
  if (!u || !u.email || u.guest) return null;
  const t = accountStorageState.lsGet(proEntitlementsState.trialKey(u.email), null);
  return t && t.end ? t : null;
}
/* Cấp trial nếu tài khoản chưa từng có (đăng ký mới hoặc tài khoản cũ chưa nhận) */

/* Cấp trial nếu tài khoản chưa từng có (đăng ký mới hoặc tài khoản cũ chưa nhận) */
export function ensureTrial(u) {
  u = u || currentUser();
  if (!u || !u.email || u.guest) return null;
  let t = accountStorageState.lsGet(proEntitlementsState.trialKey(u.email), null);
  if (!t || !t.end) {
    const now = Date.now();
    t = {
      start: now,
      end: now + proEntitlementsState.TRIAL_MS
    };
    accountStorageState.lsSet(proEntitlementsState.trialKey(u.email), t);
  }
  return t;
}

export function trialDaysLeft() {
  const t = trialOf();
  if (!t) return 0;
  const left = t.end - Date.now();
  return left > 0 ? Math.max(1, Math.ceil(left / 86400000)) : 0;
}

export function trialActive() {
  return trialDaysLeft() > 0;
}

export function trialPct() {
  const t = trialOf();
  if (!t) return 0;
  const left = Math.max(0, t.end - Date.now());
  return Math.max(0, Math.min(100, Math.round(left / proEntitlementsState.TRIAL_MS * 100)));
}
/* ★ Gói THÁNG phải hết hạn. Bản cũ `isPaidPro()` chỉ kiểm tra "có bản ghi"
   nên mua 1 tháng là dùng VĨNH VIỄN — sai nghiệp vụ.
   ★ Pro phải gắn với TÀI KHOẢN: bản cũ đọc khoá toàn cục 'gp:pro' nên mua một
   lần là MỌI tài khoản trên máy (kể cả khách) đều thành Pro. */

/* ★ Gói THÁNG phải hết hạn. Bản cũ `isPaidPro()` chỉ kiểm tra "có bản ghi"
   nên mua 1 tháng là dùng VĨNH VIỄN — sai nghiệp vụ.
   ★ Pro phải gắn với TÀI KHOẢN: bản cũ đọc khoá toàn cục 'gp:pro' nên mua một
   lần là MỌI tài khoản trên máy (kể cả khách) đều thành Pro. */
export function proKey(email) {
  return 'gp:pro:' + email;
}

export function proRecordOf(email) {
  if (!email) return null;
  const r = accountStorageState.lsGet(proKey(email), null);
  return r && r.at ? r : null;
}

export function proRecordValid(r) {
  if (!r) return false;
  const plan = String(r.plan || 'month');
  if (plan === 'lifetime') return true;
  const normalized = normalizeProPlanKey(plan);
  const at = Number(r.at) || 0;
  if (normalized === 'month') return at > 0 && Date.now() < at + proCheckoutState.PRO_MONTH_MS;
  return at > 0 && Date.now() < at + proCheckoutState.PRO_YEAR_MS;
}

export function isPaidPro() {
  const u = currentUser();
  if (!u || u.guest || !u.email) return false;
  if (proCheckoutState.PRO_VERIFY_URL && !proEntitlementsState.serverProConfirmed) return false; // ★ phải có xác nhận server
  return proRecordValid(proRecordOf(u.email));
}

export function isPro() {
  return isPaidPro() || trialActive();
}
/* ★ Xác thực server: khi PRO_VERIFY_URL cấu hình, Pro chỉ hợp lệ nếu server đã xác nhận.
   Chống giả mạo localStorage (ghi trực tiếp gp:pro:<email>={plan:'lifetime'}).
   serverProConfirmed mặc định false → fail-closed (từ chối nếu chưa đối soát). */

export async function verifyProWithServer() {
  if (!proCheckoutState.PRO_VERIFY_URL) return;
  try {
    const r = await fetch(proCheckoutState.PRO_VERIFY_URL + '?note=' + encodeURIComponent(proTransferNote()) + '&amount=' + (proCheckoutState.PRO_PLANS[proCheckoutState.proPlan] || proCheckoutState.PRO_PLANS.month).amount, {
      cache: 'no-store'
    });
    if (!r.ok) {
      proEntitlementsState.serverProConfirmed = false;
      return;
    }
    const d = await r.json();
    if (d && d.paid) {
      proEntitlementsState.serverProConfirmed = true;
      proEntitlementsState.serverProPlan = d.plan || proCheckoutState.proPlan;
      setPro(proEntitlementsState.serverProPlan, true); /* ghi đè record local bằng giá trị server xác thực */
      ensureProContent(); /* nạp nội dung Pro (HSK 4–9) từ server */
    } else {
      proEntitlementsState.serverProConfirmed = false; /* server chưa xác nhận → thu hồi Pro giả (nếu có) */
      const u = currentUser();
      if (u && u.email && proRecordOf(u.email)) localStorage.removeItem(proKey(u.email));
    }
    renderProState();
  } catch (e) {/* lỗi mạng → giữ nguyên trạng thái, không tự ý thu hồi */}
}
/* ★ Nạp nội dung Pro (HSK 4–9) từ server SAU KHI xác thực — nội dung KHÔNG nhúng sẵn.
   Chỉ chạy khi có server đối soát (PRO_CONTENT_URL) và đã xác nhận Pro; mặc định → no-op. */

/* ★ Nạp nội dung Pro (HSK 4–9) từ server SAU KHI xác thực — nội dung KHÔNG nhúng sẵn.
   Chỉ chạy khi có server đối soát (PRO_CONTENT_URL) và đã xác nhận Pro; mặc định → no-op. */
export async function ensureProContent() {
  if (!proCheckoutState.PRO_CONTENT_URL || !proEntitlementsState.serverProConfirmed) return;
  try {
    const r = await fetch(proCheckoutState.PRO_CONTENT_URL + '?note=' + encodeURIComponent(proTransferNote()), {
      cache: 'no-store'
    });
    if (!r.ok) return;
    const d = await r.json();
    if (d && d.content) {
      for (const lvl of ['hsk4', 'hsk5', 'hsk6', 'hsk7', 'hsk8', 'hsk9']) {
        if (Array.isArray(d.content[lvl])) dataCatalogState.HSK_DATA[lvl] = d.content[lvl];
      }
    }
  } catch (e) {/* lỗi mạng → giữ nội dung hiện tại */}
}
/* Trả false nếu không ghi được (chưa đăng nhập / là khách) */

/* Trả false nếu không ghi được (chưa đăng nhập / là khách) */
export function setPro(plan, verified) {
  /* ★ Khi đã bật xác thực server (PRO_VERIFY_URL), cấm mở Pro thủ công
     (gõ setPro('lifetime') ở DevTools) — Pro chỉ cấp sau khi server đối soát.
     Luồng server (startProWatch) gọi setPro(plan,true) nên vẫn hoạt động bình thường. */
  if (proCheckoutState.PRO_VERIFY_URL && !verified) return false;
  const u = currentUser();
  if (!u || !u.email || u.guest) return false;
  const p = normalizeProPlanKey(plan);
  const rec = {
    plan: p,
    at: Date.now()
  };
  if (p === 'month') rec.expiresAt = rec.at + proCheckoutState.PRO_MONTH_MS;
  if (p === 'year') rec.expiresAt = rec.at + proCheckoutState.PRO_YEAR_MS;
  accountStorageState.lsSet(proKey(u.email), rec);
  return true;
}

export function clearPro() {
  const u = currentUser();
  if (u && u.email) localStorage.removeItem(proKey(u.email));
  localStorage.removeItem(accountStorageState.LS.pro); /* dọn khoá toàn cục của bản cũ */
}
/* ★ Một lần: chuyển quyền Pro mua bằng bản cũ (khoá toàn cục 'gp:pro') sang
   đúng tài khoản đang đăng nhập, để người đã mua không bị mất quyền.
   Chưa đăng nhập thì GIỮ LẠI khoá cũ, lần đăng nhập sau sẽ chuyển tiếp. */

/* ★ Một lần: chuyển quyền Pro mua bằng bản cũ (khoá toàn cục 'gp:pro') sang
   đúng tài khoản đang đăng nhập, để người đã mua không bị mất quyền.
   Chưa đăng nhập thì GIỮ LẠI khoá cũ, lần đăng nhập sau sẽ chuyển tiếp. */
export function migrateGlobalPro() {
  try {
    const old = accountStorageState.lsGet(accountStorageState.LS.pro, null);
    if (!old) return;
    const u = currentUser();
    if (!u || !u.email || u.guest) return; /* chưa đăng nhập → để nguyên */
    if (!accountStorageState.lsGet(proKey(u.email), null)) {
      const migratedPlan = normalizeProPlanKey(old.plan);
      const migratedAt = Number(old.at) || Date.now();
      accountStorageState.lsSet(proKey(u.email), {
        plan: migratedPlan,
        at: migratedAt,
        expiresAt: migratedPlan === 'month' ? migratedAt + proCheckoutState.PRO_MONTH_MS : migratedPlan === 'year' ? migratedAt + proCheckoutState.PRO_YEAR_MS : undefined
      });
    }
    localStorage.removeItem(accountStorageState.LS.pro);
  } catch (e) {}
}

export function renderProState() {
  const pro = isPro(),
    paid = isPaidPro(),
    trial = !paid && trialActive(),
    days = trialDaysLeft();
  document.body.classList.toggle('is-pro', pro);
  const badge = accountStorageState.$('wsProBadge');
  if (badge) {
    badge.classList.toggle('hidden', !pro);
    badge.textContent = paid ? 'PRO' : 'TRIAL';
  }
  const planEl = accountStorageState.$('wsUserPlan');
  const u = currentUser();
  if (planEl) {
    planEl.textContent = paid ? 'Gói Pro 👑' : trial ? 'Dùng thử · còn ' + days + ' ngày' : 'Gói miễn phí';
  }
  accountStorageState.$$('.ws-navItem').forEach(b => {
    if (b.dataset.view === 'ai') {
      const lock = accountStorageState.$h('.ws-lock', b);
      if (lock) lock.style.display = pro ? 'none' : '';
    }
  });
  const up = accountStorageState.$('wsUpgradeBtn');
  if (up) {
    up.querySelector('b').textContent = paid ? 'Bạn đang là Pro' : trial ? 'Giữ Pro · còn ' + days + ' ngày' : 'Nâng cấp Pro';
    const sm = up.querySelector('small');
    if (sm) sm.textContent = paid ? 'Đã mở khoá toàn bộ tính năng' : trial ? 'AI & HSK 4–9 sắp khoá' : 'Mở AI & HSK 4–9';
  }
  /* nhãn thẻ AI ở dashboard đổi theo trạng thái */
  const aiBadge = accountStorageState.$h('.featureAi .dfBadge');
  if (aiBadge) aiBadge.textContent = paid ? 'Đã mở khoá ✨' : trial ? 'Dùng thử Pro 🎁' : 'Pro · Mở khoá';
  /* cho app-core biết trạng thái Pro (dùng để khoá HSK 4–9) rồi vẽ lại thư viện */
  publishLegacy("__gpIsPro", pro);
  try {
    legacy.__gpSyncGameLocks && legacy.__gpSyncGameLocks();
  } catch (e) {}
  renderTrial();
  try {
    if (typeof renderVocab === 'function') renderVocab();
  } catch (e) {}
}
/* ★ Băng / thanh trạng thái dùng thử */

/* ★ Băng / thanh trạng thái dùng thử */
export function renderTrial() {
  const trial = trialActive(),
    days = trialDaysLeft(),
    pct = trialPct();
  const banner = accountStorageState.$('trialBanner');
  if (banner) {
    banner.classList.toggle('hidden', !trial);
    if (trial) {
      const sub = accountStorageState.$('trialBannerSub');
      if (sub) sub.innerHTML = 'Còn <b>' + days + ' ngày</b> — hết hạn sẽ khoá lại AI sinh câu và HSK 4–9. Nâng cấp để giữ nguyên.';
      const fill = accountStorageState.$('trialBarFill');
      if (fill) fill.style.width = pct + '%';
    }
  }
  const bar = accountStorageState.$('proTrial');
  if (bar) {
    bar.classList.toggle('hidden', !trial);
    if (trial) {
      const t = accountStorageState.$('proTrialTitle'),
        s = accountStorageState.$('proTrialSub'),
        f = accountStorageState.$('proTrialFill');
      if (t) t.textContent = 'Bạn đang dùng thử Pro miễn phí';
      if (s) s.textContent = 'Còn ' + days + '/' + proEntitlementsState.TRIAL_DAYS + ' ngày — nâng cấp để không bị khoá lại';
      if (f) f.style.width = pct + '%';
    }
  }
}

/* ═══════════════ ĐIỀU HƯỚNG LANDING ↔ WORKSPACE ═══════════════ */

export function initializeProEntitlements() {
  /* ═══════════════ PRO ═══════════════ */
  /* ★ DÙNG THỬ PRO 7 NGÀY cho mỗi tài khoản đăng ký */
  proEntitlementsState.TRIAL_DAYS = 7;
  proEntitlementsState.TRIAL_MS = proEntitlementsState.TRIAL_DAYS * 24 * 60 * 60 * 1000;
  proEntitlementsState.trialKey = email => 'gp:trial:' + email;
  /* ★ Xác thực server: khi PRO_VERIFY_URL cấu hình, Pro chỉ hợp lệ nếu server đã xác nhận.
     Chống giả mạo localStorage (ghi trực tiếp gp:pro:<email>={plan:'lifetime'}).
     serverProConfirmed mặc định false → fail-closed (từ chối nếu chưa đối soát). */
  proEntitlementsState.serverProConfirmed = false;
  proEntitlementsState.serverProPlan = null;
}
