// State and behavior owned by shared/language/hanzi. Initialization is orchestrated by app/bootstrap.js.

import { state as dataCatalogState } from "../../data/catalog.js";

import { answerWords, updateChineseHighlight } from "../../features/typing/answers.js";

import { countPinyinSyllables } from "../audio/tts.js";

import { state as domState } from "../dom.js";

import { normalize } from "./normalization.js";

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
  /* ★ Dùng answerWords để đã được tách sẵn âm tiết (sửa lỗi "xiāojí" viết liền) */
  const marked = answerWords(q).marked,
    text = String(q.zh || '');
  if (!text || text === '—' || !marked.length) return [{
    text: text || '—',
    wordIndex: -1,
    wordEnd: -1
  }];
  const units = [];
  for (let i = 0; i < text.length;) {
    const rest = text.slice(i),
      latin = rest.match(/^[A-Za-z0-9]+/);
    if (latin) {
      units.push({
        text: latin[0],
        start: i,
        end: i + latin[0].length
      });
      i += latin[0].length;
      continue;
    }
    const ch = text[i];
    if (/[\u3400-\u9fff]/.test(ch)) units.push({
      text: ch,
      start: i,
      end: i + 1
    });
    i++;
  }
  if (!units.length) return [{
    text,
    wordIndex: -1,
    wordEnd: -1
  }];
  /* Bước 1: chia theo token pinyin (mỗi token = 1 âm tiết, hoặc 1 từ latin) */
  const raw = [];
  let unitPos = 0,
    charPos = 0;
  /* ★ ĐẾM SỐ CHỮ HÁN để phát hiện pinyin lệch âm tiết.
     Gemini/AI đôi khi trả pinyin thiếu âm tiết do ERHUA (儿 hoá): "玩儿" → "wánr"
     (1 âm tiết cho 2 chữ). Nếu chia cứng theo số âm tiết thì chữ bị nhóm SAI.
     → Nếu độ lệch ĐÚNG BẰNG số chữ "儿" thì coi là erhua (bình thường, chấp nhận).
       Nếu lệch vì lý do khác → chia theo TỈ LỆ cho khớp. */
  const totalHan = units.filter(u => /[\u3400-\u9fff]/.test(u.text)).length;
  const erhuaCount = (text.match(/儿/g) || []).length;
  const unitSeq = []; // số âm tiết gán cho từng token pinyin
  {
    let up = 0;
    for (let i = 0; i < marked.length; i++) {
      const token = marked[i],
        next = units[up]?.text || '';
      let take = next && /[A-Za-z0-9]/.test(next) && normalize(next) === normalize(token) ? 1 : countPinyinSyllables(token);
      take = Math.max(1, take);
      unitSeq.push(take);
      up += take;
      if (up >= units.length) {
        for (let k = i + 1; k < marked.length; k++) unitSeq.push(countPinyinSyllables(marked[k]));
        break;
      }
    }
  }
  const totalPy = unitSeq.reduce((a, b) => a + b, 0);
  /* ★ ERHUA: âm tiết kết thúc bằng 'r' (wánr, huìr, nǎr) thực chất ứng với 2 chữ
     Hán (玩+儿). Vì vậy cần +1 slot cho mỗi token như vậy để tổng khớp số chữ Hán.
     Sau khi chia xong, chữ 儿 sẽ tự dính vào chữ trước khi tách từ. */
  const erhuaToks = marked.filter(t => /(?:[aeiouü]|[aeiouü]n|[aeiouü]ng)r$/i.test(normalize(t).replace(/[^a-zü]/g, ''))).length;
  if (erhuaToks > 0) {
    let added = 0;
    for (let i = 0; i < unitSeq.length && added < erhuaToks; i++) {
      const plain = normalize(marked[i]).replace(/[^a-zü]/g, '');
      if (/(?:[aeiouü]|[aeiouü]n|[aeiouü]ng)r$/.test(plain)) {
        unitSeq[i]++;
        added++;
      }
    }
  }
  const totalPy2 = unitSeq.reduce((a, b) => a + b, 0);
  if (totalHan > 0 && totalPy2 !== totalHan) {
    /* Phân bổ lại theo tỉ lệ (Bresenham) */
    const scaled = [];
    let acc = 0;
    for (let i = 0; i < unitSeq.length; i++) {
      acc += unitSeq[i];
      const target = Math.round(acc * totalHan / totalPy2);
      const prev = scaled.reduce((a, b) => a + b, 0);
      scaled.push(Math.max(1, target - prev));
    }
    let sum = scaled.reduce((a, b) => a + b, 0),
      guard = 0;
    let k = scaled.length - 1;
    while (sum !== totalHan && guard++ < 1000) {
      if (sum > totalHan) {
        if (scaled[k] > 1) {
          scaled[k]--;
          sum--;
        } else k--;
      } else {
        scaled[k]++;
        sum++;
      }
      if (k < 0) k = scaled.length - 1;
    }
    for (let i = 0; i < unitSeq.length; i++) unitSeq[i] = scaled[i] || 1;
  }
  /* Duyệt lại theo unitSeq đã căn chỉnh */
  unitPos = 0;
  charPos = 0;
  for (let i = 0; i < marked.length; i++) {
    const take = unitSeq[i] || 1;
    const nextUnit = units[unitPos + take],
      end = nextUnit ? nextUnit.start : text.length;
    raw.push({
      text: text.slice(charPos, end),
      charStart: charPos,
      charEnd: end,
      wordIndex: i
    });
    charPos = end;
    unitPos += take;
    if (unitPos >= units.length) break;
  }
  if (charPos < text.length && raw.length) raw[raw.length - 1].text += text.slice(charPos);
  /* ★ ERHUA: chữ "儿" trong zh đã được gộp vào âm tiết trước trong pinyin
     (玩儿 → wánr). Vì vậy raw[i] chứa "玩儿" nhưng pinyin token chỉ có "wánr".
     → Gộp raw[i] (chứa 儿 ở cuối) với raw[i-1] nếu cần, để chữ 儿 nằm cùng nhóm
       với chữ trước nó. Dùng erhuaCount đã tính để biết có bao nhiêu ca cần gộp. */
  if (erhuaCount > 0 && raw.length > 1) {
    for (let i = raw.length - 1; i > 0 && erhuaCount > 0; i--) {
      /* piece kết thúc bằng 儿 và độ dài >= 2 → chữ 儿 nằm cuối piece này */
      if (/儿$/.test(raw[i].text) && raw[i].text.length >= 2) {
        /* đã đúng nhóm (chữ trước + 儿 nằm cùng piece) → không cần gộp */
        continue;
      }
      /* case: raw[i] CHÍNH LÀ "儿" đứng riêng → gộp vào raw[i-1] */
      if (raw[i].text === '儿') {
        raw[i - 1].text += raw[i].text;
        raw[i - 1].charEnd = raw[i].charEnd;
        raw.splice(i, 1);
      }
    }
  }
  /* Bước 1.5: tách dấu câu ra khỏi chữ Hán (vd "起。" → "起" + "。") */
  const PUNCT = /[\u3000-\u303f\uff00-\uffef!?,.;:'"()\[\]{}<>\/\\|~`@#$%^&*\-_+=]/;
  const pieces = [];
  raw.forEach(r => {
    let head = r.text,
      tail = '';
    while (head.length > 1 && PUNCT.test(head[head.length - 1])) {
      tail = head[head.length - 1] + tail;
      head = head.slice(0, -1);
    }
    if (head) {
      pieces.push({
        text: head,
        charStart: r.charStart,
        charEnd: r.charStart + head.length,
        wordIndex: r.wordIndex
      });
      if (tail) pieces.push({
        text: tail,
        charStart: r.charStart + head.length,
        charEnd: r.charEnd,
        wordIndex: r.wordIndex,
        punct: true
      });
    } else {
      pieces.push({
        text: r.text,
        charStart: r.charStart,
        charEnd: r.charEnd,
        wordIndex: r.wordIndex,
        punct: true
      });
    }
  });
  /* Bước 2: TÁCH TỪ trên TOÀN BỘ chuỗi chữ Hán một lần (maximal matching),
     rồi ánh xạ từng TỪ về khoảng pinyin token tương ứng.
     → nhóm đúng cả từ 3-4 chữ (对不起, 没关系, 不好意思…). */
  const hanSeq = pieces.filter(p => !p.punct && /[\u3400-\u9fff]/.test(p.text)).map(p => p.text).join('');
  const wordList = hanziSegment(hanSeq);
  /* ánh xạ: duyệt pieces theo thứ tự, cắt dần theo từng TỪ trong wordList */
  const out = [];
  let ci = 0; // con trỏ trong pieces (bỏ qua punct)
  let wi = 0; // con trỏ trong wordList
  let consumed = 0; // số chữ Hán của từ hiện tại đã dùng
  let i = 0;
  while (i < pieces.length) {
    const part = pieces[i];
    if (part.punct) {
      out.push({
        text: part.text,
        charStart: part.charStart,
        charEnd: part.charEnd,
        wordIndex: part.wordIndex,
        wordEnd: part.wordIndex,
        punct: true
      });
      i++;
      continue;
    }
    /* ghép các piece chữ Hán liền kề cho đến khi đủ 1 TỪ */
    const target = wordList[wi] || '';
    const need = target.length;
    let acc = '',
      startIdx = i,
      lastWordIndex = part.wordIndex,
      cs = part.charStart,
      ce = part.charEnd;
    while (acc.length < need && i < pieces.length && !pieces[i].punct && /[\u3400-\u9fff]/.test(pieces[i].text)) {
      acc += pieces[i].text;
      lastWordIndex = pieces[i].wordIndex;
      ce = pieces[i].charEnd;
      i++;
    }
    if (acc.length > need) {
      /* vượt quá → cắt bớt, phần dư tách ra (trường hợp hiếm) */
      const extra = acc.slice(need);
      ce = ce - extra.length;
      /* tạo piece dư để xử lý tiếp */
      pieces.splice(i, 0, {
        text: extra,
        charStart: ce,
        charEnd: ce + extra.length,
        wordIndex: lastWordIndex
      });
      acc = acc.slice(0, need);
    }
    out.push({
      text: acc || part.text,
      charStart: cs,
      charEnd: ce,
      wordIndex: part.wordIndex,
      wordEnd: lastWordIndex
    });
    wi++;
    if (wi >= wordList.length) {
      /* còn piece thô (vd Latin) → đẩy nguyên */
      while (i < pieces.length) {
        const p = pieces[i];
        out.push({
          text: p.text,
          charStart: p.charStart,
          charEnd: p.charEnd,
          wordIndex: p.wordIndex,
          wordEnd: p.wordIndex,
          punct: !!p.punct
        });
        i++;
      }
      break;
    }
  }
  /* ★ GỘP ERHUA: một token pinyin có thể ứng với 2 CHỮ HÁN (diǎnr ↔ 点儿).
     Khi đó 2 piece liền kề được gán CÙNG wordIndex (vì cùng 1 âm tiết) → phải
     gộp lại thành 1 nhóm, nếu không pinyin sẽ hiện LẶP trên cả 2 chữ
     ("diǎn" hiện trên 点 VÀ trên 儿). */
  const merged = [];
  for (const p of out) {
    const last = merged[merged.length - 1];
    if (last && !last.punct && !p.punct && last.wordIndex === p.wordIndex && last.charEnd === p.charStart) {
      last.text += p.text;
      last.charEnd = p.charEnd;
    } else {
      merged.push(Object.assign({}, p));
    }
  }
  return merged;
}

export function renderChineseWords(q, gradeRes) {
  const el = domState.$('chinese');
  el.innerHTML = '';
  const marked = answerWords(q).marked;
  let charCursor = 0;
  splitChineseByPinyin(q).forEach(part => {
    if (part.wordIndex >= 0 && !part.punct) {
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
  updateChineseHighlight();
}
/* ★ Tách pinyin thành các ÂM TIẾT riêng — SỬA LỖI "xiāojí" bị lặp trên mọi chữ.
   AI (Gemini/OpenRouter) và một số file Excel ghi pinyin VIẾT LIỀN
   nhiều âm tiết trong 1 token ("xiāojí", "zhongguo2"). Nếu giữ nguyên:
     • mỗi chữ Hán đều nhận nguyên token → "消" và "极" đều hiện "xiāojí";
     • phần gõ pinyin cũng báo sai vì plain chỉ có 1 âm tiết thay vì 2.
   → Token nào chứa >1 âm tiết thì tách ra. fixPinyin xử lý cả số thanh lẫn
   dấu thanh, và countPinyinSyllables("wánr")=1 nên ERHUA được giữ nguyên. */
