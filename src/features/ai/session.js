import { requireAccount, currentUser } from "../auth/service.js";
import { setMascot } from "../../shared/mascot.js";
import { aiProxyUrl } from "../../shared/service-config.js";
import { markNavigation, navigationVersion, writeRoute } from "../../app/routes.js";
// State and behavior owned by features/ai/session. Initialization is orchestrated by app/bootstrap.js.

import { legacy } from "../../app/compatibility.js";

import { state as aiClientState, aiUnitOf } from "./client.js";

import { state as aiProvidersState, aiLsSet, aiKeyStore, aiKeyLoad, aiLsGet } from "./providers.js";

import { aiCollect, state as aiValidationState } from "./validation.js";

import { updateChineseHighlight } from "../typing/answers.js";

import { updateSoundUI, updateViUI, updateHanUI, updateModeUI } from "../typing/controls.js";

import { fillAppSource } from "../typing/datasets.js";

import { loadHistory, renderAppHistory } from "../typing/history.js";

import { save } from "../typing/progress.js";

import { renderStatsOnly, render } from "../typing/render.js";

import { state as typingSessionState } from "../typing/session.js";

import { state as domState } from "../../shared/dom.js";

import { appConfirm, appPrompt, _modalClose, state as modalState } from "../../shared/modal.js";

import { dbPut, progressKey } from "../../shared/storage/lesson-repository.js";

import { toast } from "../../shared/toast.js";

import { fetchViTranslation } from "../../shared/translation.js";

import { escapeHtml } from "../../shared/utils.js";

export const state = {};

const aiSessionState = state;
let aiRequestId = 0;
function aiStartLabel() {
  const kind = domState.$('aiKind')?.value;
  return kind === 'word' ? 'Tạo từ vựng và học' : kind === 'both' ? 'Tạo bài và học' : 'Tạo câu và học';
}
async function ownedDialog(session, promise) {
  const resolve = modalState._modalResolve;
  session.dialog = resolve;
  try { return await promise; } finally { if (session.dialog === resolve) session.dialog = null; }
}

// {prompt,level,provider,key,batch,seen,pending,stopped,empty,live}
export function aiSetStatus(msg, cls) {
  const el = domState.$('aiStatus');
  if (!el) return;
  el.className = 'aiStatus' + (cls ? ' ' + cls : '');
  el.innerHTML = msg;
  if (cls === 'err') setMascot('aiMascot', 'encourage', { animate: true });
}
/* ★ Thanh trạng thái AI trên màn hình học */

/* ★ Thanh trạng thái AI trên màn hình học */
export function aiShowGen(msg, cls, retry) {
  const el = domState.$('aiGenBar');
  if (!el) return;
  /* ★ Phải gán lại class CÓ 'hidden' — trước đây gán 'aiGenBar' trần nên thanh
     rỗng vẫn hiện thành một dải màu xanh trống dưới thẻ câu. */
  if (!msg) {
    el.className = 'aiGenBar hidden';
    el.innerHTML = '';
    return;
  }
  el.classList.remove('hidden');
  el.className = 'aiGenBar' + (cls ? ' ' + cls : '');
  el.innerHTML = msg + (retry ? '<button type="button" class="btn secondary aiRetryBtn" id="aiRetryBtn">Thử lại</button>' : '');
  if (retry && domState.$('aiRetryBtn')) domState.$('aiRetryBtn').onclick = () => {
    const session = aiSessionState.aiSession;
    if (!session) return;
    if (session.retryAt > Date.now()) {
      toast('Đợi thêm ' + Math.ceil((session.retryAt - Date.now()) / 1000) + ' giây rồi thử lại.', 'warn');
      return;
    }
    session.stopped = false;
    session.error = null;
    session.empty = 0;
    aiShowGen('');
    aiMaybeFill();
  };
}

export function aiShowSessionError() {
  const session = aiSessionState.aiSession;
  if (session?.stopped) aiShowGen(escapeHtml(session.error?.message || 'AI chưa tạo được nội dung mới theo yêu cầu. Bấm Thử lại hoặc đổi chủ đề.'), 'err', true);
}

