// State and behavior owned by features/pronunciation/render. Initialization is orchestrated by app/bootstrap.js.

import { currentItem } from "./lesson.js";
import { navigationVersion } from "../../app/routes.js";
import { setMascot, renderVisibleMascots } from "../../shared/mascot.js";
import { studyOverlayOpen, ensureStudyControlVisible, scheduleStudyControlReveal } from "../../shared/study/interactions.js";

import { state as pronunciationRepositoryState } from "./repository.js";

import { state as pronunciationSessionState } from "./session.js";

import { state as pronunciationUtilsState, hanChars, isHan, esc, clamp, toneOf } from "./utils.js";

/* ═══════════════════════════════════════════════════════════
   Vẽ — thống kê
   ═══════════════════════════════════════════════════════════ */
export function stats() {
  const total = pronunciationSessionState.S.items.length;
  const byId = pronunciationSessionState.S.progress && pronunciationSessionState.S.progress.byId || {};
  let attempted = 0,
    good = 0,
    sumBest = 0,
    nBest = 0;
  for (const it of pronunciationSessionState.S.items) {
    const r = byId[it.id];
    if (!r || !r.n) continue;
    attempted++;
    sumBest += r.best || 0;
    nBest++;
    if ((r.best || 0) >= pronunciationSessionState.GOOD) good++;
  }
  const recent = pronunciationSessionState.S.progress && pronunciationSessionState.S.progress.recent || [];
  let streak = 0;
  for (let i = recent.length - 1; i >= 0; i--) {
    if (recent[i].good) streak++;else break;
  }
  return {
    total,
    attempted,
    good,
    need: Math.max(0, attempted - good),
    avg: nBest ? Math.round(sumBest / nBest) : 0,
    streak,
    tries: pronunciationSessionState.S.sessionTries
  };
}

export function renderStats() {
  const s = stats();
  const set = (id, v) => {
    const el = pronunciationUtilsState.$(id);
    if (el) el.textContent = v;
  };
  set('pronProg', s.attempted + '/' + s.total);
  set('pronGood', s.good);
  set('pronNeed', s.need);
  set('pronStreak', s.streak);
  set('pronAvg', s.attempted ? s.avg : '—');
  set('pronTries', s.tries);
  const bar = pronunciationUtilsState.$('pronBar');
  if (bar) bar.style.width = (s.total ? 100 * s.attempted / s.total : 0) + '%';
  const info = pronunciationUtilsState.$('pronInfo');
  if (info) {
    const src = (pronunciationSessionState.S.sources.find(x => x.id === pronunciationSessionState.S.source) || {}).label || '';
    info.textContent = src + ' • ' + s.total + ' câu • đã luyện ' + s.attempted + ' • đạt mục tiêu ' + s.good + ' (ngưỡng ' + pronunciationSessionState.GOOD + '/100)';
  }
}

/* ═══════════════════════════════════════════════════════════
   Vẽ — thẻ câu
   ═══════════════════════════════════════════════════════════ */

/* ═══════════════════════════════════════════════════════════
   Vẽ — thẻ câu
   ═══════════════════════════════════════════════════════════ */
