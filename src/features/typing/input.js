// State and behavior owned by features/typing/input. Initialization is orchestrated by app/bootstrap.js.

import { state as dataCatalogState } from "../../data/catalog.js";

import { answerWords, updateChineseHighlight } from "./answers.js";

import { updateModeUI } from "./controls.js";

import { openDataset } from "./datasets.js";

import { hanziInputShake } from "./events.js";

import { renderAppHistory, state as typingHistoryState } from "./history.js";

import { save } from "./progress.js";

import { render, renderStatsOnly } from "./render.js";

import { markSentenceWrong, markSentenceCorrect } from "./scoring.js";

import { state as typingSessionState, currentRow } from "./session.js";

import { weakInc, saveWeak, topWeakWords, speedRecord } from "./weakness.js";

import { speakTypedProgress } from "../../shared/audio/tts.js";

import { state as domState } from "../../shared/dom.js";

import { splitChineseByPinyin, renderChineseWords } from "../../shared/language/hanzi.js";

import { hasVietnameseChars, typingPlain, normalize } from "../../shared/language/normalization.js";

import { stripToneMarks } from "../../shared/language/pinyin.js";

import { dbPut } from "../../shared/storage/lesson-repository.js";

import { toast } from "../../shared/toast.js";

import { escapeHtml } from "../../shared/utils.js";

export const state = {};

const typingInputState = state;

/* ★ Nhảy tới 1 câu theo id (để làm lại).
   LỖI CŨ (đã sửa): id trong `rows` là SỐ, còn id lấy từ DOM (`dataset.id`) là
   CHUỖI → so sánh `===` không bao giờ khớp. Tệ hơn, hàm ĐỔI `mode`/`order`
   TRƯỚC khi biết có tìm thấy câu hay không, rồi `return` → giao diện vẫn hiển
   thị câu cũ nhưng `order` đã thành danh sách mới, nên bộ lọc gõ so với MỘT CÂU
   KHÁC (vd đang xem "现在是零点。" nhưng đòi gõ "谢…" của "谢谢你！").
   Nay: so sánh bằng String(), và chỉ đổi trạng thái SAU KHI đã tìm thấy câu. */
export function sameRowId(a, b) {
  return a != null && b != null && String(a) === String(b);
}

export function gotoRowById(id) {
  if (id == null || id === '') return;
  /* 1) tìm trong lượt hiện tại */
  let target = -1;
  for (let i = 0; i < typingSessionState.order.length; i++) {
    if (sameRowId(typingSessionState.rows[typingSessionState.order[i]] && typingSessionState.rows[typingSessionState.order[i]].id, id)) {
      target = i;
      break;
    }
  }
  if (target < 0) {
    /* 2) chưa có → tìm trong TOÀN BỘ rows; không thấy thì KHÔNG đụng gì cả */
    let rowIdx = -1;
    for (let i = 0; i < typingSessionState.rows.length; i++) {
      if (sameRowId(typingSessionState.rows[i] && typingSessionState.rows[i].id, id)) {
        rowIdx = i;
        break;
      }
    }
    if (rowIdx < 0) return;
    typingSessionState.mode = 'all';
    typingSessionState.order = [...Array(typingSessionState.rows.length).keys()];
    target = rowIdx;
    try {
      updateModeUI();
    } catch (e) {}
  }
  typingSessionState.index = target;
  typingSessionState.awaitingEnter = false;
  typingSessionState.curHadError = false;
  typingSessionState.hanWrongSig = '';
  if (typingSessionState.mode === 'all') {
    typingSessionState.mainOrder = [...typingSessionState.order];
    typingSessionState.mainIndex = typingSessionState.index;
  }
  const inp = domState.$('pinyinInput');
  inp.readOnly = false;
  inp.classList.remove('ok', 'bad');
  render();
  renderAppHistory();
  setTimeout(() => {
    try {
      inp.focus();
    } catch (e) {}
  }, 60);
}

export function flashWrong() {
  const inp = domState.$('pinyinInput');
  inp.classList.remove('ok');
  inp.classList.add('bad');
  domState.$('feedback').className = 'feedback bad';
  /* ★ Phát hiện bàn phím tiếng Việt đang bật → nhắc TẮT thay vì báo "ký tự sai" */
  domState.$('feedback').textContent = hasVietnameseChars(inp.value) ? '⚠️ Bạn đang bật GÕ TIẾNG VIỆT (Telex / VNI / UniKey / Gboard) — chữ bị biến dạng nên app báo sai. Hãy TẮT gõ tiếng Việt (chuyển bàn phím về English) rồi gõ lại.' : '✗ Ký tự vừa nhập không đúng. Hãy sửa đúng rồi mới gõ tiếp.';
  setTimeout(() => inp.classList.remove('bad'), 260);
}

/* ═══════════════════════════════════════════════════════════
   ★ FIX LOCKUP: Khi người dùng gõ sai, KHÔNG xoá sạch input.
   Trước đây code dùng inp.value=lastValidInput — nếu lastValidInput=''
   (câu mới, chưa gõ đúng ký tự nào) thì mọi phím gõ sau đó đều bị xoá
   → người dùng không thể gõ gì được nữa (lockup vĩnh viễn).
   Giải pháp: cắt input đến độ dài giữ được tiền tố hợp lệ dài nhất.
   ═══════════════════════════════════════════════════════════ */

