// State and behavior owned by shared/audio/tts. Initialization is orchestrated by app/bootstrap.js.

import { answerWords } from "../../features/typing/answers.js";

import { hanChars } from "../../features/typing/input.js";

import { state as typingSessionState, currentRow } from "../../features/typing/session.js";

import { state as domState } from "../dom.js";

import { normalize } from "../language/normalization.js";

import { toast } from "../toast.js";

import { escapeHtml } from "../utils.js";
import { setMascot } from "../mascot.js";
import { navigationVersion } from "../../app/routes.js";

let sampleVersion = 0;

/* ── Speech Synthesis ── */
export function getChineseVoices() {
  return window.speechSynthesis.getVoices().filter(v => /^zh/i.test(v.lang) || /Chinese|Mandarin|Xiaoxiao|Xiaoyi|Xiaomo|Xiaoxuan|Xiaohan|Yaoyao|Huihui|Yunxi|Yunjian|Yunyang|Yunhao|Yunze|Yunfeng|Kangkang/i.test(v.name));
}

export function voiceGender(v) {
  const n = v.name.toLowerCase();
  if (/yunxi|yunjian|yunyang|yunhao|yunze|yunfeng|kangkang|danny|male/.test(n)) return 'male';
  if (/xiaoxiao|xiaoyi|xiaomo|xiaoxuan|xiaohan|yaoyao|huihui|female/.test(n)) return 'female';
  return 'unknown';
}

export function voiceLabel(v) {
  const g = voiceGender(v);
  return (g === 'male' ? '👨 ' : g === 'female' ? '👩 ' : '🎤 ') + v.name + ' — ' + v.lang;
}

export function populateVoiceSelect() {
  const select = domState.$('voiceSelect');
  if (!select) return;
  const voices = getChineseVoices().sort((a, b) => {
    const ga = voiceGender(a),
      gb = voiceGender(b);
    const rank = {
      male: 0,
      female: 1,
      unknown: 2
    };
    return rank[ga] - rank[gb] || a.name.localeCompare(b.name);
  });
  const current = typingSessionState.selectedVoiceName;
  select.innerHTML = '<option value="">Tự động chọn</option><option value="__male__">👨 Giọng nam</option><option value="__female__">👩 Giọng nữ</option>' + voices.map(v => `<option value="${escapeHtml(v.name)}">${escapeHtml(voiceLabel(v))}</option>`).join('');
  if (current && (current === '__male__' || current === '__female__' || voices.some(v => v.name === current))) select.value = current;else {
    select.value = '';
    if (current) typingSessionState.selectedVoiceName = '';
  }
}

export function getChineseVoice() {
  const voices = getChineseVoices();
  if (typingSessionState.selectedVoiceName === '__male__') return voices.find(v => voiceGender(v) === 'male') || voices.find(v => /^zh(-|_)?CN/i.test(v.lang)) || voices[0];
  if (typingSessionState.selectedVoiceName === '__female__') return voices.find(v => voiceGender(v) === 'female') || voices.find(v => /^zh(-|_)?CN/i.test(v.lang)) || voices[0];
  return voices.find(v => v.name === typingSessionState.selectedVoiceName) || voices.find(v => /^zh(-|_)?CN/i.test(v.lang)) || voices[0];
}
/* ★ Đọc NHIỀU đoạn nối tiếp nhau (không cắt nhau như speakText).
   Dùng khi cần "đọc chữ cuối rồi đọc lại cả câu": cancel() 1 lần rồi
   đẩy lần lượt các utterance vào hàng đợi của speechSynthesis. */

/* ★ Đọc NHIỀU đoạn nối tiếp nhau (không cắt nhau như speakText).
   Dùng khi cần "đọc chữ cuối rồi đọc lại cả câu": cancel() 1 lần rồi
   đẩy lần lượt các utterance vào hàng đợi của speechSynthesis. */
export function speakQueue(texts) {
  if (!('speechSynthesis' in window)) return;
  const list = (Array.isArray(texts) ? texts : [texts]).filter(t => t && String(t).trim());
  if (!list.length) return;
  window.speechSynthesis.cancel();
  const voice = getChineseVoice();
  for (const text of list) {
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = 'zh-CN';
    utter.rate = typingSessionState.speechRate;
    if (voice) utter.voice = voice;
    if (typingSessionState.selectedVoiceName === '__male__' && voiceGender(voice || {}) !== 'male') utter.pitch = 0.78;
    window.speechSynthesis.speak(utter);
  }
}

