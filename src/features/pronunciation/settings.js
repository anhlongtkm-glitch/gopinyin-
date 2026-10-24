// State and behavior owned by features/pronunciation/settings. Initialization is orchestrated by app/bootstrap.js.

import { rebuildOrder, currentItem } from "./lesson.js";

import { setPhase } from "./recording.js";

import { hideDetail, renderCard, renderResult, renderStats } from "./render.js";

import { state as pronunciationRepositoryState } from "./repository.js";

import { state as pronunciationSessionState } from "./session.js";

import { state as pronunciationStorageState } from "./storage.js";

import { state as pronunciationTtsState } from "./tts.js";

import { lsJson, lsSet, state as pronunciationUtilsState, esc, clamp } from "./utils.js";

/* ═══════════════════════════════════════════════════════════
   Khởi động / nạp nguồn
   ═══════════════════════════════════════════════════════════ */
export function loadSettings() {
  const d = lsJson(pronunciationSessionState.SETTINGS_KEY, null);
  if (d && typeof d === 'object') {
    pronunciationSessionState.S.settings = Object.assign(pronunciationSessionState.S.settings, {
      rate: Number(d.rate) || 1,
      voice: d.voice || '',
      autoSample: !!d.autoSample,
      autoNext: !!d.autoNext,
      showPy: d.showPy !== false,
      showHan: d.showHan !== false,
      showVi: d.showVi !== false,
      filter: d.filter || 'all'
    });
  }
}

export function saveSettings() {
  lsSet(pronunciationSessionState.SETTINGS_KEY, JSON.stringify(pronunciationSessionState.S.settings));
}

export function syncToolbar() {
  const set = (id, v) => {
    const el = pronunciationUtilsState.$(id);
    if (el) el.value = v;
  };
  set('pronRate', String(pronunciationSessionState.S.settings.rate));
  set('pronFilter', pronunciationSessionState.S.settings.filter);
  const tgl = (id, on) => {
    const b = pronunciationUtilsState.$(id);
    if (!b) return;
    b.classList.toggle('off', !on);
    b.setAttribute('aria-pressed', on ? 'true' : 'false');
  };
  tgl('pronPyToggle', pronunciationSessionState.S.settings.showPy);
  tgl('pronHanToggle', pronunciationSessionState.S.settings.showHan);
  tgl('pronViToggle', pronunciationSessionState.S.settings.showVi);
  tgl('pronAutoSample', pronunciationSessionState.S.settings.autoSample);
  tgl('pronAutoNext', pronunciationSessionState.S.settings.autoNext);
}

export function fillVoices() {
  const sel = pronunciationUtilsState.$('pronVoice');
  if (!sel) return;
  const list = pronunciationTtsState.PronTts.voices();
  const cur = pronunciationSessionState.S.settings.voice;
  /* Rút gọn nhãn: tên giọng của Windows/Edge rất dài
     ("Microsoft Xiaoxiao Online (Natural) - Chinese (Mainland)") → trên
     điện thoại sẽ đẩy thanh công cụ rộng quá khung. */
  const label = v => {
    const n = String(v.name || '').replace(/^Microsoft\s+/i, '').replace(/\s*-\s*Chinese.*$/i, '');
    return (n.length > 26 ? n.slice(0, 24) + '…' : n) + ' · ' + (v.lang || '');
  };
  sel.innerHTML = '<option value="">Giọng tự động</option>' + list.map(v => '<option value="' + esc(v.name) + '">' + esc(label(v)) + '</option>').join('');
  sel.value = list.some(v => v.name === cur) ? cur : '';
  if (!list.length) {
    sel.innerHTML = '<option value="">Giọng tự động</option>';
    sel.title = 'Trình duyệt chưa có giọng đọc tiếng Trung nào — hãy cài thêm gói giọng tiếng Trung.';
  }
}

export async function fillSources() {
  const sel = pronunciationUtilsState.$('pronSource');
  if (!sel) return;
  pronunciationSessionState.S.sources = await pronunciationRepositoryState.PronRepo.sources();
  if (!pronunciationSessionState.S.sources.length) {
    sel.innerHTML = '<option value="">Chưa có nội dung</option>';
    return;
  }
  const want = pronunciationSessionState.S.source;
  sel.innerHTML = pronunciationSessionState.S.sources.map(s => '<option value="' + esc(s.id) + '">' + esc(s.label) + '</option>').join('');
  const has = pronunciationSessionState.S.sources.some(s => s.id === want);
  sel.value = has ? want : pronunciationSessionState.S.sources[0].id;
  pronunciationSessionState.S.source = sel.value;
}

export async function loadSource(srcId, keepId) {
  pronunciationSessionState.S.source = srcId;
  const key = pronunciationRepositoryState.PronRepo.keyOf(srcId);
  pronunciationSessionState.S.progress = pronunciationStorageState.PronStore.load(key);
  pronunciationSessionState.S.items = await pronunciationRepositoryState.PronRepo.load(srcId);
  pronunciationSessionState.S.result = null;
  pronunciationSessionState.S.record = null;
  pronunciationSessionState.S.index = 0;
  rebuildOrder(keepId);
  /* khôi phục đúng câu đang dừng lần trước */
  if (!keepId && pronunciationSessionState.S.progress && typeof pronunciationSessionState.S.progress.index === 'number') {
    pronunciationSessionState.S.index = clamp(pronunciationSessionState.S.progress.index, 0, Math.max(0, pronunciationSessionState.S.order.length - 1));
  }
  setPhase('idle', '');
  hideDetail();
  renderCard();
  renderResult();
  renderStats();
  /* ★ D.2: mới vào một chủ đề (keepId rỗng = vào mới, không phải khôi phục
     giữa chừng) → tự đọc to câu tiếng Trung ĐẦU TIÊN ĐÚNG 1 LẦN, không phụ
     thuộc nút "Tự nghe mẫu". Khôi phục giữa chừng (keepId) giữ nguyên behaviour
     cũ: chỉ đọc nếu người dùng bật "Tự nghe mẫu". */
  if (!keepId) {
    setTimeout(() => {
      const it = currentItem();
      if (it && it.zh) pronunciationTtsState.PronTts.speak(it.zh, {
        rate: pronunciationSessionState.S.settings.rate
      });
    }, 340);
  } else if (pronunciationSessionState.S.settings.autoSample) {
    setTimeout(() => {
      const it = currentItem();
      if (it && it.zh) pronunciationTtsState.PronTts.speak(it.zh, {
        rate: pronunciationSessionState.S.settings.rate
      });
    }, 300);
  }
}

/* ═══════════════════════════════════════════════════════════
   CẢNH BÁO file:// — nguyên nhân thật của "hỏi quyền micro mỗi lần"
   Chrome KHÔNG lưu quyền micro cho origin `file://`. Vì vậy mỗi lần
   SpeechRecognition.start() (mỗi lượt nói) Chrome lại hỏi. Không có cách
   nào sửa bằng JavaScript — phải chạy qua http://localhost (hoặc https).
   Ở đây: dò xem máy có server nội bộ đang chạy không; nếu có thì chuyển
   hướng sang đó (1 lần / tab), nếu không thì hiện băng hướng dẫn.
   ═══════════════════════════════════════════════════════════ */
