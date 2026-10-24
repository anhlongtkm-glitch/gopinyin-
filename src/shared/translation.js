// State and behavior owned by shared/translation. Initialization is orchestrated by app/bootstrap.js.

import { answerWords } from "../features/typing/answers.js";

import { state as typingSessionState } from "../features/typing/session.js";

import { state as domState } from "./dom.js";

import { escapeHtml } from "./utils.js";

/* ═══════════════════════════════════════════════════════════
   ★ BUBBLE GOOGLE DỊCH (kiểu chatbox nhỏ, neo trên chữ Hán)
   ★ Khi bấm vào chữ Hán, hiện bubble nhỏ ngay phía trên
   ★ Tự tắt sau 5 giây, hoặc khi click chữ Hán khác
   ★ KHÔNG chặn gõ phím
   ★ Dùng MyMemory API (chính) + Google Translate (dự phòng)
   ★ Cache kết quả vào localStorage
   ═══════════════════════════════════════════════════════════ */
export function viCacheKey(text) {
  return 'cts:vi:' + text;
}

export function getCachedVi(text) {
  try {
    const d = localStorage.getItem(viCacheKey(text));
    if (d !== null) return JSON.parse(d);
  } catch {
    return null;
  }
}
// ★ Chỉ cache khi kết quả hợp lệ (không cache null)

// ★ Chỉ cache khi kết quả hợp lệ (không cache null)
export function setCachedVi(text, data) {
  if (!data) return;
  try {
    localStorage.setItem(viCacheKey(text), JSON.stringify(data));
  } catch {}
}

// ★ MyMemory API — ổn định hơn Google Translate khi gọi từ trình duyệt
// ★ Dịch nghĩa online — GỌI TRỰC TIẾP MyMemory qua HTTPS.
// ⚠ Đã BỎ 2 proxy công khai (allorigins / corsproxy) vì chúng NHÌN THẤY toàn bộ
//   nội dung câu người dùng đang học. Nay chỉ còn 1 kết nối trực tiếp tới MyMemory.

// ★ MyMemory API — ổn định hơn Google Translate khi gọi từ trình duyệt
// ★ Dịch nghĩa online — GỌI TRỰC TIẾP MyMemory qua HTTPS.
// ⚠ Đã BỎ 2 proxy công khai (allorigins / corsproxy) vì chúng NHÌN THẤY toàn bộ
//   nội dung câu người dùng đang học. Nay chỉ còn 1 kết nối trực tiếp tới MyMemory.
export async function fetchMyMemory(text) {
  const baseUrl = 'https://api.mymemory.translated.net/get?q=' + encodeURIComponent(text) + '&langpair=zh-CN|vi';
  const urls = [baseUrl];
  for (const url of urls) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 8000);
      const resp = await fetch(url, {
        signal: controller.signal
      });
      clearTimeout(timer);
      if (!resp.ok) continue;
      const data = await resp.json();
      if (data && data.responseData && data.responseData.translatedText) {
        let tr = data.responseData.translatedText;
        tr = tr.replace(/^(WARNING|MYMEMORY WARNING).*$/im, '').trim();
        if (tr && tr.length > 0) return tr;
      }
      if (data && data.matches && Array.isArray(data.matches)) {
        for (const m of data.matches) {
          if (m && m.translation && m.quality > 0) {
            return m.translation;
          }
        }
      }
    } catch (e) {
      continue;
    }
  }
  return null;
}

// ★ Google Translate API — dự phòng

// ★ Google Translate API — dự phòng
export async function fetchGoogleTranslate(text) {
  const baseUrl = 'https://translate.googleapis.com/translate_a/single?client=gtx&sl=zh-CN&tl=vi&dt=t&q=' + encodeURIComponent(text);
  const urls = [baseUrl, 'https://api.allorigins.win/raw?url=' + encodeURIComponent(baseUrl), 'https://corsproxy.io/?url=' + encodeURIComponent(baseUrl)];
  for (const url of urls) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 8000);
      const resp = await fetch(url, {
        signal: controller.signal
      });
      clearTimeout(timer);
      if (!resp.ok) continue;
      const data = await resp.json();
      if (Array.isArray(data) && Array.isArray(data[0])) {
        const translation = data[0].map(x => Array.isArray(x) ? x[0] : '').filter(Boolean).join('');
        if (translation) return translation;
      }
    } catch (e) {
      continue;
    }
  }
  return null;
}

