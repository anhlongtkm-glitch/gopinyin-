// State and behavior owned by shared/language/hanzi. Initialization is orchestrated by app/bootstrap.js.

import { state as dataCatalogState } from "../../data/catalog.js";

import { answerWords, updateChineseHighlight } from "../../features/typing/answers.js";

import { alignPinyinToHanzi, isHanCharacter } from "./alignment.js";

import { state as domState } from "../dom.js";


import { openGoogleTranslate } from "../translation.js";

/* ── Chinese Word Rendering ── */
/* ★ Bộ tách từ tiếng Hán (maximal matching trên từ điển HSK 3.0).
   Mục đích: nhóm các chữ thuộc CÙNG MỘT TỪ lại với nhau (vd 听见, 你的…)
   để hiển thị chữ trong cùng từ sát nhau, còn giữa các TỪ có khe rộng hơn. */
/* Bộ tách từ tiếng Hán bằng VITERBI có trọng số tần suất.
   → Sửa lỗi greedy maximal-matching chọn nhầm từ dài hiếm (vd "有时" thay vì "时间").
   Với mỗi vị trí, tính chi phí = log(hạng tần suất); chọn đường có tổng chi phí nhỏ nhất. */
export function hanziSegCost(w) {
  const rank = dataCatalogState.HANZI_WORDS.get(w);
  if (rank != null) return Math.log(rank + 1);
  return w.length === 1 ? Math.log(12000) : Math.log(90000); /* không có trong từ điển → phạt */
}

export function hanziSegAllowed(w) {
  return w.length === 1 || dataCatalogState.HANZI_WORDS.has(w);
}
/* Tách một chuỗi toàn chữ Hán thành mảng các TỪ (Viterbi, tối đa 4 chữ/từ) */

/* Tách một chuỗi toàn chữ Hán thành mảng các TỪ (Viterbi, tối đa 4 chữ/từ) */
export function hanziSegment(text) {
  const chars = Array.from(text),
    n = chars.length;
  if (!n) return [];
  const best = new Array(n + 1).fill(Infinity),
    back = new Array(n + 1).fill(null);
  best[0] = 0;
  for (let i = 0; i < n; i++) {
    if (best[i] === Infinity) continue;
    for (let L = 1; L <= 4 && i + L <= n; L++) {
      const w = chars.slice(i, i + L).join('');
      if (!hanziSegAllowed(w)) continue;
      const c = best[i] + hanziSegCost(w);
      if (c < best[i + L]) {
        best[i + L] = c;
        back[i + L] = L;
      }
    }
  }
  const out = [];
  let p = n;
  while (p > 0) {
    const L = back[p];
    if (!L) {
      /* fallback an toàn: lùi 1 ký tự */
      out.unshift(chars[p - 1]);
      p -= 1;
      continue;
    }
    out.unshift(chars.slice(p - L, p).join(''));
    p -= L;
  }
  return out;
}

export function splitChineseByPinyin(q) {
  const text = String(q.zh || '');
  if (!text) return [];
  const {map} = alignPinyinToHanzi(text,answerWords(q).marked);
  const chunks = text.matchAll(/[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff\u{20000}-\u{3ffff}]+|[A-Za-z0-9]+|[^\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff\u{20000}-\u{3ffff}A-Za-z0-9]+/gu);
  const out = [];
  for (const chunk of chunks) {
    const words = isHanCharacter(chunk[0]) ? hanziSegment(chunk[0]) : [chunk[0]];
    let offset = chunk.index;
    for (const word of words) {
      const end = offset + word.length;
      const indices = map.slice(offset,end).filter(index=>index>=0);
      const part = {text:word,charStart:offset,charEnd:end,wordIndex:indices.length?Math.min(...indices):-1,wordEnd:indices.length?Math.max(...indices):-1,punct:!isHanCharacter(word)&&!/[A-Za-z0-9]/.test(word)};
      const previous = out.at(-1);
      // A dictionary boundary may split a suffix from its base. Keep its single
      // Pinyin guide together even when the base belongs to a longer word.
      if (previous && !previous.punct && !part.punct && part.wordIndex>=0 && part.wordIndex<=previous.wordEnd && previous.charEnd===part.charStart) {
        previous.text += part.text; previous.charEnd=end; previous.wordEnd=Math.max(previous.wordEnd,part.wordEnd);
      } else out.push(part);
      offset=end;
    }
  }
  return out;
}

export function renderChineseWords(q, gradeRes) {
  const el = domState.$('chinese');
  el.innerHTML = '';
  const marked = answerWords(q).marked;
  let charCursor = 0;
  splitChineseByPinyin(q).forEach(part => {
    if (!part.punct && (part.wordIndex >= 0 || isHanCharacter(part.text))) {
      const pair = document.createElement('span');
      pair.className = 'hanzi-pair';
      pair.dataset.wordIndex = part.wordIndex;
      pair.dataset.wordEnd = part.wordEnd != null ? part.wordEnd : part.wordIndex;
      /* ★ Tô đỏ âm tiết gõ SAI, vàng âm tiết sai THANH (sau khi chấm điểm) */
      if (gradeRes && gradeRes[part.wordIndex]) {
        const g = gradeRes[part.wordIndex];
        if (!g.base) pair.classList.add('wBad');else if (!g.tone) pair.classList.add('wTone');
      }
      pair.dataset.charStart = charCursor;
      charCursor += part.text.length;
      pair.dataset.charEnd = charCursor;
      /* Nếu nhóm gộp nhiều token pinyin → hiển thị pinyin của từng âm tiết trong từ đó */
      const pyTexts = [];
      for (let k = part.wordIndex; k <= (part.wordEnd != null ? part.wordEnd : part.wordIndex); k++) pyTexts.push(marked[k] || '');
      const py = document.createElement('span');
      py.className = 'pinyin-guide';
      py.textContent = pyTexts.join(' ');
      const hz = document.createElement('span');
      hz.className = 'hanzi-word';
      /* Chữ trong cùng từ: giữ sát nhau, không thêm khe */
      hz.textContent = part.text;
      pair.append(py, hz);
      el.appendChild(pair);
      // ★ Click để mở bubble Google Dịch phía trên chữ Hán đó (kiểu chatbox nhỏ)
      // Với nhóm nhiều âm tiết, truyền cả khoảng wordIndex để lấy đúng pinyin/nghĩa
      const wEnd = part.wordEnd != null ? part.wordEnd : part.wordIndex;
      pair.addEventListener('click', e => {
        e.stopPropagation();
        openGoogleTranslate(part.text, part.wordIndex, pair, wEnd);
      });
      pair.setAttribute('tabindex', '0');
      pair.setAttribute('role', 'button');
      pair.setAttribute('aria-label', 'Xem nghĩa của ' + part.text);
      // ★ Bàn phím: Enter/Space cũng mở nghĩa (a11y)
      pair.addEventListener('keydown', e => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          e.stopPropagation();
          openGoogleTranslate(part.text, part.wordIndex, pair, wEnd);
        }
      });
    } else {
      const span = document.createElement('span');
      span.textContent = part.text;
      span.className = 'hanzi-punct';
      el.appendChild(span);
    }
  });
  if (q.py && !alignPinyinToHanzi(q.zh,marked).complete) {
    const phrase = document.createElement('span');
    phrase.className = 'pinyin-guide pinyin-unmapped';
    phrase.textContent = 'Phiên âm theo cụm: ' + marked.join(' ');
    el.appendChild(phrase);
  }
  updateChineseHighlight();
}