function aiConnection(provider) {
  const shared = !!aiProxyUrl();
  const selected = provider || aiLsGet(aiProvidersState.AI_PROV_KEY, aiProvidersState.AI_DEFAULT_PROVIDER);
  const use = !shared && aiProvidersState.AI_PROVIDERS[selected] ? selected : aiProvidersState.AI_DEFAULT_PROVIDER;
  return { provider: use, key: shared ? '' : aiKeyLoad(use) };
}

export function aiResumeSavedSet() {
  const dataset = aiSavedSet();
  if (aiSessionLive() || !dataset?.prompt || typingSessionState.mode !== 'all' || !currentUser()) return;
  const connection = aiConnection(dataset.provider);
  aiSessionState.aiSession = {
    ...connection, prompt: dataset.prompt, level: dataset.level || '',
    batch: Math.max(1, Math.min(20, Number(dataset.batch) || 5)), kind: aiCurrentKind(),
    seen: new Set(typingSessionState.rows.map(row => row.zh)), pending: 0, stopped: false, empty: 0,
    generated: typingSessionState.rows.length, live: true, rows: typingSessionState.rows,
    navigation: navigationVersion(), accountId: currentUser().id
  };
  // Keep the initial sample audio and input; only an exhausted set needs waiting UI.
  if (typingSessionState.index >= typingSessionState.order.length) render();
  else aiMaybeFill();
}

function aiTypingVisible(session) {
  return session === aiSessionState.aiSession && session.live && !document.hidden &&
    !domState.$('appCard')?.classList.contains('hidden') && session.rows === typingSessionState.rows &&
    session.accountId === currentUser()?.id;
}

function pauseAiGeneration() {
  const session = aiSessionState.aiSession;
  if (session) { session.paused = true; session.epoch = (session.epoch || 0) + 1; }
}

function resumeAiGeneration() {
  const session = aiSessionState.aiSession;
  if (!session || !aiTypingVisible(session)) return;
  session.paused = false;
  session.navigation = navigationVersion();
  aiMaybeFill();
}
/* ★ Thêm câu AI vào hàng chờ học.
   Bộ ĐÃ LƯU (kind==='ai') → ghi luôn vào database để lần sau học tiếp vẫn đủ câu.
   Bộ học tạm (chưa lưu) → chỉ nằm trong bộ nhớ, rời đi là hết. */

/* ★ Thêm câu AI vào hàng chờ học.
   Bộ ĐÃ LƯU (kind==='ai') → ghi luôn vào database để lần sau học tiếp vẫn đủ câu.
   Bộ học tạm (chưa lưu) → chỉ nằm trong bộ nhớ, rời đi là hết. */
export function aiAppendRows(items) {
  const start = typingSessionState.rows.length;
  items.forEach((it, i) => {
    typingSessionState.rows.push({
      id: 'ai-' + (start + i),
      vi: it.vi,
      py: it.py,
      zh: it.zh,
      wv: []
    });
    typingSessionState.order.push(start + i);
    typingSessionState.mainOrder.push(start + i);
  });
  if (aiSessionState.aiSession) aiSessionState.aiSession.generated = typingSessionState.rows.length;
  aiFillMissingVi(); // ★ AI hay bỏ trống nghĩa TV → tự dịch nền cho đủ
  const saved = aiSavedSet();
  if (saved) {
    saved.rows = typingSessionState.rows;
    saved.updatedAt = Date.now();
    dbPut(saved).catch(() => {});
    save(); // tiến độ + mainOrder mới (câu nối vào cuối)
  }
}
/* Bộ AI đã lưu đang học (khác với phiên AI học tạm) */

/* Bộ AI đã lưu đang học (khác với phiên AI học tạm) */
export function aiSavedSet() {
  return typingSessionState.activeDataset && typingSessionState.activeDataset.kind === 'ai' ? typingSessionState.activeDataset : null;
}
/* Loại nội dung đang học: ưu tiên bộ đã lưu → phiên AI đang chạy → mặc định câu */

