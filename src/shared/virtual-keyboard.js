// State and behavior owned by shared/virtual-keyboard. Initialization is orchestrated by app/bootstrap.js.

import { legacy, publishLegacy } from "../app/compatibility.js";
import { studyOverlayOpen } from "./study/interactions.js";
import { state as typingSessionState } from "../features/typing/session.js";

export const state = {};

const virtualKeyboardState = state;

export function $(id) {
  return document.getElementById(id);
}

export function isTouch() {
  try {
    return window.matchMedia('(pointer:coarse)').matches || navigator.maxTouchPoints > 0;
  } catch (e) {
    return false;
  }
}

export function gameVisible() {
  var c = $('gameCard');
  return !!c && !c.classList.contains('hidden');
}

export function inputTarget() {
  var card = $('appCard'),
    inp = $('pinyinInput');
  if (card && !card.classList.contains('hidden') && inp) return inp;
  return null;
}

export function activeMode() {
  if (gameVisible()) return 'game';
  return inputTarget() ? 'input' : null;
}

/* ── dựng bàn phím ── */

/* ── dựng bàn phím ── */
export function build() {
  if (virtualKeyboardState.root) return virtualKeyboardState.root;
  virtualKeyboardState.root = document.createElement('div');
  virtualKeyboardState.root.className = 'vkbd';
  virtualKeyboardState.root.id = 'vkbd';
  virtualKeyboardState.root.setAttribute('role', 'group');
  virtualKeyboardState.root.setAttribute('aria-label', 'Bàn phím ảo');
  virtualKeyboardState.root.hidden = true;
  var html = '<div class="vkbdHead">' + '<span class="vkbdTitle">⌨️ Bàn phím ảo</span>' + '<span class="vkbdTip" id="vkbdTip">Gõ pinyin bằng các phím bên dưới</span>' + '<button class="vkbdHide" type="button" data-vk="hide" aria-label="Ẩn bàn phím ảo">✕</button>' + '</div><div class="vkbdBody">';
  virtualKeyboardState.ROWS.forEach(function (row, i) {
    html += '<div class="vkRow vkRow' + (i + 1) + '">';
    if (i === 2) html += '<button class="vkKey vkFn" type="button" data-vk="back" aria-label="Xoá lùi">⌫</button>';
    row.forEach(function (ch) {
      html += '<button class="vkKey" type="button" data-vk="' + ch + '">' + ch + '</button>';
    });
    if (i === 2) html += '<button class="vkKey vkFn" type="button" data-vk="enter" aria-label="Enter">↵</button>';
    html += '</div>';
  });
  html += '<div class="vkRow vkRow4">' +
  '<button class="vkKey vkFn vkHanziOnly" type="button" data-vk="back" aria-label="Xoá lùi">⌫</button>' + '<button class="vkKey vkWide vkGameOnly" type="button" data-vk="space" aria-label="Tạm dừng hoặc tiếp tục game">␣ tạm dừng</button>' + '<button class="vkKey vkWide vkHanziOnly" type="button" data-vk="next">Câu tiếp</button>' + '<button class="vkKey vkWide vkAccent" type="button" data-vk="hint" aria-label="Ẩn hoặc hiện Pinyin">💡 Pinyin</button>' + '</div></div>';
  virtualKeyboardState.root.innerHTML = html;
  document.body.appendChild(virtualKeyboardState.root);

  /* pointerdown: phản hồi tức thì + không làm mất con trỏ khỏi ô gõ */
  virtualKeyboardState.root.addEventListener('pointerdown', function (e) {
    var k = e.target.closest('[data-vk]');
    if (!k) return;
    e.preventDefault();
    press(k.dataset.vk, k);
  }, {
    passive: false
  });
  /* hỗ trợ trình duyệt cũ không có PointerEvent */
  virtualKeyboardState.root.addEventListener('click', function (e) {
    if (window.PointerEvent && e.detail !== 0) return;
    var k = e.target.closest('[data-vk]');
    if (!k) return;
    e.preventDefault();
    press(k.dataset.vk, k);
  });
  return virtualKeyboardState.root;
}

/* ── hiệu ứng nhấn ── */

/* ── hiệu ứng nhấn ── */
export function flash(key) {
  if (!key) return;
  key.classList.add('isPress');
  setTimeout(function () {
    key.classList.remove('isPress');
  }, 130);
}

