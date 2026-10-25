// State and behavior owned by features/auth/service. Initialization is orchestrated by app/bootstrap.js.

import { enterWorkspace } from "../../app/navigation.js";


import { state as accountStorageState } from "../../shared/account-storage.js";

import { toast } from "../../shared/toast.js";

export const state = {};

const authServiceState = state;

/* ═══════════════ XÁC THỰC (demo local — sẵn sàng nối API) ═══════════════ */
export function getUsers() {
  return accountStorageState.lsGet(accountStorageState.LS.users, {}) || {};
}

export function currentUser() {
  return accountStorageState.lsGet(accountStorageState.LS.user, null);
}

export function saveUser(u) {
  accountStorageState.lsSet(accountStorageState.LS.user, u);
}
/* ═══════════════ MẬT KHẨU — PBKDF2 (WebCrypto) ═══════════════
   ★ Bản cũ dùng `(h<<5)-h+charCode` — KHÔNG phải hàm băm mật mã: không salt,
     chỉ 32 bit, đảo ngược/đoán lại trong tích tắc.
   Nay:
     • PBKDF2-SHA256, 120.000 vòng, salt 16 byte ngẫu nhiên cho MỖI tài khoản.
     • Lưu dạng: pbkdf2$<iter>$<saltHex>$<hashHex>
     • Tài khoản cũ (dạng 'h…') vẫn đăng nhập được và được TỰ NÂNG CẤP sang
       PBKDF2 ngay lần đăng nhập kế tiếp → không mất tài khoản đang có.
   Lưu ý: đây vẫn là xác thực phía client (bản demo tĩnh). Khi thương mại hoá
   BẮT BUỘC chuyển sang backend — cần backend xác thực riêng. */

export function bufToHex(b) {
  return Array.from(new Uint8Array(b)).map(x => x.toString(16).padStart(2, '0')).join('');
}

export function hexToBuf(h) {
  const n = Math.floor(String(h).length / 2),
    a = new Uint8Array(n);
  for (let i = 0; i < n; i++) a[i] = parseInt(String(h).substr(i * 2, 2), 16);
  return a;
}
/* hash yếu của bản cũ — CHỈ giữ để nâng cấp tài khoản cũ, không dùng cho bản ghi mới */

/* hash yếu của bản cũ — CHỈ giữ để nâng cấp tài khoản cũ, không dùng cho bản ghi mới */
export function hashPassLegacy(p) {
  let h = 0;
  for (let i = 0; i < p.length; i++) {
    h = (h << 5) - h + p.charCodeAt(i);
    h |= 0;
  }
  return 'h' + Math.abs(h);
}

export function cryptoOk() {
  return !!(window.crypto && window.crypto.subtle && window.crypto.getRandomValues && window.TextEncoder);
}

export async function pbkdf2Hex(pass, saltHex, iter) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', enc.encode(String(pass)), {
    name: 'PBKDF2'
  }, false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({
    name: 'PBKDF2',
    salt: hexToBuf(saltHex),
    iterations: iter,
    hash: 'SHA-256'
  }, key, 256);
  return bufToHex(bits);
}
/* Tạo bản ghi mật khẩu mới. Không có WebCrypto → lùi về hash cũ (vẫn đăng nhập được). */

/* Tạo bản ghi mật khẩu mới. Không có WebCrypto → lùi về hash cũ (vẫn đăng nhập được). */
export async function hashPass(p) {
  if (!cryptoOk()) return {
    stored: hashPassLegacy(p),
    legacy: true
  };
  const saltBuf = new Uint8Array(16);
  crypto.getRandomValues(saltBuf);
  const salt = bufToHex(saltBuf);
  const h = await pbkdf2Hex(p, salt, authServiceState.PBKDF2_ITER);
  return {
    stored: authServiceState.PASS_PREFIX + authServiceState.PBKDF2_ITER + '$' + salt + '$' + h,
    legacy: false
  };
}
/* So khớp mật khẩu → {ok, needsUpgrade} */

