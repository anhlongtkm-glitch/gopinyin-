import { requireAccount } from "../auth/service.js";
import { markNavigation, navigationVersion } from "../../app/routes.js";
// State and behavior owned by features/pronunciation/library. Initialization is orchestrated by app/bootstrap.js.

import { legacy } from "../../app/compatibility.js";

import { state as pronunciationControllerState } from "./controller.js";

import { state as pronunciationRepositoryState } from "./repository.js";

import { state as pronunciationSessionState } from "./session.js";

import { loadSource, syncToolbar } from "./settings.js";

import { state as pronunciationStorageState } from "./storage.js";

import { esc, state as pronunciationUtilsState } from "./utils.js";

/* ═══════════════════════════════════════════════════════════
   Màn CHỌN BỘ CÂU — vào đây trước, chọn cấp rồi mới luyện
   (giống luồng của màn Luyện gõ, để người dùng không bị ném thẳng
   vào một bộ câu ngẫu nhiên)
   ═══════════════════════════════════════════════════════════ */
export function libStats(id) {
  if (!pronunciationStorageState.PronStore || !pronunciationRepositoryState.PronRepo) return {attempted:0,good:0,index:0};
  const p = pronunciationStorageState.PronStore.load(pronunciationRepositoryState.PronRepo.keyOf(id));
  let attempted = 0,
    good = 0;
  for (const k in p.byId) {
    const r = p.byId[k];
    if (!r || !r.n) continue;
    attempted++;
    if ((r.best || 0) >= pronunciationSessionState.GOOD) good++;
  }
  return {
    attempted,
    good,
    index: p.index || 0
  };
}

/* ★ Thẻ cấp HSK: tiến độ LUYỆN NÓI (x/N + % + số câu đạt) hiện ngay trên thẻ.
   Chưa nói câu nào nhưng đã GÕ ở màn Luyện gõ → hiện tiến độ gõ (thanh xám)
   để người dùng vẫn thấy mình đã học tới đâu — thay cho khối
   "📖 Bộ câu của bạn (đã học)" đã bỏ. */

/* ★ Thẻ cấp HSK: tiến độ LUYỆN NÓI (x/N + % + số câu đạt) hiện ngay trên thẻ.
   Chưa nói câu nào nhưng đã GÕ ở màn Luyện gõ → hiện tiến độ gõ (thanh xám)
   để người dùng vẫn thấy mình đã học tới đâu — thay cho khối
   "📖 Bộ câu của bạn (đã học)" đã bỏ. */
export function libCardHtml(x) {
  const s = libStats(x.id);
  const attempted = s.attempted;
  const done = x.done || 0;
  const pct = x.count ? Math.round(100 * (attempted || done) / x.count) : 0;
  /* thanh 5px: 1/301 vẫn phải thấy một vạch nhỏ */
  const w = (attempted || done) > 0 ? Math.max(pct, 2) : 0;
  const typedOnly = !attempted && done > 0;
  let meta;
  if (attempted) meta = attempted + '/' + x.count + ' đã luyện · <b>' + s.good + '</b> đạt';else if (typedOnly) meta = 'Đã gõ ' + done + '/' + x.count + ' · chưa luyện nói';else meta = 'Chưa luyện câu nào';
  return '<button class="vocabCard' + '" type="button" data-psrc="' + esc(x.id) + '"' + ' title="' + esc('Luyện nói ' + x.name + ' · ' + x.count + ' câu' + (done ? ' · đã gõ ' + done + '/' + x.count : '')) + '">' + '<span class="vocabCard-title">' + esc(x.name) + '</span>' + '<span class="vocabCount">' + x.count + ' câu</span>' + '<span class="vocabProg' + (typedOnly ? ' isType' : '') + '"><i style="width:' + w + '%"></i></span>' + '<span class="vocabMeta">' + meta + '</span>' + '</button>';
}

export async function renderLib() {
  const hskHost = pronunciationUtilsState.$('pronLibHsk');
  const cat = await pronunciationRepositoryState.PronRepo.catalog();
  pronunciationSessionState.S.catalog = cat;
  if (hskHost) {
    hskHost.innerHTML = cat.hsk.length ? cat.hsk.map(libCardHtml).join('') : '<div class="vocabEmpty">Chưa nạp được dữ liệu HSK.</div>';
  }
  /* ★ Đã bỏ "📖 Bộ câu của bạn (đã học)" và "📖 Các câu đã làm": tiến độ
     (luyện nói + đã gõ) giờ hiện ngay trên từng thẻ HSK ở trên.
     Đã bỏ nút "Học tiếp bộ đang mở": kho câu dùng chung nhưng TIẾN ĐỘ
     luyện nói TÁCH RIÊNG khỏi Luyện gõ, nên người dùng chọn bộ ngay tại đây. */
}

export async function startSource(srcId, options = {}) {
  const navigation = markNavigation();
  if (!await requireAccount(() => startSource(srcId, options))) return;
  if (navigation !== navigationVersion()) return;
  if (!srcId) return;
  pronunciationControllerState.Pron.leave();
  if (srcId.startsWith('hsk:')) {
    const lvl = Number(srcId.slice(4).replace(/[^0-9]/g, '')) || 0;
  }
  if (!await loadSource(srcId)) return;
  pronunciationSessionState.S.lastSource = srcId;
  syncToolbar();
  if (typeof legacy.showView === 'function') {
    try {
      await legacy.showView('pronStudy', { navigation, preserveStudy:options.preserveStudy });
      return;
    } catch (e) {}
  }
  pronunciationControllerState.Pron.open();
}

/* ═══════════════════════════════════════════════════════════
   Gắn sự kiện
   ═══════════════════════════════════════════════════════════ */