/* ── chèn ký tự vào input tại con trỏ ── */

/* ── chèn ký tự vào input tại con trỏ ── */
export function insertChar(inp, ch) {
  var start = inp.selectionStart,
    end = inp.selectionEnd;
  if (start == null) start = end = inp.value.length;
  var v = inp.value;
  inp.value = v.slice(0, start) + ch + v.slice(end);
  var pos = start + ch.length;
  try {
    inp.setSelectionRange(pos, pos);
  } catch (e) {}
  inp.dispatchEvent(new Event('input', {
    bubbles: true
  }));
}

export function deleteChar(inp) {
  var start = inp.selectionStart,
    end = inp.selectionEnd;
  if (start == null) start = end = inp.value.length;
  if (start !== end) {
    inp.value = inp.value.slice(0, start) + inp.value.slice(end);
    try {
      inp.setSelectionRange(start, start);
    } catch (e) {}
  } else if (start > 0) {
    inp.value = inp.value.slice(0, start - 1) + inp.value.slice(start);
    try {
      inp.setSelectionRange(start - 1, start - 1);
    } catch (e) {}
  } else return;
  inp.dispatchEvent(new Event('input', {
    bubbles: true
  }));
}

/* ── xử lý phím ── */

/* ── xử lý phím ── */
export function press(k, btn) {
  if (btn?.disabled) return;
  flash(btn);
  if (k === 'hide') {
    hide();
    return;
  }
  var mode = activeMode();
  if (mode === 'game') {
    var g = legacy.__game;
    if (!g) return;
    if (k === 'back') {
      g.backspaceTarget && g.backspaceTarget();
      return;
    }
    if (k === 'enter' || k === 'hint') {
      g.togglePinyin && g.togglePinyin();
      return;
    }
    if (k === 'space') {
      g.togglePause && g.togglePause();
      return;
    }
    g.typeChar && g.typeChar(k);
    return;
  }
  if (mode === 'input') {
    var inp = inputTarget();
    if (!inp || studyOverlayOpen() || inp.disabled || typingSessionState.composing) return;
    if (k === 'next') {
      $('typingNextBtn')?.click();
      return;
    }
    if (k === 'hint') {
      $('hintBtn')?.click();
      return;
    }
    if (inp.readOnly) return;
    if (k === 'back') {
      deleteChar(inp);
      return;
    }
    // A virtual Enter never toggles hints or advances a lesson implicitly.
    if (k === 'enter') return;
    insertChar(inp, k === 'space' ? ' ' : k);
  }
}

/* ── đồng bộ tip và tô sáng phím kế tiếp (game) — chạy MỌI lần ──
   ★ LƯU Ý: phải cập nhật tip TRƯỚC early-return `if (next === hint) return;`
   nếu không ngoài game (next luôn rỗng) toàn bộ code phía sau sẽ không chạy. */

/* ── đồng bộ tip và tô sáng phím kế tiếp (game) — chạy MỌI lần ──
   ★ LƯU Ý: phải cập nhật tip TRƯỚC early-return `if (next === hint) return;`
   nếu không ngoài game (next luôn rỗng) toàn bộ code phía sau sẽ không chạy. */
