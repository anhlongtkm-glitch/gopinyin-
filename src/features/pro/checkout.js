// State and behavior owned by features/pro/checkout. Initialization is orchestrated by app/bootstrap.js.

import { publishLegacy } from "../../app/compatibility.js";

import { currentUser } from "../auth/service.js";

import { state as proEntitlementsState, ensureProContent, setPro, renderProState } from "./entitlements.js";

import { state as accountStorageState } from "../../shared/account-storage.js";

import { state as audioEffectsState } from "../../shared/audio/effects.js";

import { fireConfetti } from "../../shared/confetti.js";

import { closeModal, openModal } from "../../shared/dialogs.js";

import { toast } from "../../shared/toast.js";

export const state = {};

const proCheckoutState = state;

export function normalizeProPlanKey(plan) {
  if (plan === 'year' || plan === 'lifetime') return 'year';
  return 'month';
}
/* ★ Thông tin nhận tiền — dùng để sinh mã VietQR riêng cho từng khách
   (QR có sẵn số tiền + nội dung, khách quét là ngân hàng tự điền). */

export function proTransferNote() {
  const u = currentUser();
  const id = u && u.email ? u.email : u && u.name && !u.guest ? u.name : 'khach';
  return 'GOPINYIN ' + String(id).replace(/\s+/g, '');
}
/* Sinh URL ảnh VietQR cho đúng khách + đúng gói */

/* Sinh URL ảnh VietQR cho đúng khách + đúng gói */
export function proQrUrl(plan) {
  const p = proCheckoutState.PRO_PLANS[plan] || proCheckoutState.PRO_PLANS.month;
  return 'https://img.vietqr.io/image/' + proCheckoutState.PRO_BANK.bin + '-' + proCheckoutState.PRO_BANK.acc + '-compact2.png' + '?amount=' + p.amount + '&addInfo=' + encodeURIComponent(proTransferNote()) + '&accountName=' + encodeURIComponent(proCheckoutState.PRO_BANK.name);
}

export function syncProPlan() {
  const info = proCheckoutState.PRO_PLANS[normalizeProPlanKey(proCheckoutState.proPlan)] || proCheckoutState.PRO_PLANS.month;
  accountStorageState.$$('.proPlan').forEach(p => {
    const on = normalizeProPlanKey(p.dataset.plan) === normalizeProPlanKey(proCheckoutState.proPlan);
    p.classList.toggle('active', on);
    p.setAttribute('aria-pressed', on ? 'true' : 'false');
  });
  const amt = accountStorageState.$('proAmount');
  if (amt) amt.textContent = info.price;
  const qrAmt = accountStorageState.$('proQrAmount');
  if (qrAmt) qrAmt.textContent = info.price;
  const note = proTransferNote();
  const noteEl = accountStorageState.$('proTransferNote');
  if (noteEl) noteEl.textContent = note;
  const cAmt = accountStorageState.$('proConfirmAmt');
  if (cAmt) cAmt.textContent = info.price;
  const cNote = accountStorageState.$('proConfirmNote');
  if (cNote) cNote.textContent = note;
  /* dữ liệu cho các nút copy (copy đúng giá trị thô, không copy dấu chấm) */
  const cpA = accountStorageState.$('proCopyAmount');
  if (cpA) cpA.dataset.copy = String(info.amount);
  const cpN = accountStorageState.$('proCopyNote');
  if (cpN) cpN.dataset.copy = note;
  /* ảnh QR mới cho từng khách */
  const img = accountStorageState.$('proQrImg');
  if (img) {
    img.classList.remove('ready');
    const fb = accountStorageState.$('proQrFallback');
    if (fb) fb.hidden = true;
    img.src = proQrUrl(proCheckoutState.proPlan);
  }
  /* trạng thái chờ */
  resetProStatus();
  if (proCheckoutState.PRO_VERIFY_URL) startProWatch();
  audioEffectsState.Sfx.click();
}
/* ── Theo dõi trạng thái thanh toán (tự động nâng cấp) ── */

export function resetProStatus() {
  if (proCheckoutState.proWatchTimer) {
    clearInterval(proCheckoutState.proWatchTimer);
    proCheckoutState.proWatchTimer = null;
  }
  proCheckoutState.proWatchTries = 0;
  const st = accountStorageState.$('proStatus');
  if (st) st.hidden = true;
}