export function renderCard() {
  const it = currentItem();
  const area = pronunciationUtilsState.$('pronArea'),
    comp = pronunciationUtilsState.$('pronComplete');
  if (!area) return;
  if (!it) {
    area.classList.add('hidden');
    if (comp) comp.classList.remove('hidden');
    renderComplete();
    return;
  }
  area.classList.remove('hidden');
  const foot = pronunciationUtilsState.$('pronCard')?.querySelector('.studyFoot');
  if (foot) foot.hidden = false;
  if (comp) comp.classList.add('hidden');
  const viLine = pronunciationUtilsState.$('pronViLine'),
    hanLine = pronunciationUtilsState.$('pronHanLine'),
    pyLine = pronunciationUtilsState.$('pronPyLine');
  if (viLine) viLine.classList.toggle('hidden', !pronunciationSessionState.S.settings.showVi);
  if (hanLine) hanLine.classList.toggle('hidden', !pronunciationSessionState.S.settings.showHan && !pronunciationSessionState.S.settings.showPy);
  const syllables = pronunciationRepositoryState.PronRepo.syllables(it);
  const alignedPinyin = syllables.length > 0 && syllables.every(Boolean);
  // Invalid source readings stay phrase-level instead of being assigned to
  // unrelated characters. Normal content keeps one reading beneath each glyph.
  if (pyLine) pyLine.classList.toggle('hidden', alignedPinyin || !it.py || !pronunciationSessionState.S.settings.showPy);
  const vi = pronunciationUtilsState.$('pronVi');
  if (vi) vi.textContent = it.vi || '—';
  renderHanzi();
  const py = pronunciationUtilsState.$('pronPy');
  if (py) py.textContent = alignedPinyin ? it.py || '' : 'Phiên âm theo cụm: ' + (it.py || '');
  if (pronunciationSessionState.S.phase === 'idle' && !pronunciationSessionState.S.result) setMascot('pronStudyMascot', 'reading');
  renderVisibleMascots();
  updateMicLabel();
  const navigation = navigationVersion(), activeBefore = document.activeElement;
  requestAnimationFrame(() => {
    if (navigation !== navigationVersion() || it !== currentItem() || studyOverlayOpen() || document.getElementById('pronSettings')?.open || document.activeElement !== activeBefore) return;
    ensureStudyControlVisible(pronunciationUtilsState.$('pronMicBtn'));
  });
}

/* Chữ Hán từng chữ — bấm vào để xem chi tiết.
   Tách phần sinh HTML ra khỏi DOM để kiểm thử được bố cục (pinyin có bị
   gạch chân đè lên không, dấu câu có đứng đúng hàng chân chữ không). */

/* Chữ Hán từng chữ — bấm vào để xem chi tiết.
   Tách phần sinh HTML ra khỏi DOM để kiểm thử được bố cục (pinyin có bị
   gạch chân đè lên không, dấu câu có đứng đúng hàng chân chữ không). */
export function hanziHtml(zh, statusOf) {
  const chars = hanChars(zh);
  const it = currentItem();
  const syl = it && String(it.zh) === String(zh) ? pronunciationRepositoryState.PronRepo.syllables(it) : [];
  let out = '';
  let hi = 0;
  for (const ch of Array.from(String(zh || ''))) {
    /* ★ Dấu câu dùng CHUNG khung 3 dòng với chữ Hán, không còn là span rời
       bị align-items:flex-end đẩy xuống hàng chấm (dấu "。" từng trông như
       một chấm trạng thái lạc ở cuối câu). */
    if (!isHan(ch)) {
      if (/\s/.test(ch)) {
        out += '<span class="pronSpace" aria-hidden="true"></span>';
        continue;
      }
      out += '<span class="pronChar is-punct" aria-hidden="true">' + '<span class="pronCharGlyph">' + esc(ch) + '</span>' + '<span class="pronCharPy"></span>' + '<span class="pronCharDot"></span>' + '</span>';
      continue;
    }
    const c = (statusOf || {})[hi] || null;
    const st = c ? c.status : 'idle';
    const py = syl[hi] || '';
    const label = st === 'good' ? 'tốt' : st === 'warn' ? 'cần chú ý' : st === 'bad' ? 'chưa tốt' : st === 'unknown' ? 'chưa đánh giá' : 'chưa luyện';
    const visibleParts = [];
    if (pronunciationSessionState.S?.settings?.showHan !== false) visibleParts.push(ch);
    if (pronunciationSessionState.S?.settings?.showPy !== false && py) visibleParts.push(py);
    const accessibleLabel = visibleParts.concat(label).join(' · ');
    out += '<button type="button" class="pronChar st-' + st + '" data-ci="' + hi + '"' + ' title="' + esc(accessibleLabel) + '"' + ' aria-label="' + esc(accessibleLabel) + '">' + '<span class="pronCharGlyph">' + esc(ch) + '</span>' + '<span class="pronCharPy">' + esc(py) + '</span>' + '<span class="pronCharDot" aria-hidden="true"></span>' + '</button>';
    hi++;
  }
  return out;
}