export function syncHint() {
  if (!virtualKeyboardState.open || !virtualKeyboardState.root) return;
  var mode = activeMode();
  /* ★ Chế độ GÕ CHỮ HÁN: ẩn 3 hàng chữ cái Latin.
     Chữ Latin không thể tạo ra chữ Hán, nên các phím đó bấm vào cũng bị bộ
     lọc chặn — hiện ra chỉ gây hiểu nhầm. Giữ Xóa lùi / Câu tiếp / Pinyin. */
  var wasHanzi = virtualKeyboardState.root.classList.contains('vkbd--hanzi');
  virtualKeyboardState.root.classList.toggle('vkbd--hanzi', mode === 'input');
  /* đổi chiều cao bàn phím → cập nhật biến --vk-h và cho game/sân chơi co lại */
  if (wasHanzi !== (mode === 'input')) {
    document.body.style.setProperty('--vk-h', virtualKeyboardState.root.offsetHeight + 'px');
    fitGameCard();
    window.dispatchEvent(new Event('resize'));
  }
  var next = '';
  if (mode === 'game' && legacy.__game && legacy.__game.nextKey) {
    try {
      next = legacy.__game.nextKey() || '';
    } catch (e) {
      next = '';
    }
  }
  var tip = $('vkbdTip');
  if (tip) {
    tip.textContent = mode === 'game' ? next ? 'Phím cần gõ tiếp theo: ' + next.toUpperCase() : 'Gõ chữ cái đầu của thẻ để khoá mục tiêu' : 'Gõ chữ Hán bằng bàn phím tiếng Trung của máy · 2 Pinyin · 5 câu tiếp khi đúng';
  }
  const game = mode === 'game' ? legacy.__game?._state : null;
  const hintButton = virtualKeyboardState.root.querySelector('[data-vk="hint"]');
  if (hintButton) {
    hintButton.disabled = !!game && game.mode === 'challenge';
    hintButton.setAttribute('aria-pressed', String(!!game?.showPinyin));
    hintButton.textContent = game ? game.mode === 'challenge' ? 'Pinyin khóa' : game.showPinyin ? 'Ẩn Pinyin' : 'Hiện Pinyin' : 'Pinyin';
  }
  virtualKeyboardState.root.querySelectorAll('[data-vk="back"]').forEach(button => {
    button.setAttribute('aria-label', game ? 'Đổi mục tiêu' : 'Xóa lùi');
  });
  if (next === virtualKeyboardState.hint) return;
  virtualKeyboardState.hint = next;
  var keys = virtualKeyboardState.root.querySelectorAll('.vkKey[data-vk]');
  for (var i = 0; i < keys.length; i++) {
    var el = keys[i];
    el.classList.toggle('isNext', !!next && el.dataset.vk === next);
  }
}

/* ── inputmode: chỉ CHẶN bàn phím hệ thống khi đang chơi GAME ──
   ★ Phần LUYỆN GÕ gõ CHỮ HÁN nên PHẢI để bàn phím tiếng Trung của máy
     hiện lên (bàn phím ảo chỉ có chữ cái latin, không gõ được chữ Hán). */

/* ── inputmode: chỉ CHẶN bàn phím hệ thống khi đang chơi GAME ──
   ★ Phần LUYỆN GÕ gõ CHỮ HÁN nên PHẢI để bàn phím tiếng Trung của máy
     hiện lên (bàn phím ảo chỉ có chữ cái latin, không gõ được chữ Hán). */
export function syncInputMode() {
  var inp = $('pinyinInput');
  if (!inp) return;
  if (virtualKeyboardState.open && isTouch() && activeMode() === 'game') inp.setAttribute('inputmode', 'none');else inp.removeAttribute('inputmode');
}

/* ── co sân chơi lại cho vừa phần còn lại của màn hình ── */

/* ── co sân chơi lại cho vừa phần còn lại của màn hình ── */
export function fitGameCard() {
  var card = $('gameCard');
  if (!card) return;
  if (virtualKeyboardState.open && activeMode() === 'game') {
    const viewport = window.visualViewport;
    const top = viewport?.offsetTop || 0, left = viewport?.offsetLeft || 0;
    const height = viewport?.height || window.innerHeight;
    const width = viewport?.width || document.documentElement.clientWidth;
    card.classList.add('pd-keyboard-fit');
    const keyboardHeight = virtualKeyboardState.root?.offsetHeight || 0;
    document.body.style.setProperty('--vk-h', keyboardHeight + 'px');
    const available = Math.max(0, Math.floor(height - keyboardHeight - 12));
    // Reserve the visual viewport for play instead of placing it below the app header.
    card.style.position = 'fixed'; card.style.top = top + 'px'; card.style.left = left + 'px';
    card.style.width = width + 'px'; card.style.zIndex = '110';
    card.style.minHeight = '0';
    card.style.height = available + 'px';
    ['padding-top','padding-bottom','padding-left','padding-right'].forEach(property => card.style.removeProperty(property));
    if (document.fullscreenElement === card) {
      // The fullscreen root is forced to viewport size by the browser. Reserve
      // keyboard space inside it instead of relying on shrinking that root.
      card.style.paddingTop = top + 'px';
      card.style.paddingBottom = (Math.max(0, window.innerHeight - top - height) + keyboardHeight + 12) + 'px';
      card.style.paddingLeft = left + 'px';
      card.style.paddingRight = Math.max(0, window.innerWidth - left - width) + 'px';
    }
    const chrome = ['.pdHud', '.pdSubHud', '.pdFlightBar'].reduce((sum, selector) => sum + (card.querySelector(selector)?.getBoundingClientRect().height || 0), 2);
    document.dispatchEvent(new CustomEvent('gp:game-viewport', {detail:{
      blocked:available - chrome < 112,
      top, left, width, height
    }}));
  } else {
    card.classList.remove('pd-keyboard-fit');
    ['position','top','left','width','z-index','min-height','height','padding-top','padding-bottom','padding-left','padding-right'].forEach(property => card.style.removeProperty(property));
    document.dispatchEvent(new CustomEvent('gp:game-viewport', {detail:{blocked:false}}));
  }
}