export async function fetchViTranslation(text) {
  // Cache trước — dùng truthy check để tránh bug undefined !== null
  const cached = getCachedVi(text);
  if (cached) return cached;
  // Thử MyMemory trước (ổn định hơn), Google Translate làm dự phòng
  let tr = await fetchMyMemory(text);
  if (!tr) tr = await fetchGoogleTranslate(text);
  if (tr) {
    setCachedVi(text, tr);
    return tr;
  }
  return null;
}

// ★ Tìm Pinyin của 1 từ Hán (từ q.py)

// ★ Tìm Pinyin của 1 từ Hán (từ q.py)
export function getWordPinyin(q, wordIndex) {
  if (!q || wordIndex < 0) return '';
  const marked = answerWords(q).marked;
  return marked[wordIndex] || '';
}

// ★ Tìm nghĩa tiếng Việt của 1 từ (từ cột "Nghĩa từ" trong Excel)

// ★ Tìm nghĩa tiếng Việt của 1 từ (từ cột "Nghĩa từ" trong Excel)
export function getWordViMeaning(q, wordIndex) {
  if (!q || wordIndex < 0) return '';
  return q.wv && q.wv[wordIndex] ? q.wv[wordIndex] : '';
}

// ★ Đóng bubble Google Dịch — ẩn + reset timer + reset nội dung

// ★ Đóng bubble Google Dịch — ẩn + reset timer + reset nội dung
export function gtReset() {
  clearTimeout(window._gtTimer);
  const pop = domState.$('gtPopup');
  if (pop) {
    pop.classList.remove('show');
    pop.classList.remove('below');
    pop.setAttribute('aria-hidden', 'true');
  }
  const body = domState.$('gtBody');
  if (!body) return;
  body.innerHTML = '<div class="gtEmpty">' + '<div class="gtEmpty-icon">👆</div>' + '<div class="gtEmpty-text">Bấm vào chữ Hán<br>để dịch sang tiếng Việt</div>' + '<div class="gtEmpty-sub">Bấm chữ Hán → hiện phía trên (tự tắt 5s)</div>' + '</div>';
}

// ★ Hiển thị kết quả dịch thành công — chỉ nghĩa, không có nút

// ★ Hiển thị kết quả dịch thành công — chỉ nghĩa, không có nút
export function gtShowResult(text, pinyin, viTr, source) {
  const body = domState.$('gtBody');
  body.innerHTML = '<div class="gtOriginal">' + escapeHtml(text) + '</div>' + (pinyin ? '<div class="gtPinyin">[' + escapeHtml(pinyin) + ']</div>' : '') + '<div class="gtVi">' + escapeHtml(viTr) + '</div>' + '<div class="gtSource">Nguồn: ' + escapeHtml(source || 'MyMemory') + '</div>';
}

// ★ Hiển thị lỗi khi dịch thất bại — chỉ thông báo ngắn

// ★ Hiển thị lỗi khi dịch thất bại — chỉ thông báo ngắn
export function gtShowError(text, pinyin) {
  const body = domState.$('gtBody');
  body.innerHTML = '<div class="gtOriginal">' + escapeHtml(text) + '</div>' + (pinyin ? '<div class="gtPinyin">[' + escapeHtml(pinyin) + ']</div>' : '') + '<div class="gtVi gtVi-error">⚠️ Không dịch được</div>';
}

// ★ Hàm dịch + hiển thị

// ★ Hàm dịch + hiển thị
export async function runTranslate(text, pinyin) {
  const body = domState.$('gtBody');
  if (body) body.querySelector('.gtVi-loading') && (body.querySelector('.gtVi-loading').textContent = 'Đang dịch lại sang tiếng Việt...');
  const tr = await fetchViTranslation(text);
  if (tr) {
    gtShowResult(text, pinyin, tr, 'MyMemory / Google');
  } else {
    gtShowError(text, pinyin);
  }
}

// ★ Hàm được gọi khi click vào 1 chữ Hán → hiện bubble Google Dịch ngay phía trên chữ đó
// ★ Kiểu chatbox nhỏ, tự tắt sau 5s, hoặc khi click chữ Hán khác