/* ═══════════════════════════════════════════════════════════
   ★ FIX LOCKUP: Khi người dùng gõ sai, KHÔNG xoá sạch input.
   Trước đây code dùng inp.value=lastValidInput — nếu lastValidInput=''
   (câu mới, chưa gõ đúng ký tự nào) thì mọi phím gõ sau đó đều bị xoá
   → người dùng không thể gõ gì được nữa (lockup vĩnh viễn).
   Giải pháp: cắt input đến độ dài giữ được tiền tố hợp lệ dài nhất.
   ═══════════════════════════════════════════════════════════ */
export function trimToValidPinyinPrefix(inp, words) {
  const plainAll = typingPlain(inp.value).split(' ').filter(Boolean);
  const expectAll = words.plain.map(typingPlain);
  const hasTrailingSpace = /\s$/.test(inp.value);
  let validWordCount = 0;
  for (let i = 0; i < plainAll.length; i++) {
    if (i >= expectAll.length) break;
    if (plainAll[i] === expectAll[i]) validWordCount = i + 1;else break;
  }
  if (validWordCount >= plainAll.length) {
    return;
  }
  const validPart = words.marked.slice(0, validWordCount);
  const currentPlain = plainAll[validWordCount] || '';
  const expectedPlain = expectAll[validWordCount] || '';
  let validPrefixLen = 0;
  for (let i = 0; i <= currentPlain.length; i++) {
    if (i <= expectedPlain.length && expectedPlain.startsWith(currentPlain.slice(0, i))) {
      validPrefixLen = i;
    }
  }
  let newVal;
  if (validPrefixLen > 0 && validWordCount > 0 && validWordCount < expectAll.length) {
    /* Có từ đã hoàn thành + đang gõ tiền tố của từ kế tiếp */
    newVal = validPart.join(' ') + ' ' + words.marked[validWordCount].slice(0, validPrefixLen);
  } else if (validPrefixLen > 0 && validWordCount === 0) {
    /* Chưa hoàn thành từ nào, đang gõ tiền tố của từ đầu tiên */
    newVal = words.marked[0] ? words.marked[0].slice(0, validPrefixLen) : '';
  } else if (validWordCount > 0) {
    /* Có từ đã hoàn thành, từ kế tiếp sai hoàn toàn → giữ từ đã xong + space */
    newVal = validPart.join(' ') + ' ';
  } else {
    /* Không có gì hợp lệ → input rỗng */
    newVal = '';
  }
  inp.value = newVal;
  typingSessionState.lastValidInput = newVal;
  if (inp.value.length > 0) {
    inp.setSelectionRange(inp.value.length, inp.value.length);
  }
}

/* ═══════════════════════════════════════════════════════════
   ★ TỰ CHẤM KHI GÕ — gõ trực tiếp CHỮ HÁN của cả câu
   · Gõ đủ + đúng cả câu → báo ✓ Đúng → nhấn SPACE sang câu tiếp theo.
   · Có chữ sai / thiếu / thừa → báo đỏ ngay, KHÔNG cho sang câu —
     phải sửa đúng tại chỗ (hoặc bấm "Bỏ qua").
   · Dấu câu và khoảng trắng không bắt buộc — bỏ qua khi so khớp.
   · ENTER = ẩn/hiện gợi ý PINYIN phía trên dòng chữ Hán.
   ═══════════════════════════════════════════════════════════ */
/* ★ Chữ Hán = CHỮ HÁN THẬT (CJK ideograph) — khoảng trắng, dấu câu Trung,
   chữ Latin/số đều KHÔNG phải chữ Hán cần gõ.
   Trước đây app chỉ "loại trừ dấu câu" nên chữ cái Latin ('n','a' lúc đang gõ
   IME tiếng Trung của máy) bị coi là chữ Hán → bộ lọc "gõ sai không nhận" xoá
   mất, người dùng KHÔNG THỂ GÕ ĐƯỢC chữ nào (lỗi ảnh chụp vòng 21). */

export function isHanChar(c) {
  return !!c && typingInputState.HAN_CHAR_RE.test(c);
}
/* Chữ Hán cần gõ của một câu (bỏ dấu câu / khoảng trắng) */

/* Chữ Hán cần gõ của một câu (bỏ dấu câu / khoảng trắng) */
export function hanChars(s) {
  return Array.from(String(s ?? '')).filter(isHanChar);
}

export function hanziAnswer(q) {
  return hanChars(q.zh);
}
/* ★ Chấm theo từng CHỮ — so vị trí với đáp án, trả về mảng {exp,got,ok}
   để tô đỏ đúng chữ người dùng gõ sai hoặc gõ thiếu. */

/* ★ Chấm theo từng CHỮ — so vị trí với đáp án, trả về mảng {exp,got,ok}
   để tô đỏ đúng chữ người dùng gõ sai hoặc gõ thiếu. */