let fitFrame = 0;
function scheduleFit() {
  if (fitFrame) return;
  fitFrame = requestAnimationFrame(() => {
    fitFrame = 0;
    if (virtualKeyboardState.open) { fitWidth(); fitGameCard(); }
  });
}

/* ── bám đúng bề rộng NHÌN THẤY (trang có thể bị đẩy rộng hơn do phần tử khác) ── */

/* ── bám đúng bề rộng NHÌN THẤY (trang có thể bị đẩy rộng hơn do phần tử khác) ── */
export function fitWidth() {
  if (!virtualKeyboardState.root) return;
  var vv = window.visualViewport;
  var viewportWidth = vv && vv.width ? vv.width : document.documentElement.clientWidth;
  var w = Math.min(760, viewportWidth);
  var left = (vv && vv.offsetLeft ? vv.offsetLeft : 0) + (viewportWidth - w) / 2;
  virtualKeyboardState.root.style.width = Math.round(w) + 'px';
  virtualKeyboardState.root.style.left = Math.round(left) + 'px';
  virtualKeyboardState.root.style.right = 'auto';
  const bottom = vv ? Math.max(0, window.innerHeight - vv.offsetTop - vv.height) : 0;
  virtualKeyboardState.root.style.bottom = bottom + 'px';
}

export function show() {
  build();
  // Fullscreen's top layer hides siblings of the fullscreen element.
  (document.fullscreenElement || document.body).appendChild(virtualKeyboardState.root);
  fitWidth();
  virtualKeyboardState.root.hidden = false;
  virtualKeyboardState.open = true;
  document.body.classList.add('vk-open');
  document.body.style.setProperty('--vk-h', virtualKeyboardState.root.offsetHeight + 'px');
  syncButtons();
  syncInputMode();
  syncHint();
  fitGameCard();
  scheduleFit();
  clearInterval(virtualKeyboardState.hintTimer);
  virtualKeyboardState.hintTimer = setInterval(syncHint, 160);
  /* game: canvas co lại để tàu không bị bàn phím che */
  setTimeout(function () {
    document.body.style.setProperty('--vk-h', virtualKeyboardState.root.offsetHeight + 'px');
    fitGameCard();
    window.dispatchEvent(new Event('resize'));
    /* phần luyện gõ: đưa ô gõ lên trên bàn phím */
    var mode = activeMode();
    if (mode === 'input') {
      var inp = inputTarget();
      if (inp && inp.scrollIntoView) {
        try {
          inp.scrollIntoView({
            block: 'center',
            behavior: 'smooth'
          });
        } catch (e) {
          inp.scrollIntoView();
        }
      }
    }
  }, 80);
  try {
    localStorage.setItem(virtualKeyboardState.LS_KEY, '1');
  } catch (e) {}
}

export function hide({ remember = true } = {}) {
  if (!virtualKeyboardState.root) return;
  virtualKeyboardState.root.hidden = true;
  virtualKeyboardState.open = false;
  document.body.classList.remove('vk-open');
  clearInterval(virtualKeyboardState.hintTimer);
  fitGameCard();
  syncButtons();
  syncInputMode();
  window.dispatchEvent(new Event('resize'));
  try {
    if (remember) localStorage.setItem(virtualKeyboardState.LS_KEY, '0');
  } catch (e) {}
}

export function toggle() {
  virtualKeyboardState.open ? hide() : show();
}