function setSampleLabel(button, text) {
  if (!button) return;
  let label = button.querySelector('[data-audio-label]');
  if (!label) {
    label = document.createElement('span');
    label.dataset.audioLabel = '';
    button.prepend(label);
  }
  const playing = text !== 'Nghe';
  label.textContent = 'Nghe';
  button.setAttribute('aria-label', playing ? 'Đang phát câu mẫu' : 'Nghe mẫu');
  button.setAttribute('aria-busy', String(playing));
}

export function speakText(text, showButtonState = false) {
  if (!text || !('speechSynthesis' in window)) return;
  const version = ++sampleVersion;
  window.speechSynthesis.cancel();
  const utter = new SpeechSynthesisUtterance(text);
  utter.lang = 'zh-CN';
  utter.rate = typingSessionState.speechRate;
  const voice = getChineseVoice();
  if (voice) utter.voice = voice;
  if (typingSessionState.selectedVoiceName === '__male__' && voiceGender(voice || {}) !== 'male') utter.pitch = 0.78;
  const btn = domState.$('audioBtn');
  if (showButtonState) {
    const item = currentRow(), navigation = navigationVersion();
    const current = () => version === sampleVersion && item === currentRow() && navigation === navigationVersion() && domState.$('appCard')?.getClientRects().length;
    btn.classList.add('speaking');
    setSampleLabel(btn, 'Đang phát…');
    utter.onstart = () => { if (current() && !typingSessionState.composing) setMascot('typingStudyMascot', 'listening'); };
    const reset = () => {
      if (version !== sampleVersion) return;
      btn.classList.remove('speaking');
      setSampleLabel(btn, 'Nghe');
      if (current()) setMascot('typingStudyMascot', typingSessionState.awaitingEnter ? 'approve' : 'reading');
    };
    utter.onend = reset;
    utter.onerror = reset;
  } else {
    btn?.classList.remove('speaking');
    setSampleLabel(btn, 'Nghe');
  }
  window.speechSynthesis.speak(utter);
}

export function speakChinese() {
  if (!('speechSynthesis' in window)) {
    toast('Trình duyệt không hỗ trợ đọc tiếng. Hãy mở bằng Chrome hoặc Edge.', 'warn');
    return;
  }
  const q = currentRow();
  if (!q) return;
  if (!q.zh || q.zh === '—') {
    toast('Câu này không có chữ Hán.', 'warn');
    return;
  }
  speakText(q.zh, true);
}

/* ── Word Speech ── */

/* ── Word Speech ── */
export function countPinyinSyllables(token) {
  const t = normalize(token).replace(/[^a-züv]/g, '');
  if (!t) return 1;
  const groups = t.match(/[aeiouüv]+/g);
  return Math.max(1, groups ? groups.length : 1);
}

export function chineseSpeechUnits(text) {
  const units = [];
  for (let i = 0; i < text.length;) {
    const rest = text.slice(i),
      latin = rest.match(/^[A-Za-z0-9]+/);
    if (latin) {
      units.push(latin[0]);
      i += latin[0].length;
      continue;
    }
    const ch = text[i];
    if (/[\u3400-\u9fff]/.test(ch)) units.push(ch);
    i++;
  }
  return units;
}

export function wordChineseText(q, wordIndex) {
  const marked = answerWords(q).marked,
    units = chineseSpeechUnits(q.zh || '');
  let pos = 0;
  for (let i = 0; i < marked.length; i++) {
    const token = marked[i],
      next = units[pos] || '';
    let take = next && /[A-Za-z0-9]/.test(next) && normalize(next) === normalize(token) ? 1 : countPinyinSyllables(token);
    const piece = units.slice(pos, pos + take).join('');
    if (i === wordIndex) return piece || token;
    pos += take;
  }
  return marked[wordIndex] || '';
}

export function speakCompletedWord(wordIndex) {
  if (!typingSessionState.autoSound || typingSessionState.index >= typingSessionState.order.length || !('speechSynthesis' in window)) return;
  speakText(wordChineseText(typingSessionState.rows[typingSessionState.order[typingSessionState.index]], wordIndex), false);
}