// ★ Hàm được gọi khi click vào 1 chữ Hán → hiện bubble Google Dịch ngay phía trên chữ đó
// ★ Kiểu chatbox nhỏ, tự tắt sau 5s, hoặc khi click chữ Hán khác
export function openGoogleTranslate(text, wordIndex, targetEl, wordEnd) {
  if (!text || !/[\u3400-\u9fff]/.test(text)) return;
  const q = typingSessionState.index < typingSessionState.order.length ? typingSessionState.rows[typingSessionState.order[typingSessionState.index]] : null;
  const wEnd = wordEnd != null ? wordEnd : wordIndex;
  let pinyin = q ? getWordPinyin(q, wordIndex) : '',
    excelMeaning = q ? getWordViMeaning(q, wordIndex) : '';
  /* ★ Nhóm nhiều âm tiết: ghép pinyin của từng âm tiết lại */
  if (q && wEnd > wordIndex) {
    const pyParts = [];
    for (let k = wordIndex; k <= wEnd; k++) {
      const p = getWordPinyin(q, k);
      if (p) pyParts.push(p);
    }
    if (pyParts.length) pinyin = pyParts.join(' ');
  }
  const pop = domState.$('gtPopup');
  const body = domState.$('gtBody');
  if (!pop || !body) return;
  // ★ Hiện popup
  pop.classList.add('show');
  pop.setAttribute('aria-hidden', 'false');
  // ★ Định vị popup neo trên chữ Hán (targetEl)
  if (targetEl) {
    positionGtBubble(pop, targetEl);
  }
  // Hiển thị chữ + pinyin ngay
  body.innerHTML = '<div class="gtOriginal">' + escapeHtml(text) + '</div>' + (pinyin ? '<div class="gtPinyin">[' + escapeHtml(pinyin) + ']</div>' : '');
  // Nếu có nghĩa từ bộ câu (Excel/HSK) — hiện trước, đây là dữ liệu CÓ SẴN, không cần mạng
  if (excelMeaning) {
    body.insertAdjacentHTML('beforeend', '<div class="gtVi">' + escapeHtml(excelMeaning) + '</div>');
  }
  // Thêm dòng loading cho bản dịch
  body.insertAdjacentHTML('beforeend', '<div class="gtVi gtVi-loading">Đang dịch...</div>');
  // Gọi API dịch
  runTranslate(text, pinyin);
  // ★ Tự tắt sau 5 giây (reset timer mỗi lần click chữ mới)
  clearTimeout(window._gtTimer);
  window._gtTimer = setTimeout(gtReset, 5000);
}

// ★ Định vị bubble: neo phía trên target, căn giữa theo chiều ngang
// ★ Nếu không đủ chỗ phía trên → hiện phía dưới

// ★ Định vị bubble: neo phía trên target, căn giữa theo chiều ngang
// ★ Nếu không đủ chỗ phía trên → hiện phía dưới
export function positionGtBubble(pop, targetEl) {
  const rect = targetEl.getBoundingClientRect();
  const popRect = pop.getBoundingClientRect();
  const pad = 8;
  // Căn giữa ngang theo target
  let left = rect.left + rect.width / 2 - popRect.width / 2;
  left = Math.max(pad, Math.min(left, window.innerWidth - popRect.width - pad));
  // Mặc định: hiện phía trên target
  let top = rect.top - popRect.height - 10;
  // Nếu không đủ chỗ phía trên (ví dụ chữ ở mép trên) → hiện phía dưới
  if (top < pad) {
    top = rect.bottom + 10;
    pop.classList.add('below');
  } else {
    pop.classList.remove('below');
  }
  // Dùng position:absolute với toạ độ đã cộng scrollY để bubble ổn định khi cuộn trang
  pop.style.left = left + 'px';
  pop.style.top = top + window.scrollY + 'px';
}

/* ★ Từ điển từ→nghĩa Tiếng Việt cho game (chỉ chứa NGHĨA CỦA TỪ, không phải nghĩa câu).
   Reveal chỉ hiện nghĩa khi có trong đây; không có thì chỉ hiện chữ + pinyin. */
/* ═══════════════════════════════════════════════════════════
   🎮 GAME BẮN CHỮ (mới) — tham khảo ảnh:
   • Nền xanh đậm + mưa rơi
   • Thẻ từ vựng rơi: nghĩa Việt trên, chữ Hán giữa, pinyin dưới
   • Gõ TOÀN BỘ pinyin để bắn nổ từ. Enter ẩn/hiện pinyin. Sai ký tự → mất điểm + mất combo.
   • 5 mạng mỗi ván (tối đa 10). Thẻ qua vạch −1 mạng; thẻ mang ♥ phá nổ được +1 mạng.
   • Hết mạng → xem quảng cáo để +3 mạng và chơi tiếp.
   ═══════════════════════════════════════════════════════════ */