export function syncButtons() {
  var on = virtualKeyboardState.open;
  ['vkBtn', 'gaKbdBtn'].forEach(function (id) {
    var b = $(id);
    if (!b) return;
    b.classList.toggle('on', on);
    b.setAttribute('aria-pressed', on ? 'true' : 'false');
    b.title = on ? 'Tắt bàn phím ảo' : 'Bật bàn phím ảo';
  });
}

/* ── khởi tạo ── */

/* ── khởi tạo ── */
export function init() {
  build();
  var b1 = $('vkBtn'),
    b2 = $('gaKbdBtn');
  if (b1) b1.addEventListener('click', function (e) {
    e.preventDefault();
    toggle();
  });
  if (b2) b2.addEventListener('click', function (e) {
    e.preventDefault();
    toggle();
  });

  /* nhớ trạng thái; lần đầu trên thiết bị cảm ứng thì tự bật */
  var saved = null;
  try {
    saved = localStorage.getItem(virtualKeyboardState.LS_KEY);
  } catch (e) {}
  if (saved === '1' || saved === null && isTouch()) {
    /* chỉ bật khi thật sự có chỗ để gõ */
    if (activeMode()) show();
  }

  document.addEventListener('gp:game-started', function () {
    if (!isTouch() || activeMode() !== 'game') return;
    var pref = null;
    try { pref = localStorage.getItem(virtualKeyboardState.LS_KEY); } catch (e) {}
    if (pref !== '0') show();
    else if (virtualKeyboardState.open) fitGameCard();
  });
  document.addEventListener('gp:view-changed', function () {
    if (virtualKeyboardState.open && !activeMode()) hide({ remember:false });
    else if (virtualKeyboardState.open) scheduleFit();
  });
  document.addEventListener('fullscreenchange', function () {
    (document.fullscreenElement || document.body).appendChild(virtualKeyboardState.root);
    scheduleFit();
  });
  document.addEventListener('gp:game-layout', scheduleFit);
  const layoutObserver = new ResizeObserver(scheduleFit);
  [virtualKeyboardState.root, ...document.querySelectorAll('#gameCard .pdHud, #gameCard .pdSubHud, #gameCard .pdFlightBar')].forEach(element => layoutObserver.observe(element));

  /* thiết bị cảm ứng: tự bật khi vào màn hình có chỗ gõ (nếu người dùng chưa tắt) */
  document.addEventListener('click', function (e) {
    if (virtualKeyboardState.open || !isTouch()) return;
    if (!e.target.closest) return;
    if (!e.target.closest('.ws-navItem, .vocabCard, [data-action="study"], #gaStartBtn')) return;
    var pref = null;
    try {
      pref = localStorage.getItem(virtualKeyboardState.LS_KEY);
    } catch (err) {}
    if (pref === '0') return;
    setTimeout(function () {
      if (!virtualKeyboardState.open && activeMode()) show();
    }, 900);
  });

  /* rời màn hình gõ/game thì ẩn bàn phím ảo đi cho gọn */
  document.addEventListener('click', function (e) {
    if (!virtualKeyboardState.open) return;
    if (e.target.closest && e.target.closest('.ws-navItem')) {
      if (!activeMode()) {
        hide();
        return;
      }
      setTimeout(function () {
        fitGameCard();
        window.dispatchEvent(new Event('resize'));
      }, 280);
    }
  });
  window.addEventListener('resize', scheduleFit);
  window.addEventListener('orientationchange', function () {
    setTimeout(function () {
      if (virtualKeyboardState.open) {
        scheduleFit();
      }
    }, 260);
  });
  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', scheduleFit);
    window.visualViewport.addEventListener('scroll', scheduleFit);
  }
}

export function initializeVirtualKeyboard() {
  virtualKeyboardState.LS_KEY = 'gp:vk';
  virtualKeyboardState.ROWS = [['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p'], ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l'], ['z', 'x', 'c', 'v', 'b', 'n', 'm']];
  virtualKeyboardState.root = null;
  virtualKeyboardState.open = false;
  virtualKeyboardState.hint = '';
  virtualKeyboardState.hintTimer = 0;
  publishLegacy("VK", {
    show: show,
    hide: hide,
    toggle: toggle,
    isOpen: function () {
      return virtualKeyboardState.open;
    }
  });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);else init();
}
