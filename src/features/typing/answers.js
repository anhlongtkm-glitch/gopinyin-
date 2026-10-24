// State and behavior owned by features/typing/answers. Initialization is orchestrated by app/bootstrap.js.

import { hanChars, hanSyllableList, hanziAnswer } from "./input.js";

import { currentRow, state as typingSessionState } from "./session.js";

import { countPinyinSyllables } from "../../shared/audio/tts.js";

import { state as domState } from "../../shared/dom.js";

import { normalize } from "../../shared/language/normalization.js";

import { fixPinyin, state as languagePinyinState, canTakeErhua } from "../../shared/language/pinyin.js";

/* ★ Tách pinyin thành các ÂM TIẾT riêng — SỬA LỖI "xiāojí" bị lặp trên mọi chữ.
   AI (Gemini/OpenRouter) và một số file Excel ghi pinyin VIẾT LIỀN
   nhiều âm tiết trong 1 token ("xiāojí", "zhongguo2"). Nếu giữ nguyên:
     • mỗi chữ Hán đều nhận nguyên token → "消" và "极" đều hiện "xiāojí";
     • phần gõ pinyin cũng báo sai vì plain chỉ có 1 âm tiết thay vì 2.
   → Token nào chứa >1 âm tiết thì tách ra. fixPinyin xử lý cả số thanh lẫn
   dấu thanh, và countPinyinSyllables("wánr")=1 nên ERHUA được giữ nguyên. */
export function answerWords(q) {
  const raw = String(q.py || '').trim().split(/\s+/).filter(Boolean);
  const marked = [],
    plain = [];
  for (const t of raw) {
    if (countPinyinSyllables(t) > 1) {
      const parts = fixPinyin(t).split(/\s+/).filter(Boolean);
      /* Chỉ nhận khi MỌI mảnh là âm tiết pinyin hợp lệ — tránh phá dữ liệu lạ
         (vd cột pinyin lỡ chứa 1 từ tiếng Anh "chinese"). Không khớp → giữ nguyên. */
      if (parts.length > 1 && parts.every(p => languagePinyinState.PINYIN_SYLLABLES.has(normalize(p)))) {
        if (t[0] !== t[0].toLowerCase()) parts[0] = parts[0].charAt(0).toUpperCase() + parts[0].slice(1);
        marked.push(...parts);
        for (const p of parts) plain.push(...normalize(p).split(' ').filter(Boolean));
        continue;
      }
    }
    const cleaned = fixPinyin(t);
    marked.push(cleaned);
    plain.push(...normalize(cleaned).split(' ').filter(Boolean));
  }
  /* ★ SỬA DỮ LIỆU CŨ: bản cũ của fixPinyin tách erhua thành 2 token ("diǎn" + "r").
     Dữ liệu đã lưu trong Thư viện/AI vẫn còn dạng hỏng đó → gộp 'r' trở lại âm
     tiết trước ("diǎn"+"r" → "diǎnr") để hiển thị và gõ pinyin đều đúng.
     Chỉ làm khi marked/plain khớp 1:1 (tránh lệch chỉ số với dữ liệu lạ). */
  if (marked.length === plain.length && marked.length > 1) {
    const fm = [],
      fp = [];
    for (let i = 0; i < marked.length; i++) {
      const nxt = marked[i + 1];
      if (nxt !== undefined && /^r$/i.test(nxt) && canTakeErhua(marked[i])) {
        fm.push(marked[i] + 'r');
        fp.push(plain[i] + 'r');
        i++;
        continue;
      }
      fm.push(marked[i]);
      fp.push(plain[i]);
    }
    return {
      marked: fm,
      plain: fp
    };
  }
  return {
    marked,
    plain
  };
}
/* ── Typing Word Index ── */
/* ★ Vị trí âm tiết đang gõ = âm tiết ứng với chữ HÁN kế tiếp người dùng sẽ gõ
   (dùng để sáng từ trên dòng chữ Hán). */

/* ── Typing Word Index ── */
/* ★ Vị trí âm tiết đang gõ = âm tiết ứng với chữ HÁN kế tiếp người dùng sẽ gõ
   (dùng để sáng từ trên dòng chữ Hán). */
export function currentTypingWordIndex() {
  const q = currentRow();
  if (!q) return -1;
  const total = answerWords(q).marked.length;
  if (typingSessionState.awaitingEnter) return Math.max(0, total - 1);
  /* Số chữ Hán ĐÃ gõ → âm tiết của chữ ĐANG gõ → sáng đúng chữ đó.
     Phải đếm theo chữ Hán rồi tra danh sách âm tiết cũng theo chữ Hán
     (bỏ dấu câu), nếu không câu có dấu câu sẽ sáng nhầm chữ. */
  const typed = hanChars(domState.$('pinyinInput').value).length;
  const list = hanSyllableList(q, hanziAnswer(q).length);
  const idx = typed < list.length ? list[typed] : Math.max(0, total - 1);
  return Math.min(Math.max(0, idx), Math.max(0, total - 1));
}

export function updateChineseHighlight() {
  const pairs = document.querySelectorAll('#chinese .hanzi-pair');
  const active = currentTypingWordIndex();
  pairs.forEach(el => {
    const a = Number(el.dataset.wordIndex || 0),
      b = Number(el.dataset.wordEnd != null ? el.dataset.wordEnd : el.dataset.wordIndex || 0);
    el.classList.toggle('active', active >= a && active <= b);
    el.classList.toggle('done', b < active);
  });
}

export function updateWrongBadge() {
  const b = domState.$('wrongBadge');
  if (b) b.textContent = typingSessionState.wrongIds.size;
}

/* ── Stats & Render ── */

/* ── Stats & Render ── */
export function currentTotal() {
  return typingSessionState.order.length;
}
/* ★ Hệ thống điểm mới:
   • Đúng  = số CÂU gõ đúng (hoàn thành)
   • Sai   = số CÂU có ít nhất 1 lần gõ sai (mỗi câu chỉ tính 1 lần, dù gõ sai nhiều ký tự)
   • Combo = chuỗi câu đúng liên tiếp hiện tại (sai là mất chuỗi)
   • Chính xác = Đúng / (Đúng + Sai) */