export function renderHanzi() {
  const it = currentItem();
  const host = pronunciationUtilsState.$('pronHanzi');
  if (!host || !it) return;
  host.classList.toggle('pron-hide-han', !pronunciationSessionState.S.settings.showHan);
  host.classList.toggle('pron-hide-py', !pronunciationSessionState.S.settings.showPy);
  const statusOf = {};
  if (pronunciationSessionState.S.result && pronunciationSessionState.S.result.chars) for (const c of pronunciationSessionState.S.result.chars) statusOf[c.i] = c;
  host.innerHTML = hanziHtml(it.zh, statusOf) || '<span class="pronPunct">—</span>';
}

export function updateMicLabel() {
  const btn = pronunciationUtilsState.$('pronMicBtn');
  if (!btn) return;
  if (['recording', 'analyzing', 'requesting', 'starting'].includes(pronunciationSessionState.S.phase)) return;
  const txt = btn.querySelector('.pronMicTxt');
  const sub = btn.querySelector('.pronMicSub');
  if (txt) txt.textContent = pronunciationSessionState.S.result ? 'Nhấn để nói lại' : 'Nhấn để bắt đầu nói';
  btn.setAttribute('aria-label', pronunciationSessionState.S.result ? 'Nói lại câu này' : 'Bắt đầu nói');
  if (sub) sub.innerHTML = 'hoặc nhấn <kbd>Enter</kbd>';
}

/* ═══════════════════════════════════════════════════════════
   Vẽ — kết quả
   ═══════════════════════════════════════════════════════════ */

/* ═══════════════════════════════════════════════════════════
   Vẽ — kết quả
   ═══════════════════════════════════════════════════════════ */
export function verdict(score) {
  if (score >= 90) return {
    t: 'Rất tốt',
    cls: 'ok'
  };
  if (score >= pronunciationSessionState.GOOD) return {
    t: 'Khá tốt',
    cls: 'ok'
  };
  if (score >= 50) return {
    t: 'Cần luyện thêm',
    cls: 'warn'
  };
  return {
    t: 'Chưa khớp',
    cls: 'bad'
  };
}