export function gradeHanzi(raw, q) {
  const exp = hanziAnswer(q),
    got = hanChars(raw);
  const n = Math.max(exp.length, got.length),
    res = [];
  for (let i = 0; i < n; i++) res.push({
    exp: exp[i] || '',
    got: got[i] || '',
    ok: !!exp[i] && exp[i] === got[i]
  });
  return {
    res,
    exp,
    got
  };
}
/* Ánh xạ mỗi CHỮ HÁN → chỉ số ÂM TIẾT tương ứng (để cập nhật từ đang gõ
   trên dòng chữ Hán). Erhua (2 chữ 1 âm tiết) thì lấy âm tiết đầu. */

/* Ánh xạ mỗi CHỮ HÁN → chỉ số ÂM TIẾT tương ứng (để cập nhật từ đang gõ
   trên dòng chữ Hán). Erhua (2 chữ 1 âm tiết) thì lấy âm tiết đầu. */
export function hanCharSyllables(q) {
  const parts = splitChineseByPinyin(q),
    map = [];
  for (const p of parts) {
    const txt = String(p.text || '');
    const end = p.wordEnd != null ? p.wordEnd : p.wordIndex;
    for (let i = 0; i < txt.length; i++) map.push(p.wordIndex < 0 ? -1 : Math.min(p.wordIndex + i, end));
  }
  return map;
}
/* ★ Danh sách ÂM TIẾT theo CHỈ SỐ CHỮ HÁN (bỏ dấu câu / khoảng trắng).
   Trước đây nhiều chỗ dùng thẳng hanCharSyllables() — mảng đánh theo VỊ TRÍ
   TRONG CHUỖI GỐC (có dấu câu) — rồi lại lập chỉ số bằng "số chữ đã gõ"
   (chỉ tính chữ Hán). Câu có dấu câu → sáng nhầm chữ / tô đỏ nhầm chữ. */

/* ★ Danh sách ÂM TIẾT theo CHỈ SỐ CHỮ HÁN (bỏ dấu câu / khoảng trắng).
   Trước đây nhiều chỗ dùng thẳng hanCharSyllables() — mảng đánh theo VỊ TRÍ
   TRONG CHUỖI GỐC (có dấu câu) — rồi lại lập chỉ số bằng "số chữ đã gõ"
   (chỉ tính chữ Hán). Câu có dấu câu → sáng nhầm chữ / tô đỏ nhầm chữ. */
export function hanSyllableList(q, expLen) {
  const map = hanCharSyllables(q),
    src = String(q.zh || '');
  let out = [];
  for (let i = 0; i < src.length && i < map.length; i++) if (isHanChar(src[i])) out.push(map[i]);
  if (expLen && out.length !== expLen) {
    /* dữ liệu lạ (pinyin lệch số âm tiết) → phân bổ theo tỉ lệ để khỏi lệch */
    const total = answerWords(q).marked.length;
    out = Array.from({
      length: expLen
    }, (_, i) => Math.min(Math.max(0, Math.round(i * total / expLen)), Math.max(0, total - 1)));
  }
  return out;
}
/* HTML đáp án — chữ gõ sai / gõ thiếu tô đỏ */

/* HTML đáp án — chữ gõ sai / gõ thiếu tô đỏ */
export function hanziDiffHtml(res) {
  return res.map(r => '<span class="' + (r.ok ? '' : 'wBad') + '">' + escapeHtml(r.exp || r.got || '?') + '</span>').join('');
}
/* gotLen = số chữ người dùng ĐÃ gõ (khi đang gõ dở, res dài hơn got) */

/* gotLen = số chữ người dùng ĐÃ gõ (khi đang gõ dở, res dài hơn got) */
export function describeHanziGrade(res, gotLen) {
  const n = gotLen != null ? gotLen : res.length;
  const bad = res.slice(0, n).filter(r => !r.ok).length;
  if (!n) return 'Bạn chưa gõ chữ Hán nào.';
  if (bad) return 'Gõ sai ' + bad + '/' + n + ' chữ (chữ đỏ bên dưới).';
  return 'Gõ đúng ' + n + ' chữ — gõ tiếp…';
}
/* ★ Ghi thống kê điểm yếu theo ÂM TIẾT: đúng → mọi âm tiết +1 ok;
   sai → những âm tiết ứng với chữ gõ sai +1 wrong. */

/* ★ Ghi thống kê điểm yếu theo ÂM TIẾT: đúng → mọi âm tiết +1 ok;
   sai → những âm tiết ứng với chữ gõ sai +1 wrong. */
export function recordHanziGrade(q, res, ok) {
  const w = answerWords(q);
  if (ok) {
    for (const p of w.plain) weakInc(p, true);
    saveWeak();
    return;
  }
  const map = hanSyllableList(q, hanziAnswer(q).length),
    bad = new Set();
  res.forEach((r, i) => {
    if (!r.ok && map[i] >= 0 && w.plain[map[i]]) bad.add(map[i]);
  });
  for (const s of bad) weakInc(w.plain[s], false);
  saveWeak();
}
/* ═══════════════════════════════════════════════════════════
   ★ TỰ CHẤM KHI GÕ — gõ trực tiếp CHỮ HÁN của cả câu
   · Gõ đủ + đúng cả câu → báo ✓ Đúng → nhấn SPACE sang câu tiếp theo.
   · Có chữ sai / thiếu / thừa → báo đỏ ngay, KHÔNG cho sang câu —
     phải sửa đúng tại chỗ (hoặc bấm "Bỏ qua").
   · ENTER = ẩn/hiện gợi ý PINYIN phía trên dòng chữ Hán.
   ═══════════════════════════════════════════════════════════ */
