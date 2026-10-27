// Shared interaction guards: overlays and native controls always own their keys.
const interactive = 'button,a,summary,input,textarea,select,[contenteditable="true"],[role="button"],[role="tab"],[role="switch"],[role="menuitem"],[role="combobox"],[role="slider"]';

export function studyOverlayOpen() {
  return typeof document !== 'undefined' && !!document.querySelector('.modal:not([hidden]),.appModal.show,dialog[open],#pronDetail:not(.hidden)');
}

export function studyControlOwnsKeys(target, typingInput = null) {
  const control = target?.closest?.(interactive);
  return !!control && control !== typingInput;
}

export function canFocusStudyInput(input, activeBefore = document.activeElement) {
  if (!input?.isConnected || !input.getClientRects().length || studyOverlayOpen()) return false;
  if (document.querySelector('#appCard .studySettings[open]')) return false;
  const active = document.activeElement;
  return active === input || active === document.body || active === activeBefore;
}

// Reveal an obscured study control without stealing focus or changing the lesson.
export function ensureStudyControlVisible(control) {
  if (typeof document === 'undefined' || !window.matchMedia('(max-width:860px)').matches || studyOverlayOpen()) return false;
  const el = typeof control === 'string' ? document.getElementById(control) : control;
  if (!el?.isConnected || !el.getClientRects().length) return false;
  const viewport = window.visualViewport;
  const viewportTop = viewport?.offsetTop || 0;
  const viewportBottom = viewportTop + (viewport?.height || window.innerHeight);
  let safeTop = viewportTop + 12, safeBottom = viewportBottom - 12;
  const header = document.querySelector('.top');
  if (header?.getClientRects().length) {
    const r = header.getBoundingClientRect();
    const position = getComputedStyle(header).position;
    if ((position === 'sticky' || position === 'fixed') && r.bottom > viewportTop && r.top < viewportBottom) safeTop = Math.max(safeTop, r.bottom + 12);
  }
  const nav = document.querySelector('.mobile-nav');
  if (nav?.getClientRects().length) {
    const r = nav.getBoundingClientRect();
    if (r.bottom > viewportTop && r.top < viewportBottom) safeBottom = Math.min(safeBottom, r.top - 12);
  }
  if (safeBottom <= safeTop) return false;
  const rect = el.getBoundingClientRect();
  let delta = rect.bottom > safeBottom ? rect.bottom - safeBottom : rect.top < safeTop ? rect.top - safeTop : 0;
  if (rect.height > safeBottom - safeTop) delta = rect.top - safeTop;
  if (Math.abs(delta) < 1) return false;
  window.scrollBy({top:delta,behavior:'auto'});
  return true;
}