export function renderResult() {
  const host = pronunciationUtilsState.$('pronResult');
  if (!host) return;
  const r = pronunciationSessionState.S.result;
  /* Có kết quả → thẻ câu thu về 1 cột trái, phân tích sang cột phải
     (trên máy tính). Nhờ vậy KHÔNG phải cuộn xuống mới thấy điểm. */
  const area = pronunciationUtilsState.$('pronArea');
  if (area) area.classList.toggle('has-result', !!r);
  if (!r) {
    host.classList.add('hidden');
    host.innerHTML = '';
    return;
  }
  host.classList.remove('hidden');
  const v = verdict(r.score);
  const isPron = r.scoreKind === 'pron';
  const label = isPron ? 'Điểm phát âm' : 'Độ khớp nội dung';
  const confPct = r.confidence == null ? null : Math.round(r.confidence * 100);
  let chips = '<span class="pronChip ok">Khớp ' + r.matched + '/' + r.total + ' chữ</span>';
  if (confPct != null) chips += '<span class="pronChip">Độ tin cậy ' + confPct + '%</span>';
  if (isPron && r.accuracy != null) chips += '<span class="pronChip">Chính xác ' + r.accuracy + '</span>';
  if (isPron && r.fluency != null) chips += '<span class="pronChip">Trôi chảy ' + r.fluency + '</span>';
  if (!isPron && r.extra) chips += '<span class="pronChip warn">Thêm ' + r.extra + ' âm</span>';
  const badN = r.chars.filter(c => c.status === 'bad').length;
  if (badN) chips += '<span class="pronChip bad">' + badN + ' chữ cần sửa</span>';
  const errHtml = r.errors.length ? '<ul class="pronErrList">' + r.errors.map(e => '<li><b>' + esc(e.label) + '</b>' + (e.count > 1 ? ' ×' + e.count : '') + '</li>').join('') + '</ul>' : '';
  const noteHtml = r.notes.length ? '<div class="pronNote">' + r.notes.map(n => '<div>' + esc(n) + '</div>').join('') + '</div>' : '';
  const honest = isPron ? '<div class="pronHonest">✅ Điểm này do dịch vụ chấm phát âm chuyên dụng trả về (theo âm tiết).</div>' : '<div class="pronHonest">ℹ️ Đây là <b>đánh giá sơ bộ độ khớp nội dung</b> dựa trên nhận dạng giọng nói — <b>không phải</b> điểm phát âm chuyên dụng. Hệ thống chưa thể chấm thanh điệu hay khẩu hình khi chỉ có văn bản nhận dạng.</div>';
  host.innerHTML = '<div class="pronScoreWrap">' + '<div class="pronRing ' + v.cls + '" style="--p:' + clamp(r.score, 0, 100) + '">' + '<div class="pronRingIn"><b>' + r.score + '</b><span>/100</span></div></div>' + '<div class="pronScoreMeta">' + '<div class="pronScoreTitle ' + v.cls + '">' + v.t + ' <small>· ' + label + '</small></div>' + '<div class="pronChips">' + chips + '</div>' + '<div class="pronHeard">Hệ thống nghe được: <b>' + (r.transcript ? esc(r.transcript) : '—') + '</b></div>' + noteHtml + '</div></div>' + (errHtml ? '<div class="pronErrBlock"><span class="pronErrTitle">Lỗi phát hiện được</span>' + errHtml + '</div>' : '') + '<div class="pronLegend">' + '<span><i class="lg-good"></i>Phát âm tốt</span>' + '<span><i class="lg-warn"></i>Cần chú ý</span>' + '<span><i class="lg-bad"></i>Chưa tốt</span>' + '<span><i class="lg-unknown"></i>Chưa đủ dữ liệu</span>' + '</div>' + honest;
  /* ★ KHÔNG lặp lại nút điều hướng ở đây: thanh nút ngay dưới thẻ đã có
     "Câu trước / Nói lại / Bỏ qua / Câu tiếp" — hai bộ nút cùng chức năng
     sẽ gây rối (yêu cầu thiết kế). */
  if (!isPron && pronunciationSessionState.S.serverAssess?.ok === false) {
    host.insertAdjacentHTML('beforeend', '<div class="pronNote" role="status">' + esc(pronunciationSessionState.S.serverAssess.note) + ' <button type="button" class="btn secondary" data-pron-service-retry>Thử dịch vụ lại và nói lại</button></div>');
  }

  setMascot('pronStudyMascot', r.score >= pronunciationSessionState.GOOD ? 'clap' : 'encourage', {animate:true,eventKey:'result:' + pronunciationSessionState.S.startedAt + ':' + pronunciationSessionState.S.sessionTries});

  /* Kết quả nằm dưới thẻ câu → cuộn tới để người dùng THẤY ngay,
     không phải tự mò xuống (chỉ cuộn khi chưa hiện đủ trong màn hình). */
  const navigation = navigationVersion(), item = currentItem();
  if (window.matchMedia('(max-width:860px)').matches) {
    scheduleStudyControlReveal('pronNextBtn', () => navigation === navigationVersion()
      && item === currentItem() && r === pronunciationSessionState.S.result
      && pronunciationSessionState.S.phase === 'result');
    return;
  }
  const activeBefore = document.activeElement, scrollBefore = window.scrollY;
  setTimeout(() => {
    if (navigation !== navigationVersion() || item !== currentItem() || r !== pronunciationSessionState.S.result || studyOverlayOpen()) return;
    if (!host.getClientRects().length || activeBefore !== document.activeElement || Math.abs(window.scrollY - scrollBefore) > 8 || document.getElementById('pronSettings')?.open) return;
    try {
      const r2 = host.getBoundingClientRect();
      const vh = window.visualViewport?.height || window.innerHeight || document.documentElement.clientHeight;
      if (r2.top > vh - 140 || r2.top < 0) host.scrollIntoView({
        behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
        block: 'center'
      });
    } catch (e) {}
  }, 90);
}