/* ── Gõ tự do: tự chấm ngay khi gõ (không còn bước nhấn Enter kiểm tra) ── */
/* ★ CHẶN KÝ TỰ SAI NGAY KHI GÕ: chỉ nhận đúng chữ kế tiếp của đáp án.
   Sai → ký tự KHÔNG vào ô gõ (không hiện, không báo đỏ rắc rối).
   Trả về true nếu đã có ký tự bị chặn. */
/* ★ CHẶN KÝ TỰ SAI NGAY KHI GÕ: chỉ nhận đúng chuỗi chữ Hán của đáp án.
   Trước đây hàm này đếm "số chữ Hán" rồi thoát sớm khi không có chữ Hán nào
   (`if(!got.length)return false`) → gõ chữ Latin/số (vd "sdasdasd") KHÔNG bị
   chặn, chữ rác vẫn vào ô. Nay so từng ký tự với đáp án nên MỌI ký tự lạ
   đều bị loại, chỉ chữ Hán đúng thứ tự mới được nhập.
   Trả về true nếu đã có ký tự bị chặn. */

/* ═══════════════════════════════════════════════════════════
   ★ TỰ CHẤM KHI GÕ — gõ trực tiếp CHỮ HÁN của cả câu
   · Gõ đủ + đúng cả câu → báo ✓ Đúng → nhấn SPACE sang câu tiếp theo.
   · Có chữ sai / thiếu / thừa → báo đỏ ngay, KHÔNG cho sang câu —
     phải sửa đúng tại chỗ (hoặc bấm "Bỏ qua").
   · ENTER = ẩn/hiện gợi ý PINYIN phía trên dòng chữ Hán.
   ═══════════════════════════════════════════════════════════ */
/* ── Gõ tự do: tự chấm ngay khi gõ (không còn bước nhấn Enter kiểm tra) ── */
/* ★ CHẶN KÝ TỰ SAI NGAY KHI GÕ: chỉ nhận đúng chữ kế tiếp của đáp án.
   Sai → ký tự KHÔNG vào ô gõ (không hiện, không báo đỏ rắc rối).
   Trả về true nếu đã có ký tự bị chặn. */
/* ★ CHẶN KÝ TỰ SAI NGAY KHI GÕ: chỉ nhận đúng chuỗi chữ Hán của đáp án.
   Trước đây hàm này đếm "số chữ Hán" rồi thoát sớm khi không có chữ Hán nào
   (`if(!got.length)return false`) → gõ chữ Latin/số (vd "sdasdasd") KHÔNG bị
   chặn, chữ rác vẫn vào ô. Nay so từng ký tự với đáp án nên MỌI ký tự lạ
   đều bị loại, chỉ chữ Hán đúng thứ tự mới được nhập.
   Trả về true nếu đã có ký tự bị chặn. */
export function hanziFilterInput() {
  if (typingSessionState.composing || typingSessionState.awaitingEnter) return false;
  const inp = domState.$('pinyinInput');
  const raw = inp.value;
  if (!raw) return false;
  const q = currentRow(); // ★ luôn lấy đúng câu đang hiển thị
  if (!q) return false;
  const tgt = Array.from(String(q.zh || ''));
  if (!tgt.length) return false;
  const exp = hanChars(q.zh); // các chữ Hán phải gõ, đúng thứ tự
  const chars = Array.from(raw);
  /* ★ CHỈ NHẬN TIỀN TỐ ĐÚNG (strict prefix).
     Bản cũ khớp kiểu "dãy con có thứ tự": gõ 东 khi câu là "我家在东边" vẫn được
     nhận (vì 东 có trong đáp án) → ô gõ chứa chuỗi lệch vị trí, chấm điểm báo sai
     nhưng người dùng không hiểu vì sao, và càng gõ càng lệch. Nay mỗi ký tự chỉ
     được nhận khi nó ĐÚNG LÀ ký tự kế tiếp của đáp án; ký tự sai bị loại ngay
     (chỉ loại riêng ký tự đó, phần đã gõ đúng phía trước giữ nguyên).
     Dấu câu do hanziAutoPunct tự chèn cũng được kiểm tra theo đúng vị trí. */
  let pi = 0,
    hi = 0,
    kept = '';
  for (const ch of chars) {
    if (isHanChar(ch)) {
      if (hi < exp.length && ch === exp[hi]) {
        kept += ch;
        hi++;
        while (pi < tgt.length && tgt[pi] !== ch) pi++;
        pi++;
      }
      /* chữ Hán sai vị trí → bỏ, không ảnh hưởng phần đã gõ đúng */
    } else {
      /* dấu câu / khoảng trắng: chỉ nhận khi đúng là ký tự kế tiếp trong đáp án */
      if (pi < tgt.length && tgt[pi] === ch) {
        kept += ch;
        pi++;
      }
    }
  }
  if (kept === raw) return false; // đang gõ đúng → không can thiệp
  inp.value = kept;
  try {
    inp.setSelectionRange(kept.length, kept.length);
  } catch (e) {}
  typingSessionState.lastValidInput = kept;
  /* ★ Hiệu ứng lỗi: rung ô gõ + viền đỏ để biết vừa gõ sai,
     nhưng ký tự sai KHÔNG vào ô (phần đã gõ đúng được giữ nguyên). */
  hanziInputShake();
  inp.classList.remove('ok');
  inp.classList.add('bad');
  const next = exp[hi] || '';
  domState.$('feedback').className = 'feedback bad';
  domState.$('feedback').innerHTML = '✗ Chỉ nhận <b>chữ Hán</b> của câu' + (next ? ' — chữ tiếp theo cần gõ: <b class="wBad">' + escapeHtml(next) + '</b>' : '') + '<br/><span style="opacity:.75">Nếu không gõ được chữ Hán, hãy chuyển bàn phím sang <b>tiếng Trung (IME)</b>.</span>';
  return true;
}
/* ★ DẤU CÂU TỰ NẢY ("tôi sẽ không gõ dấu, dấu sẽ tự nảy ra"):
   gõ xong các chữ Hán ngay trước dấu câu trong đáp án → tự thêm dấu đó vào
   ô gõ. Dấu ở CUỐI câu cũng tự nảy khi gõ xong chữ cuối. */

