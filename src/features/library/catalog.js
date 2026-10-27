import { libStats as speakingStats } from '../pronunciation/library.js';
import { learningStorage } from '../../shared/storage/account-data.js';
import { requireAccount, currentUser } from "../auth/service.js";
import { navigationVersion, markNavigation } from "../../app/routes.js";
import { setMascot } from "../../shared/mascot.js";
// State and behavior owned by features/library/catalog. Initialization is orchestrated by app/bootstrap.js.


import { state as dataCatalogState } from "../../data/catalog.js";

import { srcProgress } from "./controller.js";

import { openDataset } from "../typing/datasets.js";

import { state as domState } from "../../shared/dom.js";

import { normalize } from "../../shared/language/normalization.js";

import { fixPinyin } from "../../shared/language/pinyin.js";

import { vcacheGet, vcachePut, dbList, dbPut } from "../../shared/storage/lesson-repository.js";

import { toast } from "../../shared/toast.js";

import { escapeHtml } from "../../shared/utils.js";

export const state = {};

const libraryCatalogState = state;

export function ensureVocabPack() {
  if (window.VOCAB_PACK) return Promise.resolve(true);
  if (libraryCatalogState.vocabPackPromise) return libraryCatalogState.vocabPackPromise;
  libraryCatalogState.vocabPackPromise = new Promise(resolve => {
    const s = document.createElement('script');
    s.src = 'assets/vocab-pack.js';
    s.async = true;
    s.onload = () => resolve(!!window.VOCAB_PACK);
    s.onerror = () => resolve(false);
    document.head.appendChild(s);
  });
  return libraryCatalogState.vocabPackPromise;
}

export function parsePackRows(raw) {
  if (!raw) return [];
  const out = [];
  for (const line of String(raw).split('\n')) {
    if (!line) continue;
    const p = line.split('\t');
    if (p[0] && p[2]) out.push({
      w: p[0],
      p: p[1] || '',
      m: p[2]
    });
  }
  return out;
}
/* số mục của một chủ đề (hiện trên thẻ, không cần nạp gói) */

/* số mục của một chủ đề (hiện trên thẻ, không cần nạp gói) */
export function topicCount(id) {
  try {
    if (typeof dataCatalogState.TOPIC_COUNTS !== 'undefined' && dataCatalogState.TOPIC_COUNTS[id]) return dataCatalogState.TOPIC_COUNTS[id];
    if (window.TOPIC_COUNTS && window.TOPIC_COUNTS[id]) return window.TOPIC_COUNTS[id];
  } catch (e) {}
  return 0;
}
/* ★ Số mục THẬT của một nguồn, tính từ dữ liệu thay vì nhãn viết cứng.
   Cấp HSK đếm đúng theo điều kiện của fetchVocabItems (có chữ Hán + có nghĩa),
   nhờ vậy nhãn trên thẻ luôn khớp với tiến độ "x/N" bên trong bộ luyện. */

/* ★ Số mục THẬT của một nguồn, tính từ dữ liệu thay vì nhãn viết cứng.
   Cấp HSK đếm đúng theo điều kiện của fetchVocabItems (có chữ Hán + có nghĩa),
   nhờ vậy nhãn trên thẻ luôn khớp với tiến độ "x/N" bên trong bộ luyện. */
export function srcCount(id) {
  const k = String(id || '');
  if (/^hsk[1-9]$/.test(k) && typeof dataCatalogState.HSK_DATA !== 'undefined') {
    return (dataCatalogState.HSK_DATA[k] || []).filter(x => x && x[0] && x[2]).length;
  }
  return topicCount(k);
}

export function findVocabSource(id) {
  for (const g of ['hsk', 'topic', 'tone', 'other']) {
    const f = (dataCatalogState.VOCAB_GROUPS[g] || []).find(x => x[0] === id);
    if (f) return {
      id: f[0],
      label: f[1],
      cat: f[2] || '',
      file: f[0] + '.json'
    };
  }
  return null;
}
// ★ Tải dữ liệu 1 nguồn (ưu tiên cache) → [{w,p,m}]