export function renderComplete() {
  const comp = pronunciationUtilsState.$('pronComplete'),
    msg = pronunciationUtilsState.$('pronCompleteMsg');
  const s = stats();
  if (comp) comp.classList.remove('hidden');
  pronunciationUtilsState.$('pronArea')?.classList.add('hidden');
  const foot = pronunciationUtilsState.$('pronCard')?.querySelector('.studyFoot');
  if (foot) foot.hidden = true;
  setMascot('pronCompleteMascot', 'celebrate', {animate:true,eventKey:'complete:' + pronunciationSessionState.S.source + ':' + pronunciationSessionState.S.sessionTries});
  document.dispatchEvent(new CustomEvent('gp:celebrate',{detail:{id:'pron-complete:'+pronunciationSessionState.S.source+':'+pronunciationSessionState.S.startedAt+':'+pronunciationSessionState.S.sessionTries,kind:'complete',title:'Đã đi hết lượt luyện Nói. Hãy tiếp tục giữ nhịp nhé!'}}));
  renderVisibleMascots();
  if (msg) {
    msg.innerHTML = s.total ? 'Bạn đã đi hết ' + s.total + ' câu của bộ này. Đã luyện <b>' + s.attempted + '</b> câu, đạt mục tiêu <b>' + s.good + '</b> câu (ngưỡng ' + pronunciationSessionState.GOOD + '/100).' : 'Chưa có câu nào trong bộ lọc hiện tại.';
  }
}

/* ═══════════════════════════════════════════════════════════
   Popover chi tiết từng chữ
   ═══════════════════════════════════════════════════════════ */

/* ═══════════════════════════════════════════════════════════
   Popover chi tiết từng chữ
   ═══════════════════════════════════════════════════════════ */
export function showDetail(ci) {
  const it = currentItem();
  const host = pronunciationUtilsState.$('pronDetail');
  if (!it || !host) return;
  const chars = hanChars(it.zh);
  const ch = chars[ci];
  if (!ch) return;
  const syl = pronunciationRepositoryState.PronRepo.syllables(it);
  const py = syl[ci] || '';
  const c = (pronunciationSessionState.S.result && pronunciationSessionState.S.result.chars || []).find(x => x.i === ci) || null;
  const tone = toneOf(py);
  const stLabel = c ? {
    good: 'Phát âm tốt',
    warn: 'Cần chú ý',
    bad: 'Chưa tốt',
    unknown: 'Chưa đủ dữ liệu'
  }[c.status] || '—' : 'Chưa luyện';
  let html = '<div class="pronDetailHead"><b class="pronDetailCh">' + esc(ch) + '</b>' + '<div><div class="pronDetailPy">' + esc(py || '—') + '</div>' + '<div class="pronDetailTone">' + esc(pronunciationSessionState.TONE_TIP[tone] || '') + '</div></div>' + '<button type="button" class="pronDetailClose" data-pd="close" aria-label="Đóng">✕</button></div>';
  html += '<div class="pronDetailRows">' + '<div><span>Trạng thái</span><b class="st-' + (c ? c.status : 'idle') + '">' + esc(stLabel) + '</b></div>' + (c && c.got ? '<div><span>Hệ thống nghe thành</span><b>' + esc(c.got) + '</b></div>' : '') + (c && c.score != null ? '<div><span>Điểm chữ này</span><b>' + c.score + '/100</b></div>' : '') + '</div>';
  if (c && c.note) html += '<div class="pronDetailNote">' + esc(c.note) + '</div>';else if (!c) html += '<div class="pronDetailNote">Chưa có kết quả cho chữ này — hãy bấm micro và nói cả câu trước.</div>';
  html += '<div class="pronDetailActs">' + '<button type="button" class="btn secondary" data-pd="say">🔊 Nghe chữ này</button>' + '<button type="button" class="btn secondary" data-pd="close">Đóng</button>' + '</div>';
  host.innerHTML = html;
  host.classList.remove('hidden');
  pronunciationSessionState.S.detailIdx = ci;
  host.dataset.ci = String(ci);
}

export function hideDetail() {
  const host = pronunciationUtilsState.$('pronDetail');
  if (host) {
    const returnFocus = host.contains(document.activeElement);
    const index = host.dataset.ci;
    host.classList.add('hidden');
    host.innerHTML = '';
    if (returnFocus) pronunciationUtilsState.$('pronHanzi')?.querySelector('[data-ci="' + index + '"]')?.focus({preventScroll:true});
  }
  pronunciationSessionState.S.detailIdx = -1;
}

/* ═══════════════════════════════════════════════════════════
   Sóng âm thanh
   ═══════════════════════════════════════════════════════════ */