/* ★ DẤU CÂU TỰ NẢY ("tôi sẽ không gõ dấu, dấu sẽ tự nảy ra"):
   gõ xong các chữ Hán ngay trước dấu câu trong đáp án → tự thêm dấu đó vào
   ô gõ. Dấu ở CUỐI câu cũng tự nảy khi gõ xong chữ cuối. */
export function hanziAutoPunct() {
  if (typingSessionState.composing || typingSessionState.awaitingEnter) return;
  const inp = domState.$('pinyinInput'),
    q = currentRow();
  if (!q) return;
  const src = Array.from(String(q.zh || ''));
  const typed = hanChars(inp.value).length;
  if (!typed) return;
  /* ★ Dựng lại ĐÚNG tiền tố của đáp án ứng với số chữ Hán đã gõ.
     Cách cũ chỉ NỐI THÊM dấu ở cuối nên: (1) dấu câu ĐẦU câu (「你好」) không
     bao giờ hiện, (2) nếu ô gõ bị lệch, dấu bị nhồi sai chỗ. Nay lấy nguyên
     tiền tố trong đáp án → dấu tự nảy đúng vị trí, kể cả dấu mở đầu câu. */
  let seen = 0,
    i = 0;
  while (i < src.length && seen < typed) {
    if (isHanChar(src[i])) seen++;
    i++;
  }
  /* ★ Gộp luôn CỤM DẤU CÂU ngay sau chữ Hán vừa gõ ("谢谢" → "谢谢！",
     "你好，世界" → "你好，"). Không có bước này thì dấu ở CUỐI câu không bao
     giờ tự nảy và người dùng phải tự gõ dấu — trái với thiết kế. */
  let j = i;
  while (j < src.length && !isHanChar(src[j])) j++;
  const prefix = src.slice(0, i).join('') + src.slice(i, j).join('');
  if (prefix && prefix !== inp.value) {
    inp.value = prefix;
    try {
      inp.setSelectionRange(prefix.length, prefix.length);
    } catch (e) {}
  }
}

export function handleAutoTyping() {
  if (typingSessionState.composing || typingSessionState.index >= typingSessionState.order.length || typingSessionState.awaitingEnter) return;
  const inp = domState.$('pinyinInput');
  /* ★ Gõ sai → KHÔNG cho nhập: chỉ chữ đúng mới xuất hiện trong ô gõ,
     nhưng CÓ hiệu ứng lỗi rung/đỏ để người dùng biết mình gõ sai. */
  const blocked = hanziFilterInput();
  if (blocked) {
    /* ★ Vẫn tính đây là "câu gõ sai" (mỗi câu chỉ tính 1 lần nhờ curHadError)
       — nếu không, vì ký tự sai bị chặn nên bộ đếm Sai/điểm yếu sẽ mãi = 0
       và câu này không được đưa vào danh sách cần ôn. */
    markSentenceWrong();
    updateChineseHighlight();
    return; // hanziFilterInput() đã tự hiện hiệu ứng lỗi + rung ô gõ
  }
  /* ★ Dấu câu tự nảy (không bắt người dùng gõ dấu) */
  hanziAutoPunct();
  typingSessionState.lastValidInput = inp.value;
  inp.classList.remove('bad');
  /* Gõ đúng trở lại → dọn thông báo lỗi cũ cho gọn màn hình */
  const fb = domState.$('feedback');
  if (fb && fb.classList.contains('bad') && !typingSessionState.awaitingEnter) {
    fb.className = 'feedback hidden';
    fb.innerHTML = '';
  }
  updateChineseHighlight(); // sáng từ đang gõ trên dòng chữ Hán
  /* ★ gõ ĐỦ + ĐÚNG cả câu → TỰ báo Đúng */
  const q = currentRow();
  if (!q) return;
  const exp = hanziAnswer(q),
    got = hanChars(inp.value);
  if (!got.length) return;
  /* ★ Đọc chữ vừa gõ (nếu đang bật). Gọi TRƯỚC checkSentence vì hàm đó khoá
     ô gõ (readOnly) khi gõ đủ cả câu — gọi sau sẽ không đọc được chữ cuối.
     isComplete = đã gõ đủ số chữ của đáp án → nối thêm tiếng đọc cả câu. */
  speakTypedProgress(got.length >= exp.length);
  const bad = got.some((c, i) => c !== exp[i]);
  if (bad || got.length === exp.length) checkSentence(false);
}

