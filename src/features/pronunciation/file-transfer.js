import { learningStorage } from "../../shared/storage/account-data.js";
// State and behavior owned by features/pronunciation/file-transfer. Initialization is orchestrated by app/bootstrap.js.

import { state as pronunciationUtilsState, toast } from "./utils.js";

export const state = {};

const pronunciationFileTransferState = state;

export function showFileWarn(show) {
  document.querySelectorAll('[data-filewarn]').forEach(el => el.classList.toggle('hidden', !show));
  /* Băng cảnh báo chiếm ~50px chiều cao → bỏ hàng gợi ý phím để nút micro
     không bị đẩy ra ngoài vùng nhìn (thẻ vẫn vừa đúng 1 khung hình). */
  const card = pronunciationUtilsState.$('pronCard');
  if (card) card.classList.toggle('has-warn', !!show);
}

export async function probePort(port) {
  try {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), 1100);
    const r = await fetch('http://localhost:' + port + '/__gopinyin', {
      cache: 'no-store',
      signal: ctl.signal
    });
    clearTimeout(t);
    if (!r.ok) return '';
    const d = await r.json();
    return d && d.app === 'gopinyin' ? 'http://localhost:' + port + '/' : '';
  } catch (e) {
    return '';
  }
}

export async function detectLocal() {
  for (const p of pronunciationFileTransferState.LOCAL_PORTS) {
    const u = await probePort(p);
    if (u) return u;
  }
  return '';
}

export function syncFileWarn() {
  if (!pronunciationFileTransferState.isFileProto()) {
    showFileWarn(false);
    return;
  }
  showFileWarn(true);
  const goBtns = [...document.querySelectorAll('[data-filewarn-go]')];
  goBtns.forEach(b => {
    b.disabled = true;
    b.textContent = 'Đang tìm server nội bộ…';
  });
  detectLocal().then(url => {
    goBtns.forEach(b => {
      if (url) {
        b.disabled = false;
        b.dataset.url = url;
        b.textContent = 'Chuyển sang ' + url.replace(/\/$/, '') + ' (giữ tiến độ)';
      } else {
        b.disabled = false;
        b.dataset.url = '';
        b.textContent = 'Xem cách chạy start.bat';
      }
    });
  });
}

/* Dồn toàn bộ localStorage của trang file:// lên server rồi mới chuyển địa chỉ,
   để KHÔNG mất tài khoản và tiến độ (localStorage gắn theo origin). */

/* Dồn toàn bộ localStorage của trang file:// lên server rồi mới chuyển địa chỉ,
   để KHÔNG mất tài khoản và tiến độ (localStorage gắn theo origin). */
export async function migrateAndGo(url) {
  const base = url.replace(/\/$/, '');
  let token = '';
  try {
    const dump = {};
    for (let i = 0; i < learningStorage.length; i++) {
      const k = learningStorage.key(i);
      if (k != null) dump[k] = learningStorage.getItem(k);
    }
    const r = await fetch(base + '/__import', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        data: dump
      })
    });
    if (r.ok) {
      const d = await r.json();
      token = d && d.token || '';
    }
  } catch (e) {
    token = '';
  }
  location.replace(base + '/' + (token ? '?import=' + encodeURIComponent(token) : ''));
}

export function wireFileWarn() {
  document.addEventListener('click', e => {
    const hide = e.target.closest('[data-filewarn-hide]');
    if (hide) {
      showFileWarn(false);
      return;
    }
    const go = e.target.closest('[data-filewarn-go]');
    if (!go) return;
    const url = go.dataset.url;
    if (url) {
      migrateAndGo(url);
      return;
    }
    /* Chưa có server → chỉ cách chạy */
    toast('Mở thư mục <b>gopinyin</b> → nháy đúp <b>start.bat</b> → trình duyệt tự mở http://localhost:8080', 'warn', 8000);
  });
}

/* ═══════════════════════════════════════════════════════════
   Màn CHỌN BỘ CÂU — vào đây trước, chọn cấp rồi mới luyện
   (giống luồng của màn Luyện gõ, để người dùng không bị ném thẳng
   vào một bộ câu ngẫu nhiên)
   ═══════════════════════════════════════════════════════════ */

export function initializePronunciationFileTransfer() {
  /* ═══════════════════════════════════════════════════════════
     CẢNH BÁO file:// — nguyên nhân thật của "hỏi quyền micro mỗi lần"
     Chrome KHÔNG lưu quyền micro cho origin `file://`. Vì vậy mỗi lần
     SpeechRecognition.start() (mỗi lượt nói) Chrome lại hỏi. Không có cách
     nào sửa bằng JavaScript — phải chạy qua http://localhost (hoặc https).
     Ở đây: dò xem máy có server nội bộ đang chạy không; nếu có thì chuyển
     hướng sang đó (1 lần / tab), nếu không thì hiện băng hướng dẫn.
     ═══════════════════════════════════════════════════════════ */
  pronunciationFileTransferState.LOCAL_PORTS = [8080, 5500, 8090, 3000];
  pronunciationFileTransferState.isFileProto = () => location.protocol === 'file:';
}