/* Loại nội dung đang học: ưu tiên bộ đã lưu → phiên AI đang chạy → mặc định câu */
export function aiCurrentKind() {
  const s = aiSavedSet();
  if (s && s.contentType && aiClientState.AI_KINDS[s.contentType]) return s.contentType;
  if (aiSessionState.aiSession && aiSessionState.aiSession.kind && aiClientState.AI_KINDS[aiSessionState.aiSession.kind]) return aiSessionState.aiSession.kind;
  return 'sentence';
}

export function aiCurrentUnit() {
  return aiUnitOf(aiCurrentKind());
}
/* ★ AI đôi khi không trả nghĩa tiếng Việt (hoặc đặt sai tên trường) → tự dịch nền
   bằng MyMemory (có cache localStorage), cập nhật YÊN LẶNG — không đụng
   vào ô nhập hay câu đang gõ dở.
   ★ Tra nghĩa online: luôn bật, gọi thẳng MyMemory qua HTTPS. */
/* ★ Khai báo SỚM (trước aiFillMissingVi) để mọi hàm dùng đều thấy giá trị —
     tránh lỗi "gtOnline is not defined" (temporal dead zone) khi hàm được
     gọi trong ngữ cảnh chỉ trích xuất hàm (test/vm). */

export async function aiFillMissingVi() {
  const rows = typingSessionState.rows, uid = currentUser()?.id;
  const active = () => rows === typingSessionState.rows && uid === currentUser()?.id;
  const idxs = [];
  for (let i = 0; i < typingSessionState.rows.length; i++) {
    const r = typingSessionState.rows[i];
    if (!r.vi && r.zh && r.zh !== '—' && !aiSessionState._viFillTried.has(r.zh)) {
      aiSessionState._viFillTried.add(r.zh);
      idxs.push(i);
    }
  }
  for (const i of idxs) {
    if (!active()) return;
    try {
      const tr = await fetchViTranslation(rows[i].zh);
      if (!active()) return;
      if (tr) rows[i].vi = tr;
    } catch (e) {
      if (!active()) return;
      /* Hết hạn mức MyMemory / mất mạng → báo rõ 1 lần, không im lặng như trước */
      if (!aiSessionState._viFillWarned) {
        aiSessionState._viFillWarned = true;
        toast('Không tra được nghĩa online (hết hạn mức MyMemory hoặc mất mạng) — nghĩa một số câu sẽ để trống.', 'warn', 6000);
      }
    }
    try {
      if (typingSessionState.order[typingSessionState.index] === i) {
        // đang hiển thị đúng câu này → cập nhật dòng nghĩa
        const el = domState.$('vietnamese');
        if (el) el.textContent = typingSessionState.rows[i].vi || '—';
      }
    } catch (e) {}
  }
}
/* ★ FIX: Cập nhật nhẹ nhàng khi có câu AI mới — KHÔNG hề đụng vào ô nhập
   hay câu hỏi đang làm. Trước đây chỗ này gọi render() nên bị xoá nội dung
   đang gõ dở và quay về đầu câu.
   wasWaiting: true nếu TRƯỚC khi thêm câu người dùng đang ở màn chờ
   ("AI đang viết câu tiếp theo") — khi đó mới cần render() để vào học câu mới. */

/* ★ FIX: Cập nhật nhẹ nhàng khi có câu AI mới — KHÔNG hề đụng vào ô nhập
   hay câu hỏi đang làm. Trước đây chỗ này gọi render() nên bị xoá nội dung
   đang gõ dở và quay về đầu câu.
   wasWaiting: true nếu TRƯỚC khi thêm câu người dùng đang ở màn chờ
   ("AI đang viết câu tiếp theo") — khi đó mới cần render() để vào học câu mới. */