/* ★ Tạo bộ ôn điểm yếu: quét câu chứa các âm tiết hay gõ sai → tạo bộ luyện riêng */

/* ★ Tạo bộ ôn điểm yếu: quét câu chứa các âm tiết hay gõ sai → tạo bộ luyện riêng */
export async function buildWeakDataset() {
  const weak = topWeakWords(30);
  if (!weak.length) {
    toast('Chưa đủ dữ liệu điểm yếu — hãy luyện gõ thêm đã.', 'warn', 3400);
    return;
  }
  const weakSet = new Set(weak.map(x => x.w));
  const source = typingSessionState.rows && typingSessionState.rows.length ? typingSessionState.rows : Object.keys(dataCatalogState.HSK_DATA).flatMap(k => (dataCatalogState.HSK_DATA[k] || []).map(x => ({
    id: 0,
    zh: x[0],
    py: x[1],
    vi: x[2]
  })));
  const found = [],
    seen = new Set();
  for (const r of source) {
    if (found.length >= 120) break;
    const plain = answerWords(r).plain.map(w => String(w).replace(/[^a-züv]/g, ''));
    if (!plain.some(w => weakSet.has(w))) continue;
    const key = r.zh + '|' + r.py;
    if (seen.has(key)) continue;
    seen.add(key);
    found.push({
      id: found.length,
      vi: r.vi,
      py: r.py,
      zh: r.zh,
      wv: []
    });
  }
  if (!found.length) {
    toast('Không tìm thấy câu nào chứa từ yếu trong bộ hiện tại.', 'warn', 3400);
    return;
  }
  const id = 'weak:' + Date.now();
  const ds = {
    id,
    name: '🎯 Ôn từ yếu (' + found.length + ' câu)',
    sourceName: 'Thống kê điểm yếu',
    rows: found,
    createdAt: Date.now(),
    updatedAt: Date.now()
  };
  await dbPut(ds);
  toast('Đã tạo bộ ôn ' + found.length + ' câu chứa ' + weak.length + ' âm tiết hay sai.', 'ok', 4200);
  await openDataset(id);
}

/* ═══════════════════════════════════════════════════════════
   ★ KIỂM TRA (TỰ ĐỘNG khi gõ — không còn bước nhấn Enter):
   - ĐÚNG  → markSentenceCorrect() (báo ✓, đọc lại câu, ghi "Đã làm").
   - SAI   → KHÔNG cho sang câu: tô đỏ chữ sai, giữ nguyên ô gõ, phải sửa
             cho đúng (hoặc bấm "Bỏ qua" để xem đáp án rồi đi tiếp).
   ═══════════════════════════════════════════════════════════ */

/* ═══════════════════════════════════════════════════════════
   ★ KIỂM TRA (TỰ ĐỘNG khi gõ — không còn bước nhấn Enter):
   - ĐÚNG  → markSentenceCorrect() (báo ✓, đọc lại câu, ghi "Đã làm").
   - SAI   → KHÔNG cho sang câu: tô đỏ chữ sai, giữ nguyên ô gõ, phải sửa
             cho đúng (hoặc bấm "Bỏ qua" để xem đáp án rồi đi tiếp).
   ═══════════════════════════════════════════════════════════ */
export function checkSentence(manual) {
  if (typingSessionState.awaitingEnter) return;
  const inp = domState.$('pinyinInput'),
    q = currentRow();
  if (!q) return;
  const raw = inp.value;
  /* ★ Giữ mốc thời gian của câu qua các lần gõ sai — chỉ chốt khi gõ ĐÚNG
     (nếu xoá ở lần sai thì lần sửa đúng sẽ mất mốc → không đo được CPM). */
  const startedAt = typingSessionState.sentStartTs;
  const {
    res,
    exp,
    got
  } = gradeHanzi(raw, q);
  const ok = !!got.length && exp.length === got.length && res.every(r => r.ok);
  if (ok) {
    speedRecord(got.length, startedAt ? Date.now() - startedAt : 0);
    typingSessionState.sentStartTs = 0;
    typingSessionState.hanWrongSig = '';
    recordHanziGrade(q, res, true);
    markSentenceCorrect();
    return;
  }
  if (!got.length) return; // chưa gõ gì → im lặng chờ
  markSentenceWrong();
  const sig = 'hz:' + q.id + ':' + res.map(r => r.ok ? 1 : 0).join('');
  if (typingSessionState.hanWrongSig !== sig) {
    typingSessionState.hanWrongSig = sig;
    recordHanziGrade(q, res, false);
  }
  /* ★ Sai là phải sửa ngay tại ô gõ — gõ đúng cả câu mới được sang câu */
  domState.$('feedback').className = 'feedback bad';
  domState.$('feedback').innerHTML = '✗ ' + escapeHtml(describeHanziGrade(res, got.length)) + ' Đáp án: ' + hanziDiffHtml(res) + '<br/>Sửa theo chữ <b class="wBad">đỏ</b> — gõ đúng cả câu là TỰ báo Đúng (hoặc bấm <b>“Bỏ qua”</b>).';
  inp.classList.remove('ok');
  inp.classList.add('bad');
  markWrongChineseWords(q, res);
  save();
  renderStatsOnly();
  updateChineseHighlight();
}
/* Tô đỏ những chữ Hán tương ứng với vị trí gõ sai (hiển thị trên dòng chữ Hán).
   ★ Trước đây `tone:true` được hard-code khiến class .wTone (báo SAI THANH, màu
   vàng) KHÔNG BAO GIỜ được gán → các âm tiết có dấu thanh không đổi màu khi gõ.
   Nay dùng bảng điểm đã chấm: base = chữ Hán đúng, tone = dấu thanh đúng. */