export function startProWatch() {
  if (!proCheckoutState.PRO_VERIFY_URL) return;
  const st = accountStorageState.$('proStatus'),
    txt = accountStorageState.$('proStatusText');
  if (st) st.hidden = false;
  if (txt) txt.textContent = 'Đang chờ xác nhận giao dịch… (tự mở khoá khi tiền về)';
  if (proCheckoutState.proWatchTimer) clearInterval(proCheckoutState.proWatchTimer);
  proCheckoutState.proWatchTimer = setInterval(async () => {
    proCheckoutState.proWatchTries++;
    if (proCheckoutState.proWatchTries > 120) {
      clearInterval(proCheckoutState.proWatchTimer);
      proCheckoutState.proWatchTimer = null;
      if (txt) txt.textContent = 'Chưa nhận được giao dịch. Nhắn Zalo kèm ảnh chuyển khoản để được hỗ trợ.';
      return;
    }
    try {
      const r = await fetch(proCheckoutState.PRO_VERIFY_URL + '?note=' + encodeURIComponent(proTransferNote()) + '&amount=' + (proCheckoutState.PRO_PLANS[proCheckoutState.proPlan] || proCheckoutState.PRO_PLANS.month).amount, {
        cache: 'no-store'
      });
      if (!r.ok) return;
      const d = await r.json();
      if (d && d.paid) {
        clearInterval(proCheckoutState.proWatchTimer);
        proCheckoutState.proWatchTimer = null;
        proEntitlementsState.serverProConfirmed = true;
        proEntitlementsState.serverProPlan = d.plan || proCheckoutState.proPlan;
        ensureProContent(); /* nạp nội dung Pro (HSK 4–9) từ server */
        /* ★ Chỉ bật Pro khi đã xác định được TÀI KHOẢN (Pro gắn với email) */
        if (!setPro(d.plan || proCheckoutState.proPlan, true)) {
          if (txt) txt.textContent = 'Đã nhận tiền nhưng chưa xác định được tài khoản — hãy đăng nhập lại rồi mở lại bảng này.';
          return;
        }
        renderProState();
        closeModal('proModal');
        fireConfetti(220);
        audioEffectsState.Sfx.win();
        toast('🎉 Đã nhận được chuyển khoản — Pro tự động kích hoạt!', 'ok', 4500);
      }
    } catch (e) {/* mạng lỗi → thử lại vòng sau */}
  }, 5000);
}

export function copyText(text, btn) {
  const done = () => {
    const old = btn.textContent;
    btn.textContent = '✓';
    btn.classList.add('copied');
    audioEffectsState.Sfx.correct(2);
    setTimeout(() => {
      btn.textContent = old;
      btn.classList.remove('copied');
    }, 1600);
  };
  if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done).catch(() => fallbackCopy(text, done));else fallbackCopy(text, done);
}

export function fallbackCopy(text, done) {
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.style.position = 'fixed';
  ta.style.opacity = '0';
  document.body.appendChild(ta);
  ta.select();
  try {
    document.execCommand('copy');
    done();
  } catch (e) {
    toast('Không copy được — hãy chọn và copy thủ công.', 'warn');
  }
  ta.remove();
}

/* ★ Đồng bộ giá gói giữa landing page và modal */
export function renderPricing() {
  accountStorageState.$$('[data-pro-price]').forEach(el => {
    const p = proCheckoutState.PRO_PLANS[el.dataset.proPrice];
    if (p) el.textContent = p.price;
  });
  /* landing: giữ nguyên cấu trúc "79.000đ<span>/tháng</span>" → chỉ thay nút text đầu tiên */
  accountStorageState.$$('[data-price-slot]').forEach(el => {
    const p = proCheckoutState.PRO_PLANS[el.dataset.priceSlot];
    if (!p) return;
    if (el.firstChild && el.firstChild.nodeType === 3) el.firstChild.nodeValue = p.price;else el.textContent = p.price;
  });
}
/* ★ Chọn gói ngay trên landing: Gói tháng ↔ Trọn đời */