export function aiRefreshAfterAppend(wasWaiting) {
  renderStatsOnly(); // chỉ thanh tiến độ + số liệu
  // Cập nhật dòng thông tin phiên (số câu AI đã tạo)
  if (aiSessionLive()) {
    domState.$('fileInfo').textContent = aiSavedSet() ? '🤖 ' + aiSavedSet().name + ' • ' + typingSessionState.rows.length + ' ' + aiCurrentUnit() + ' • đã lưu' : '🤖 ' + String(aiSessionState.aiSession.prompt).slice(0, 60) + ' • ' + typingSessionState.rows.length + ' ' + aiCurrentUnit() + ' (không lưu tiến độ)';
  }
  if (wasWaiting || typingSessionState.index >= typingSessionState.order.length) {
    // Đang ở màn "AI đang viết câu tiếp theo..." → giờ đã có câu mới, vào học luôn
    render();
    return;
  }
  /* ★ Người dùng đang gõ dở bằng IME (composition) → TUYỆT ĐỐI không đụng vào
     ô gõ. Việc AI viết thêm nội dung ở chế độ nền không được phép làm rối
     những gì người dùng đang gõ. */
  if (typingSessionState.composing) return;
  // Đang làm dở 1 câu → TUYỆT ĐỐI không render lại câu, giữ nguyên nội dung đã gõ.
  if (!typingSessionState.awaitingEnter) updateChineseHighlight();
}
/* ★ AI tự viết thêm khi sắp hết — không giới hạn số lượng */

/* ★ AI tự viết thêm khi sắp hết — không giới hạn số lượng */
export async function aiMaybeFill() {
  const s = aiSessionState.aiSession;
  if (!s || !aiTypingVisible(s) || s.paused || s.stopped || s.pending) return;
  if (typingSessionState.order.length - typingSessionState.index >= 3) return; // còn đủ mục chưa cần gọi AI
  s.pending++;
  setMascot('aiMascot', 'thinking');
  const unit = aiUnitOf(s.kind);
  // ★ Ghi nhớ TRƯỚC khi thêm: người dùng có đang ở màn chờ mục mới không?
  const wasWaiting = typingSessionState.index >= typingSessionState.order.length;
  const navigation = navigationVersion(), epoch = s.epoch || 0;
  const active = () => aiTypingVisible(s) && !s.paused && epoch === (s.epoch || 0) && navigation === navigationVersion();
  // ★ Không hiện thanh "AI đang viết..." đè lên khi người dùng đang gõ dở,
  //   chỉ hiện khi đang thực sự chờ mục mới.
  if (wasWaiting) aiShowGen('<span class="aiSpinner">AI đang viết ' + unit + ' tiếp theo…</span> (đã có <b>' + typingSessionState.rows.length + '</b> ' + unit + ')');
  if (wasWaiting && !domState.$('completeArea')?.classList.contains('hidden')) render();
  try {
    const res = await aiCollect(s.provider, s.key, s.prompt, s.batch, s.level, s.seen, null, s.kind, active);
    if (!active()) return;
    if (res.items.length) {
      aiAppendRows(res.items);
      s.empty = 0;
    }
    if (res.error || !res.items.length) {
      s.stopped = true;
      s.error = res.error || new Error(res.stopped || 'AI chưa tạo được nội dung mới. Bấm Thử lại hoặc đổi chủ đề.');
      s.retryAt = s.error.retryAt || 0;
    }
    if (res.items.length) aiRefreshAfterAppend(wasWaiting);
  } catch (e) {
    if (!active()) return;
    s.stopped = true;
    s.error = e;
    s.retryAt = e.retryAt || 0;
  } finally {
    s.pending--;
    // A mode switch can finish before its old request. Start the new epoch only
    // once that request has released its pending slot.
    if (!active() && aiTypingVisible(s) && !s.paused && !s.stopped && !s.pending) void aiMaybeFill();
  }
  if (!active()) return;
  setMascot('aiMascot', s.stopped ? 'encourage' : 'ready');
  if (s.stopped) aiShowSessionError(); else aiShowGen('');
}
/* ★ Bắt đầu học: viết prompt → AI viết đợt đầu → học ngay */