/* Tô đỏ những chữ Hán tương ứng với vị trí gõ sai (hiển thị trên dòng chữ Hán).
   ★ Trước đây `tone:true` được hard-code khiến class .wTone (báo SAI THANH, màu
   vàng) KHÔNG BAO GIỜ được gán → các âm tiết có dấu thanh không đổi màu khi gõ.
   Nay dùng bảng điểm đã chấm: base = chữ Hán đúng, tone = dấu thanh đúng. */
export function markWrongChineseWords(q, res) {
  const w = answerWords(q);
  const g = w.marked.map(() => ({
    base: true,
    tone: true
  }));
  const map = hanSyllableList(q, hanziAnswer(q).length);
  /* 1) chữ Hán gõ sai → base sai (đỏ) */
  res.forEach((r, i) => {
    const s = map[i];
    if (s == null || s < 0) return;
    const got = Array.from(String(r.got || '')).filter(isHanChar).join('');
    if (got && got === r.exp) g[s].tone = false; // chữ đúng, hợp lệ chỉ sai ở mức thanh
    else g[s].base = false; // chữ khác → sai hoàn toàn
  });
  /* 2) thanh pinyin gõ sai (chỉ khi người dùng gõ pinyin có dấu) → tone sai (vàng) */
  const typedPy = typedToneSignals();
  if (typedPy) applyTypedToneMarks(q, g, typedPy);
  renderChineseWords(q, g);
}
/* ★ Thu thập "dấu thanh người gõ" từ nội dung ô gõ.
   Khi gõ CHỮ HÁN bằng IME tiếng Trung, ô gõ không chứa pinyin nên không có
   tín hiệu thanh nào → trả null (không tô vàng, không tô nhầm).
   Khi gõ pinyin (bàn phím ảo / ô gõ pinyin), các âm tiết có dấu sẽ ra tín hiệu. */

/* ★ Thu thập "dấu thanh người gõ" từ nội dung ô gõ.
   Khi gõ CHỮ HÁN bằng IME tiếng Trung, ô gõ không chứa pinyin nên không có
   tín hiệu thanh nào → trả null (không tô vàng, không tô nhầm).
   Khi gõ pinyin (bàn phím ảo / ô gõ pinyin), các âm tiết có dấu sẽ ra tín hiệu. */
export function typedToneSignals() {
  const raw = domState.$('pinyinInput').value || '';
  if (!/[āáǎàēéěèōóǒòīíǐìūúǔùǖǘǚǜ]/.test(raw)) return null;
  return raw;
}
/* So dấu thanh của các âm tiết người gõ với đáp án → tô vàng .wTone */

/* So dấu thanh của các âm tiết người gõ với đáp án → tô vàng .wTone */
export function applyTypedToneMarks(q, g, raw) {
  const w = answerWords(q);
  const typed = normalize(raw).split(/\s+/).filter(Boolean);
  let i = 0;
  for (const exp of w.plain) {
    if (i >= typed.length) break;
    const got = typed[i++];
    if (!exp || !got) continue;
    const ge = stripToneMarks(exp).tones[0] || 0;
    const gt = stripToneMarks(got).tones[0] || 0;
    /* chỉ tô vàng khi CÙNG âm tiết (bỏ dấu khớp) nhưng THANH khác */
    if (stripToneMarks(exp).plain === stripToneMarks(got).plain && ge !== gt && i - 1 < g.length) g[i - 1].tone = false;
  }
}

/* ★ "Lưới an toàn" cho phím Space: ô gõ đã chứa ĐÚNG toàn bộ chữ Hán của mục
   đang hiện chưa? Dùng khi awaitingEnter chưa kịp bật (IME vừa chốt chữ bằng
   Space, AI vừa chèn mục mới, màn hình vừa render lại…) — để cú bấm Space
   không bị nuốt mất. */

/* ★ "Lưới an toàn" cho phím Space: ô gõ đã chứa ĐÚNG toàn bộ chữ Hán của mục
   đang hiện chưa? Dùng khi awaitingEnter chưa kịp bật (IME vừa chốt chữ bằng
   Space, AI vừa chèn mục mới, màn hình vừa render lại…) — để cú bấm Space
   không bị nuốt mất. */