/* So khớp mật khẩu → {ok, needsUpgrade} */
export async function verifyPass(pass, stored) {
  if (!stored) return {
    ok: false,
    needsUpgrade: false
  };
  const s = String(stored);
  if (s.indexOf(authServiceState.PASS_PREFIX) === 0) {
    const parts = s.split('$');
    const iter = Number(parts[1]) || authServiceState.PBKDF2_ITER,
      salt = parts[2] || '',
      want = parts[3] || '';
    if (!salt || !want) return {
      ok: false,
      needsUpgrade: false
    };
    const calc = await pbkdf2Hex(pass, salt, iter);
    return {
      ok: calc === want,
      needsUpgrade: false
    };
  }
  return {
    ok: s === hashPassLegacy(pass),
    needsUpgrade: true
  };
}

export async function doLogin(email, pass) {
  const users = getUsers();
  const key = String(email || '').trim().toLowerCase();
  const u = users[key];
  if (!u) return {
    ok: false,
    msg: 'Email chưa được đăng ký. Chuyển sang tab Đăng ký nhé!'
  };
  const v = await verifyPass(pass, u.pass);
  if (!v.ok) return {
    ok: false,
    msg: 'Mật khẩu không đúng. Thử lại nào!'
  };
  /* ★ Nâng cấp bản ghi cũ (hash yếu) sang PBKDF2 ngay khi đăng nhập thành công */
  if (v.needsUpgrade) {
    try {
      const nh = await hashPass(pass);
      if (!nh.legacy) {
        users[key].pass = nh.stored;
        accountStorageState.lsSet(accountStorageState.LS.users, users);
      }
    } catch (e) {}
  }
  saveUser({
    email: key,
    name: u.name,
    guest: false
  });
  return {
    ok: true,
    user: {
      email: key,
      name: u.name
    }
  };
}

export async function doRegister(name, email, pass) {
  const users = getUsers();
  const key = String(email || '').trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(key)) return {
    ok: false,
    msg: 'Email không hợp lệ.'
  };
  if (String(pass || '').length < 8) return {
    ok: false,
    msg: 'Mật khẩu cần ít nhất 8 ký tự.'
  };
  if (users[key]) return {
    ok: false,
    msg: 'Email này đã có tài khoản. Hãy đăng nhập.'
  };
  let stored;
  try {
    stored = (await hashPass(pass)).stored;
  } catch (e) {
    return {
      ok: false,
      msg: 'Trình duyệt không hỗ trợ mã hoá mật khẩu — hãy dùng Chrome/Edge/Firefox bản mới.'
    };
  }
  users[key] = {
    name: String(name || '').trim() || key.split('@')[0],
    pass: stored,
    createdAt: Date.now()
  };
  accountStorageState.lsSet(accountStorageState.LS.users, users);
  saveUser({
    email: key,
    name: users[key].name,
    guest: false
  });
  return {
    ok: true,
    user: {
      email: key,
      name: users[key].name
    }
  };
}

export function doGuest() {
  saveUser({
    email: '',
    name: 'Khách',
    guest: true
  });
  return {
    ok: true,
    user: {
      email: '',
      name: 'Khách',
      guest: true
    }
  };
}

export function doLogout() {
  localStorage.removeItem(accountStorageState.LS.user);
  doGuest();
  enterWorkspace();
  toast('Đã đăng xuất. Hẹn gặp lại bạn!', 'ok');
}


export function initializeAuthService() {
  /* ═══════════════ MẬT KHẨU — PBKDF2 (WebCrypto) ═══════════════
     ★ Bản cũ dùng `(h<<5)-h+charCode` — KHÔNG phải hàm băm mật mã: không salt,
       chỉ 32 bit, đảo ngược/đoán lại trong tích tắc.
     Nay:
       • PBKDF2-SHA256, 120.000 vòng, salt 16 byte ngẫu nhiên cho MỖI tài khoản.
       • Lưu dạng: pbkdf2$<iter>$<saltHex>$<hashHex>
       • Tài khoản cũ (dạng 'h…') vẫn đăng nhập được và được TỰ NÂNG CẤP sang
         PBKDF2 ngay lần đăng nhập kế tiếp → không mất tài khoản đang có.
     Lưu ý: đây vẫn là xác thực phía client (bản demo tĩnh). Khi thương mại hoá
     BẮT BUỘC chuyển sang backend — xem mục "Kết nối thanh toán thật" trong README. */
  authServiceState.PBKDF2_ITER = 120000;
  authServiceState.PASS_PREFIX = 'pbkdf2$';
}