/* ★ Bắt đầu học: viết prompt → AI viết đợt đầu → học ngay */
export async function aiStartStudy() {
  aiEndSession();
  const navigation = markNavigation(), requestId = ++aiRequestId;
  if (!await requireAccount(() => aiStartStudy())) return;
  if (navigation !== navigationVersion()) return;
  const accountId = currentUser().id;
  const shared = !!aiProxyUrl();
  const provider = shared ? aiProvidersState.AI_DEFAULT_PROVIDER : domState.$('aiProvider').value;
  const key = shared ? '' : domState.$('aiKey').value.trim();
  const prompt = domState.$('aiPrompt').value.trim();
  if (!prompt) {
    toast('Hãy viết chủ đề bạn muốn học.', 'warn');
    domState.$('aiPrompt').focus();
    return;
  }
  const level = domState.$('aiLevel').value;
  const batch = Math.max(1, Math.min(20, Number(domState.$('aiBatch').value) || 5));
  const kind = aiClientState.AI_KINDS[domState.$('aiKind') && domState.$('aiKind').value] ? domState.$('aiKind').value : 'sentence';
  const unit = aiUnitOf(kind);
  const btn = domState.$('aiStartBtn');
  /* ★ CHƯA có API key → mở sẵn "Tuỳ chọn nâng cao", focus ô key, chỉ đúng nút lấy key
     (nhiều người không biết API key lấy ở đâu). */
  if (!key && !aiProxyUrl()) {
    const d = document.querySelector('.aiDetails');
    if (d) d.open = true;
    const kEl = domState.$('aiKey');
    if (kEl) kEl.focus();
    const cfg = aiProvidersState.AI_PROVIDERS[provider] || aiProvidersState.AI_PROVIDERS[aiProvidersState.AI_DEFAULT_PROVIDER];
    aiSetStatus('⚠️ Bạn chưa có <b>API key ' + cfg.name + '</b>. Bấm <b>“' + cfg.keyBtn + '”</b> → tạo và sao chép key rồi dán vào ô “API key”, sau đó bấm “học ngay” lại.', 'err');
    toast('Chưa có API key ' + cfg.name + ' — bấm nút “' + cfg.keyBtn + '” để lấy key.', 'warn', 7000);
    return;
  }
  aiLsSet(aiProvidersState.AI_PROV_KEY, provider);
  aiSetStatus('');
  if (!aiProxyUrl()) aiKeyStore(provider, key);
  if (btn) {
    btn.disabled = true;
    btn.setAttribute('aria-busy', 'true');
    btn.textContent = 'Đang tạo ' + unit + '…';
  }
  setMascot('aiMascot', 'thinking', { animate: true, eventKey: 'ai-request:' + requestId });
  aiValidationState.aiVerifyFixedCount = 0; // đếm riêng số nghĩa được soát lại trong lần này
  aiSessionState.aiSession = {
    prompt: prompt,
    level: level,
    provider: provider,
    key: key,
    batch: batch,
    kind: kind,
    seen: new Set(),
    pending: 0,
    stopped: false,
    empty: 0,
    generated: 0,
    navigation,
    accountId,
    live: true
  };
  const session = aiSessionState.aiSession;
  const active = () => session === aiSessionState.aiSession && session.live && navigation === navigationVersion() && currentUser()?.id === accountId;
  const ownConfirm = (...args) => ownedDialog(session, appConfirm(...args));
  const ownPrompt = (...args) => ownedDialog(session, appPrompt(...args));
  try {
    const res = await aiCollect(provider, key, prompt, batch, level, session.seen, null, kind, active);
    if (!active()) return;
    if (!res.items.length) throw new Error(res.stopped || 'AI chưa trả về ' + unit + ' nào cho chủ đề này.');
    if (res.error) { session.stopped = true; session.error = res.error; session.retryAt = res.error.retryAt || 0; }
    setMascot('aiMascot', 'ready');

    /* ★ HỎI LƯU NGAY SAU KHI TẠO — trước khi vào học.
       · "Lưu lại"     → đặt tên → ghi vào thư viện → học tiếp lần sau đúng câu đang dở.
       · "Không lưu"   → học tạm như cũ, KHÔNG ghi gì; thoát ra là mất. */
    const wantSave = await ownConfirm('AI đã tạo ' + res.items.length + ' ' + unit + ' cho chủ đề “' + String(prompt).slice(0, 70) + '”.\n\n' + 'Lưu lại để lần sau vào học tiếp đúng chỗ bạn đang dở?\n' + 'Nếu chọn “Không lưu”, bộ này chỉ dùng tạm lần này — thoát ra là hết.', {
      title: '💾 Lưu bộ này?',
      okText: '💾 Lưu lại',
      cancelText: 'Không lưu'
    });
    if (!active()) return;
    let ds = null;
    if (wantSave) {
      const defName = String(prompt).replace(/\s+/g, ' ').trim().slice(0, 48) || 'Bộ ' + unit + ' AI';
      const name = await ownPrompt('Đặt tên cho bộ ' + unit + ' để dễ tìm lại trong “Bộ AI đã lưu”:', defName, {
        title: 'Đặt tên bộ ' + unit,
        okText: 'Lưu bộ ' + unit
      });
      if (!active()) return;
      if (!name) {
        /* Huỷ ở bước đặt tên → coi như KHÔNG lưu (không tạo rác trong thư viện) */
        toast('Chưa đặt tên nên bộ ' + unit + ' này chỉ học tạm lần này.', 'warn', 4200);
      } else {
        ds = {
          id: 'ai:' + Date.now(),
          name: name.slice(0, 80),
          sourceName: 'Học bằng AI',
          kind: 'ai',
          contentType: kind,
          prompt: String(prompt),
          level: level,
          provider,
          batch,
          rows: [],
          createdAt: Date.now(),
          updatedAt: Date.now()
        };
      }
    }

    if (!active()) return;
    // → vào học ngay
    typingSessionState.activeDataset = null;
    typingSessionState.reviewById = {};
    typingSessionState.rows = [];
    typingSessionState.order = [];
    typingSessionState.mainOrder = [];
    typingSessionState.mainIndex = 0;
    typingSessionState.index = 0;
    typingSessionState.mode = 'all';
    typingSessionState.wrongIds = new Set();
    typingSessionState.stats = {
      correct: 0,
      wrong: 0,
      combo: 0,
      bestCombo: 0,
      attempts: 0
    };
    typingSessionState.pinyinHint = false; // ★ mới vào chế độ gỗ → pinyin luôn ẩn, muốn xem thì bật
    if (ds) {
      /* rows trỏ thẳng vào ds.rows → nội dung AI viết thêm sau này tự nằm trong bộ đã lưu */
      typingSessionState.activeDataset = ds;
      typingSessionState.rows = ds.rows;
      typingSessionState.currentFileKey = progressKey(ds.id);
      typingSessionState.mainOrder = [];
      typingSessionState.mainIndex = 0;
      typingSessionState.index = 0;
    }
    aiAppendRows(res.items);
    session.rows = typingSessionState.rows;
    /* ★ Nói rõ cho người dùng biết đã soát lại nghĩa (không im lặng sửa) */
    if (aiValidationState.aiVerifyFixedCount > 0) {
      toast('🔍 Đã soát lại và sửa ' + aiValidationState.aiVerifyFixedCount + ' nghĩa tiếng Việt chưa sát với chữ Hán.', 'warn', 6000);
    }
    if (ds) {
      ds.rows = typingSessionState.rows;
      ds.updatedAt = Date.now();
      if (!active()) return;
      await dbPut(ds);
      if (!active()) return;
      toast('💾 Đã lưu “' + ds.name + '” (' + typingSessionState.rows.length + ' ' + unit + ') — lần sau vào là học tiếp đúng chỗ đang dở.', 'ok', 5200);
      try {
        if (typeof legacy.renderAiSets === 'function') legacy.renderAiSets();
      } catch (e) {}
    } else {
      toast('Đã có ' + res.items.length + ' ' + unit + ' — AI sẽ tự viết thêm khi bạn học gần hết.', 'ok', 5500);
    }
    domState.$('libraryCard').classList.add('hidden');
    domState.$('aiCard')?.classList.add('hidden');
    domState.$('appCard').classList.remove('hidden');
    domState.$('backLibrary').classList.add('hidden');
    document.body.classList.add('studyFit');
    try {
      fillAppSource();
    } catch (e) {}
    typingSessionState.studyOrigin = 'ai';
    updateSoundUI();
    updateViUI();
    updateHanUI();
    updateModeUI();
    aiShowGen('');
    // Mục lỗi định dạng đã được lọc IM LẶNG (aiItemOk) — không báo cho người dùng
    render();
    if (session.stopped) aiShowSessionError();
    loadHistory();
    renderAppHistory();
    if (ds) writeRoute('study', ds.id);
  } catch (e) {
    if (!active()) return;
    aiSessionState.aiSession = null;
    aiShowGen('⚠️ ' + escapeHtml(e.message) + ' — sửa lại rồi bấm “học ngay” lần nữa.', 'err');
    aiSetStatus('⚠️ ' + escapeHtml(e.message), 'err');
    const status = domState.$('aiStatus');
    const retry = document.createElement('button');
    retry.type = 'button'; retry.className = 'miniBtn'; retry.textContent = 'Thử lại';
    retry.onclick = () => {
      if (e.retryAt > Date.now()) { toast('Đợi thêm ' + Math.ceil((e.retryAt - Date.now()) / 1000) + ' giây rồi thử lại.', 'warn'); return; }
      aiStartStudy();
    };
    status?.append(' ', retry);
    toast('Không tạo được ' + unit + ': ' + e.message, 'bad', 6500);
  } finally {
    if (btn && requestId === aiRequestId) {
      btn.disabled = false;
      btn.removeAttribute('aria-busy');
      btn.textContent = aiStartLabel();
    }
  }
}
/* ★ Kết thúc phiên AI — không có gì để lưu */