export function hanziComplete() {
  const q = currentRow();
  if (!q) return false;
  const inp = domState.$('pinyinInput');
  if (!inp) return false;
  const exp = hanziAnswer(q),
    got = hanChars(inp.value);
  return !!got.length && got.length === exp.length && got.every((c, i) => c === exp[i]);
}

export function goNextAfterCorrect() {
  if (!typingSessionState.awaitingEnter) return;
  typingSessionState.awaitingEnter = false;
  domState.$('pinyinInput').readOnly = false;
  /* Hết danh sách → vẫn phải render() để hiện màn "đang chờ AI viết tiếp" /
     "hoàn thành", tránh kẹt ở mục cuối mà bấm Space không có phản ứng gì. */
  if (typingSessionState.index < typingSessionState.order.length) typingSessionState.index++;
  save();
  render();
}
/* ═══════════════════════════════════════════════════════════
   ★ QUAY LẠI CÂU TRƯỚC — nút "◀ Câu trước" + phím Backspace khi đã gõ đúng.
   Hoàn tác đúng phần thống kê đã cộng cho câu vừa rời đi, nếu không quay lại
   làm lại sẽ bị cộng điểm 2 lần (Đúng/Sai lệch).
   · Câu trước đã gõ ĐÚNG  → trừ 1 Đúng (làm lại đúng sẽ cộng lại → net 0).
   · Câu trước đã gõ SAI   → đánh dấu curHadError để KHÔNG tính Sai lần nữa.
   ═══════════════════════════════════════════════════════════ */

/* ═══════════════════════════════════════════════════════════
   ★ QUAY LẠI CÂU TRƯỚC — nút "◀ Câu trước" + phím Backspace khi đã gõ đúng.
   Hoàn tác đúng phần thống kê đã cộng cho câu vừa rời đi, nếu không quay lại
   làm lại sẽ bị cộng điểm 2 lần (Đúng/Sai lệch).
   · Câu trước đã gõ ĐÚNG  → trừ 1 Đúng (làm lại đúng sẽ cộng lại → net 0).
   · Câu trước đã gõ SAI   → đánh dấu curHadError để KHÔNG tính Sai lần nữa.
   ═══════════════════════════════════════════════════════════ */
export function goPrevSentence() {
  if (typingSessionState.index <= 0) return;
  typingSessionState.index--;
  typingSessionState.awaitingEnter = false;
  typingSessionState.hanWrongSig = '';
  typingSessionState.sentStartTs = Date.now();
  const prevQ = typingSessionState.rows[typingSessionState.order[typingSessionState.index]];
  typingSessionState.curHadError = false;
  if (prevQ && typeof typingHistoryState.typingHistory !== 'undefined') {
    const rec = typingHistoryState.typingHistory.find(r => r.id === prevQ.id);
    if (rec) {
      if (rec.status === 'ok') {
        typingSessionState.stats.correct = Math.max(0, typingSessionState.stats.correct - 1);
        typingSessionState.stats.combo = 0;
      } else {
        /* đã từng tính Sai cho câu này → giữ nguyên, đừng cộng lặp */
        typingSessionState.curHadError = true;
      }
    }
    if (typingSessionState.mode === 'wrong' && prevQ) typingSessionState.wrongIds.delete(prevQ.id);
  }
  const inp = domState.$('pinyinInput');
  inp.readOnly = false;
  inp.classList.remove('ok', 'bad');
  const fb = domState.$('feedback');
  if (fb) {
    fb.className = 'feedback hidden';
    fb.innerHTML = '';
  }
  save();
  render();
  setTimeout(() => inp.focus(), 60);
}

/* ── Speech Synthesis ── */

export function initializeTypingInput() {
  /* ═══════════════════════════════════════════════════════════
     ★ TỰ CHẤM KHI GÕ — gõ trực tiếp CHỮ HÁN của cả câu
     · Gõ đủ + đúng cả câu → báo ✓ Đúng → nhấn SPACE sang câu tiếp theo.
     · Có chữ sai / thiếu / thừa → báo đỏ ngay, KHÔNG cho sang câu —
       phải sửa đúng tại chỗ (hoặc bấm "Bỏ qua").
     · Dấu câu và khoảng trắng không bắt buộc — bỏ qua khi so khớp.
     · ENTER = ẩn/hiện gợi ý PINYIN phía trên dòng chữ Hán.
     ═══════════════════════════════════════════════════════════ */
  /* ★ Chữ Hán = CHỮ HÁN THẬT (CJK ideograph) — khoảng trắng, dấu câu Trung,
     chữ Latin/số đều KHÔNG phải chữ Hán cần gõ.
     Trước đây app chỉ "loại trừ dấu câu" nên chữ cái Latin ('n','a' lúc đang gõ
     IME tiếng Trung của máy) bị coi là chữ Hán → bộ lọc "gõ sai không nhận" xoá
     mất, người dùng KHÔNG THỂ GÕ ĐƯỢC chữ nào (lỗi ảnh chụp vòng 21). */
  typingInputState.HAN_CHAR_RE = /[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff\u{20000}-\u{3ffff}]/u;
}