// ★ Tải dữ liệu 1 nguồn (ưu tiên cache) → [{w,p,m}]
export async function fetchVocabItems(file) {
  const key = String(file).replace(/\.json$/, '');
  const emb = dataCatalogState.HSK_DATA[key];
  if (emb) return emb.map(x => ({
    w: String(x[0] || ''),
    p: String(x[1] || ''),
    m: String(x[2] || '')
  })).filter(x => x.w && x.m);
  /* ★ ưu tiên gói offline (không cần mạng, mở tức thì sau lần đầu) */
  if (await ensureVocabPack()) {
    const raw = window.VOCAB_PACK && window.VOCAB_PACK[key];
    if (raw) {
      const items = parsePackRows(raw);
      if (items.length) return items;
    }
  }
  const cached = await vcacheGet(file);
  if (cached && Array.isArray(cached.items) && cached.items.length) return cached.items;
  const resp = await fetch(libraryCatalogState.VOCAB_CDN + file, {
    cache: 'force-cache'
  });
  if (!resp.ok) throw new Error('máy chủ trả về ' + resp.status);
  const raw = await resp.json();
  if (!Array.isArray(raw)) throw new Error('dữ liệu không hợp lệ');
  const items = raw.map(x => ({
    w: String(x && x.w || '').trim(),
    p: String(x && x.p || '').trim(),
    m: String(x && (x.m || x.m_en) || '').trim()
  })).filter(x => x.w && x.m);
  if (items.length) await vcachePut({
    file,
    items,
    fetchedAt: Date.now()
  });
  return items;
}

// ★ Bấm 1 mục trong kho → tạo bộ luyện (lưu vào thư viện) rồi mở luôn

// ★ Bấm 1 mục trong kho → tạo bộ luyện (lưu vào thư viện) rồi mở luôn
export async function openVocabSource(srcId, options = {}) {
  const practiceMode = options.practiceMode || learningStorage.getItem('cts:progress:practice-mode:vocab:'+srcId) || 'typing';
  const navigation = markNavigation();
  if (!await requireAccount(() => openVocabSource(srcId,{practiceMode}))) return;
  if (navigation !== navigationVersion()) return;
  const accountId = currentUser().id;
  const src = findVocabSource(srcId);
  if (!src) return;
  const id = 'vocab:' + srcId;
  const existing = (await dbList()).find(x => x.id === id);
  if (currentUser()?.id !== accountId || navigation !== navigationVersion()) return;
  if (existing) {
    await openDataset(id, { navigation, practiceMode });
    return;
  }
  const list = domState.$('vocabList');
  const prev = list ? list.innerHTML : '';
  if (list) list.innerHTML = '<div class="vocabLoading">Đang tải "' + escapeHtml(src.label) + '"…</div>';
  try {
    let items = await fetchVocabItems(src.file);
    if (!items.length) throw new Error('bộ dữ liệu rỗng');
    const rows = items.map((it, i) => ({
      id: i,
      vi: it.m,
      py: fixPinyin(it.p),
      zh: it.w,
      wv: []
    }));
    const ds = {
      id,
      name: src.label,
      sourceName: 'Kho câu giao tiếp',
      rows,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      builtin: true
    };
    if (currentUser()?.id !== accountId || navigation !== navigationVersion()) return;
    await dbPut(ds);
    toast('Đã tạo bộ "' + src.label + '" (' + rows.length + ' mục).', 'ok');
    await openDataset(id, { navigation, practiceMode });
  } catch (e) {
    if (navigation !== navigationVersion() || currentUser()?.id !== accountId) return;
    if (list) list.innerHTML = prev;
    toast('Không tải được "' + src.label + '": ' + e.message + '. Kiểm tra kết nối mạng rồi thử lại.', 'bad', 5500);
  }
}