/* ═══════════════════════════════════════════════════════════
   ★ ĐỌC CHỮ VỪA GÕ (bật/tắt độc lập, không phụ thuộc nút "Tự đọc")
   • Gõ ĐÚNG 1 chữ Hán → đọc ngay chữ đó.
   • Gõ/dán NHIỀU chữ một lúc (IME giữ cụm, dán chuỗi) → đọc GỘP 1 LẦN:
     gõ ra "请确认" (3 chữ trong 1 sự kiện input) → đọc "请确认" một lần,
     KHÔNG đọc 3 lần liên tiếp.
   • ★ CHỮ CUỐI CÙNG cũng được đọc: hàm chỉ đọc PHẦN MỚI thêm vào so với
     lần đọc trước, nên chữ cuối luôn nằm trong phần mới → không bị bỏ sót
     (lỗi hay gặp: chỉ đọc các chữ ở giữa, rơi mất chữ cuối câu).
   ═══════════════════════════════════════════════════════════ */

/* ═══════════════════════════════════════════════════════════
   ★ ĐỌC CHỮ VỪA GÕ (bật/tắt độc lập, không phụ thuộc nút "Tự đọc")
   • Gõ ĐÚNG 1 chữ Hán → đọc ngay chữ đó.
   • Gõ/dán NHIỀU chữ một lúc (IME giữ cụm, dán chuỗi) → đọc GỘP 1 LẦN:
     gõ ra "请确认" (3 chữ trong 1 sự kiện input) → đọc "请确认" một lần,
     KHÔNG đọc 3 lần liên tiếp.
   • ★ CHỮ CUỐI CÙNG cũng được đọc: hàm chỉ đọc PHẦN MỚI thêm vào so với
     lần đọc trước, nên chữ cuối luôn nằm trong phần mới → không bị bỏ sót
     (lỗi hay gặp: chỉ đọc các chữ ở giữa, rơi mất chữ cuối câu).
   ═══════════════════════════════════════════════════════════ */
export function speakTypedProgress(isComplete) {
  if (!typingSessionState.readOnType || !('speechSynthesis' in window) || typingSessionState.composing || typingSessionState.awaitingEnter) return;
  const inp = domState.$('pinyinInput'),
    q = currentRow();
  if (!q) return;
  const got = hanChars(inp.value).join('');
  /* Người dùng xoá lùi (Backspace) hoặc sửa lại → đồng bộ mốc, KHÔNG đọc */
  if (got.length < typingSessionState.lastTypedSpoken.length || !got.startsWith(typingSessionState.lastTypedSpoken)) {
    typingSessionState.lastTypedSpoken = got;
    return;
  }
  if (got.length === typingSessionState.lastTypedSpoken.length) return; // không có chữ mới
  const fresh = got.slice(typingSessionState.lastTypedSpoken.length); // đúng phần vừa gõ thêm
  typingSessionState.lastTypedSpoken = got;
  if (isComplete) {
    /* ★ Gõ xong câu: nối tiếp "chữ vừa gõ" → "cả câu" trong cùng hàng đợi.
       Nếu để markSentenceCorrect() đọc cả câu riêng sau 1s thì lệnh
       speechSynthesis.cancel() sẽ CẮT NGANG tiếng chữ cuối đang đọc. */
    typingSessionState.suppressSentenceSpeech = true;
    speakQueue([fresh, String(q.zh || '')]);
  } else {
    speakText(fresh, false);
  }
}
/* Sang câu mới / làm lại → gạch đếm lại từ đầu */

/* Sang câu mới / làm lại → gạch đếm lại từ đầu */
export function resetTypedSpeech() {
  typingSessionState.lastTypedSpoken = '';
}

/* ═══════════════════════════════════════════════════════════
   ★ ÂM THANH HIỆU ỨNG (Web Audio API) — KHÔNG cần file ngoài
   • sfxShot(): tiếng "bắn" rất ngắn (~90ms) mỗi khi gõ ĐÚNG 1 ký tự.
     Trộn 2 lớp: nhiễu trắng qua bandpass (tiếng "bụp") + sóng vuông
     quét tần số từ cao xuống thấp (tiếng "pew").
   • Cao độ hơi ngẫu nhiên mỗi phím → nghe tự nhiên, không đều đều.
   • AudioContext chỉ tạo ở lần bấm phím đầu tiên (đúng cử chỉ người
     dùng) nên không bị chính sách autoplay của trình duyệt chặn.
   ═══════════════════════════════════════════════════════════ */