export function syncLandingPlan() {
  const info = proCheckoutState.PRO_PLANS[normalizeProPlanKey(proCheckoutState.landingPlan)] || proCheckoutState.PRO_PLANS.month;
  const num = accountStorageState.$('lpProPrice');
  if (num) {
    const span = num.querySelector('span');
    if (num.firstChild && num.firstChild.nodeType === 3) num.firstChild.nodeValue = info.price;else num.textContent = info.price;
    if (span) span.textContent = info.unit;
  }
  accountStorageState.$$('.lp-planBtn').forEach(b => {
    const on = normalizeProPlanKey(b.dataset.lpPlan) === normalizeProPlanKey(proCheckoutState.landingPlan);
    b.classList.toggle('active', on);
    b.setAttribute('aria-pressed', on ? 'true' : 'false');
  });
  const save = accountStorageState.$('lpProSave');
  if (save) {
    save.textContent = 'Tiết kiệm hơn khi chọn gói năm';
    save.classList.toggle('isBest', proCheckoutState.landingPlan === 'year');
  }
}

export function initializeProCheckout() {
  /* ═══════════════ MODAL PRO + THANH TOÁN ═══════════════ */
  /* ★ MỘT nguồn dữ liệu duy nhất cho gói Pro — landing page và modal đều đọc từ đây
     để giá / quyền lợi không bao giờ lệch nhau. */
  proCheckoutState.APP_CONFIG = typeof window !== 'undefined' && window.APP_CONFIG || {};
  proCheckoutState.PRO_MONTH_MS = 31 * 24 * 60 * 60 * 1000;
  proCheckoutState.PRO_YEAR_MS = 365 * 24 * 60 * 60 * 1000;
  proCheckoutState.PRO_PLANS = {
    month: {
      price: '39.000đ',
      amount: 39000,
      label: 'Gói tháng',
      unit: '/tháng'
    },
    year: {
      price: '399.000đ',
      amount: 399000,
      label: 'Gói năm',
      unit: '/năm'
    },
    lifetime: {
      price: '399.000đ',
      amount: 399000,
      label: 'Gói năm',
      unit: '/năm'
    }
  };
  /* ★ Thông tin nhận tiền — dùng để sinh mã VietQR riêng cho từng khách
     (QR có sẵn số tiền + nội dung, khách quét là ngân hàng tự điền). */
  proCheckoutState.PRO_BANK = {
    bank: proCheckoutState.APP_CONFIG.BANK_NAME || proCheckoutState.APP_CONFIG.PRO_BANK_NAME || 'Vietcombank',
    bin: proCheckoutState.APP_CONFIG.BANK_BIN || proCheckoutState.APP_CONFIG.PRO_BANK_BIN || '970436',
    acc: proCheckoutState.APP_CONFIG.BANK_ACC || proCheckoutState.APP_CONFIG.PRO_BANK_ACC || '9342383345',
    name: proCheckoutState.APP_CONFIG.BANK_OWNER || proCheckoutState.APP_CONFIG.PRO_BANK_OWNER || 'NGUYEN VAN LONG'
  };
  /* ⚙️ TỰ ĐỘNG NÂNG CẤP PRO
     Điền PRO_VERIFY_URL = endpoint đối soát của bạn (xem server/pro-server.js).
     Endpoint nhận ?note=<nội dung CK>&amount=<số tiền> và trả JSON:
       { "paid": true, "plan": "month" }
     Khi có URL này, app tự hỏi lại mỗi 5 giây và mở Pro ngay khi tiền về.
     Để trống '' → dùng luồng xác nhận thủ công (khách tick ô rồi bấm kích hoạt).
     (Có thể đặt trước bằng window.PRO_VERIFY_URL nếu không muốn sửa file này.) */
  proCheckoutState.PRO_VERIFY_URL = typeof window !== 'undefined' && window.PRO_VERIFY_URL || proCheckoutState.APP_CONFIG.PRO_VERIFY_URL || proCheckoutState.APP_CONFIG.GOPINYIN_PRO_VERIFY_URL || '';
  proCheckoutState.PRO_CONTENT_URL = typeof window !== 'undefined' && window.PRO_CONTENT_URL || proCheckoutState.APP_CONFIG.PRO_CONTENT_URL || proCheckoutState.APP_CONFIG.GOPINYIN_PRO_CONTENT_URL || (proCheckoutState.PRO_VERIFY_URL ? proCheckoutState.PRO_VERIFY_URL.replace(/\/pro\/status$/, '') + '/pro/content' : '');
  proCheckoutState.proPlan = 'month';
  /* ── Theo dõi trạng thái thanh toán (tự động nâng cấp) ── */
  proCheckoutState.proWatchTimer = null;
  proCheckoutState.proWatchTries = 0;
  accountStorageState.$$('.proPlan').forEach(p => p.addEventListener('click', () => {
    proCheckoutState.proPlan = p.dataset.plan;
    syncProPlan();
  }));
  accountStorageState.$('proConfirmChk').addEventListener('change', e => {
    accountStorageState.$('proActivateBtn').disabled = !e.target.checked;
    audioEffectsState.Sfx.click();
  });
  /* Ảnh QR tải xong / lỗi */
  (function () {
    const img = accountStorageState.$('proQrImg');
    if (!img) return;
    img.addEventListener('load', () => {
      img.classList.add('ready');
      const fb = accountStorageState.$('proQrFallback');
      if (fb) fb.hidden = true;
    });
    img.addEventListener('error', () => {
      img.classList.remove('ready');
      const fb = accountStorageState.$('proQrFallback');
      if (fb) fb.hidden = false;
    });
  })();
  accountStorageState.$$('.proCopy').forEach(btn => btn.addEventListener('click', e => {
    e.preventDefault();
    copyText(String(btn.dataset.copy || '').trim(), e.currentTarget);
  }));
  accountStorageState.$('proActivateBtn').addEventListener('click', () => {
    /* ⚠️ PRODUCTION: nên để server xác nhận giao dịch (PRO_VERIFY_URL) rồi mới bật Pro.
       Ở bản front-end này, ta bật Pro cục bộ sau khi người dùng xác nhận đã chuyển khoản.
       ★ Pro nay gắn với TÀI KHOẢN: khách / chưa đăng nhập thì không kích hoạt được. */
    const u = currentUser();
    if (!u || u.guest || !u.email) {
      toast('Hãy tạo tài khoản (hoặc đăng nhập) trước khi kích hoạt Pro — quyền Pro gắn với email để còn khôi phục khi đổi máy.', 'warn', 5000);
      closeModal('proModal');
      openModal('authModal');
      return;
    }
    const ok = setPro(proCheckoutState.proPlan);
    if (!ok) {
      toast('Không kích hoạt được Pro cho tài khoản này. Hãy đăng nhập lại rồi thử.', 'bad', 4500);
      return;
    }
    renderProState();
    resetProStatus();
    closeModal('proModal');
    fireConfetti(220);
    audioEffectsState.Sfx.win();
    toast('🎉 Kích hoạt Pro thành công! Toàn bộ tính năng đã mở khoá.', 'ok', 4200);
    accountStorageState.$('proConfirmChk').checked = false;
    accountStorageState.$('proActivateBtn').disabled = true;
  });
  accountStorageState.$('wsUpgradeBtn').addEventListener('click', () => openModal('proModal'));
  accountStorageState.$('trialUpgradeBtn')?.addEventListener('click', () => openModal('proModal'));
  accountStorageState.$('lpPriceProBtn').addEventListener('click', () => {
    /* mở modal với ĐÚNG gói đang chọn ở landing */
    proCheckoutState.proPlan = proCheckoutState.landingPlan;
    openModal('proModal');
  });
  /* Cho app-core gọi khi khách bấm vào nội dung Pro (HSK 4–9) */
  publishLegacy("__gpOpenPro", () => openModal('proModal'));
  accountStorageState.$('heroProBtn').addEventListener('click', () => {
    document.getElementById('pricing').scrollIntoView({
      behavior: 'smooth'
    });
    audioEffectsState.Sfx.click();
  });
  /* Đóng modal Pro → ngừng hỏi server */
  accountStorageState.$$('[data-close="pro"]').forEach(el => el.addEventListener('click', resetProStatus));
  /* ★ Đồng bộ giá gói giữa landing page và modal */
  /* ★ Chọn gói ngay trên landing: Gói tháng ↔ Trọn đời */
  proCheckoutState.landingPlan = 'month';
  accountStorageState.$$('.lp-planBtn').forEach(b => b.addEventListener('click', () => {
    proCheckoutState.landingPlan = b.dataset.lpPlan === 'year' ? 'year' : 'month';
    syncLandingPlan();
    audioEffectsState.Sfx.click();
  }));

  /* ═══════════════ ĐĂNG NHẬP / CTA TỪ LANDING ═══════════════ */
}