export function renderVocab() {
  const list = domState.$('vocabList');
  if (!list) return;
  let items = dataCatalogState.VOCAB_GROUPS[libraryCatalogState.vocabTab] || [];
  const q = libraryCatalogState.vocabQuery.trim().toLowerCase();
  if (q) items = items.filter(x => x[1].toLowerCase().includes(q) || normalize(x[1]).includes(normalize(q)));
  if (!items.length) {
    setMascot('libraryMascot', 'search');
    list.innerHTML = '<div class="vocabEmpty">Không tìm thấy mục nào phù hợp.</div>';
    return;
  }
  setMascot('libraryMascot', 'reading');
  list.innerHTML = items.map(x => {
    const cnt = srcCount(x[0]);
    const unit = /^hsk[1-9]$/.test(String(x[0])) ? 'câu' : 'từ';
    const cntTxt = cnt ? '<span class="vocabCount">' + cnt + ' ' + unit + '</span>' : '';
    /* ★ Bỏ nhãn "281 câu" viết cứng trong VOCAB_GROUPS — số thật lấy từ dữ liệu,
       nếu không thẻ ghi 281 mà tiến độ bên trong lại là 0/301. */
    const cat = x[2] && !/^\s*\d+\s*(câu|từ)\s*$/i.test(x[2]) ? x[2] : '';
    /* ★ Tiến độ đã học hiện NGAY trên thẻ (thay mục "Bộ câu của bạn" đã bỏ) */
    const prog = srcProgress(x[0], cnt, unit);
    const source = /^hsk[1-9]$/.test(x[0]) ? 'hsk:' + x[0] : 'ds:vocab:' + x[0];
    const spoken = speakingStats(source).attempted;
    const modeActions = '<div class="practiceTileActions"><button type="button" data-practice-source="' + escapeHtml(x[0]) + '" data-start-mode="typing">Gõ</button><button type="button" data-practice-source="' + escapeHtml(x[0]) + '" data-start-mode="speaking">Nói <small>' + spoken + '/' + cnt + '</small></button></div>';
    return '<div class="practiceTile"><button class="vocabCard' + '" type="button" data-vsrc="' + escapeHtml(x[0]) + '" title="' + 'Tạo bộ luyện: ' + escapeHtml(x[1]) + (cnt ? ' · ' + cnt + ' ' + unit : '') + '">' + (cat ? '<span class="vocabCat">' + escapeHtml(cat) + '</span>' : '') + '<span class="vocabCard-title">' + escapeHtml(x[1]) + '</span>' + cntTxt + prog + '</button>' + modeActions + '</div>';
  }).join('');
}

export function setLibTab(tab) {
  /* ★ Thư viện chỉ còn pane kho câu có sẵn (HSK / chủ đề) */
  if (tab === 'vocab') renderVocab();
}
// ★ Hiện cảnh báo khi trình duyệt chặn lưu trữ

// ★ Hiện cảnh báo khi trình duyệt chặn lưu trữ
export function showStorageWarn() {
  const el = domState.$('storageWarn');
  if (el) el.classList.remove('hidden');
}

export function hideStorageWarn() {
  const el = domState.$('storageWarn');
  if (el) el.classList.add('hidden');
}
/* ═══════════════════════════════════════════════════════════
   ★ AI SINH CÂU — bạn viết prompt → AI tạo câu tiếng Trung hoàn chỉnh
   ★ CHỈ GIỮ NHỮNG DỊCH VỤ THỰC SỰ DÙNG ĐƯỢC: Google Gemini (chính)
     + OpenRouter (dự phòng khi Gemini hết hạn mức). Cả hai đều dùng
     API key MIỄN PHÍ, không đăng nhập, không popup → chạy được ở mọi nơi.
   ★ Không giới hạn số lượng: "Tạo thêm" ghi thêm vào bộ đang học
   ═══════════════════════════════════════════════════════════ */
/* ★ CẤU HÌNH NHÀ CUNG CẤP — một chỗ duy nhất: tên, trang lấy API key, chữ trên nút,
   hướng dẫn, placeholder ô key. Dropdown + hàng "Lấy API key" đọc từ đây. */

export function initializeLibraryCatalog() {
  /* ═══════════════════════════════════════════════════════════
     ★ BỘ CÂU HSK 1–9 (nhúng sẵn — KHÔNG cần mạng)
     ★ 100% là CÂU hoàn chỉnh, KHÔNG có từ đơn lẻ
     ★ Nguồn: hsk-sentences-audio (chuẩn HSK 3.0 / GF0025-2021)
     ★ Mỗi câu: [chữ Hán, pinyin, nghĩa tiếng Việt]
     ═══════════════════════════════════════════════════════════ */
  libraryCatalogState.VOCAB_CDN = 'https://cdn.jsdelivr.net/gh/B11007011/database@main/notebooks/note/';
  libraryCatalogState.vocabTab = 'hsk';
  libraryCatalogState.vocabQuery = '';
  /* ═══════════════════════════════════════════════════════════
     ★ GÓI TỪ VỰNG CHỦ ĐỀ OFFLINE (assets/vocab-pack.js — 1,9 MB)
     206 chủ đề · 41.621 mục (chữ Hán + pinyin + nghĩa Việt).
     Nạp LƯỜI: chỉ tải khi người dùng mở một chủ đề lần đầu,
     nên trang vẫn nhẹ; sau đó dùng lại từ bộ nhớ.
     ═══════════════════════════════════════════════════════════ */
  libraryCatalogState.vocabPackPromise = null;
}