/* ★ Kết thúc phiên AI — không có gì để lưu */
export function aiEndSession() {
  aiRequestId++;
  const session = aiSessionState.aiSession;
  if (session) {
    session.live = false;
    if (session.dialog && modalState._modalResolve === session.dialog) _modalClose(null);
  }
  aiSessionState.aiSession = null;
  aiShowGen('');
  setMascot('aiMascot', 'ready');
  const button = domState.$('aiStartBtn');
  if (button) { button.disabled = false; button.removeAttribute('aria-busy'); button.textContent = aiStartLabel(); }
}

export function aiSessionLive() {
  return !!(aiSessionState.aiSession && aiSessionState.aiSession.live);
}
/* ★ LOẠI NỘI DUNG AI SINH RA:
   · sentence = câu hoàn chỉnh (mặc định, hành vi cũ)
   · word     = TỪ / CỤM TỪ (từ vựng) — không phải câu dài
   · both     = nửa từ vựng + nửa câu, cùng chủ đề
   unit dùng cho mọi nhãn đếm ("5 câu" / "5 từ" / "5 mục"). */

export function initializeAiSession() {
  document.addEventListener('gp:typing-opened', aiResumeSavedSet);
  document.addEventListener('gp:view-leaving', pauseAiGeneration);
  document.addEventListener('gp:view-changed', event => { if (event.detail === 'study') resumeAiGeneration(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden) pauseAiGeneration(); else resumeAiGeneration(); });
  /* ═══════════════════════════════════════════════════════════
     ★ AI SINH CÂU — VIẾT PROMPT → HỌC NGAY
     • AI viết đợt câu đầu, bạn học luôn.
     • Sắp hết câu thì AI TỰ viết tiếp — không giới hạn số lượng.
     • Câu mới KHÔNG BAO GIỜ lặp câu cú (tập seen trong cùng phiên).
     • Phiên học KHÔNG lưu tiến độ: bấm "← Thư viện" là xong.
     ═══════════════════════════════════════════════════════════ */
  aiSessionState.aiSession = null;
  /* ★ AI đôi khi không trả nghĩa tiếng Việt (hoặc đặt sai tên trường) → tự dịch nền
     bằng MyMemory (có cache localStorage), cập nhật YÊN LẶNG — không đụng
     vào ô nhập hay câu đang gõ dở.
     ★ Tra nghĩa online: luôn bật, gọi thẳng MyMemory qua HTTPS. */
  /* ★ Khai báo SỚM (trước aiFillMissingVi) để mọi hàm dùng đều thấy giá trị —
       tránh lỗi "gtOnline is not defined" (temporal dead zone) khi hàm được
       gọi trong ngữ cảnh chỉ trích xuất hàm (test/vm). */
  aiSessionState.gtOnline = true;
  aiSessionState._viFillTried = new Set();
  aiSessionState._viFillWarned = false;
}
