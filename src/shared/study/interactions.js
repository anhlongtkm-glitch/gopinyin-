// Shared interaction guards: overlays and native controls always own their keys.
const interactive = 'button,a,summary,input,textarea,select,[contenteditable="true"],[role="button"],[role="tab"],[role="switch"],[role="menuitem"],[role="combobox"],[role="slider"]';
let revealRequest = 0, interactionVersion = 0, listening = false, readyAction = null;
let lastUserScrollAt = 0;
let actionObserver, observedShell;

function visibleRect(element) {
  if (!element?.getClientRects().length || getComputedStyle(element).visibility === 'hidden') return null;
  return element.getBoundingClientRect();
}

function updateStudyViewportSpace() {
  const shell = [...document.querySelectorAll('#appCard,#pronCard')].find(el => el.getClientRects().length);
  let extra = 0;
  if (shell && window.matchMedia('(max-width:860px)').matches) {
    const viewport = window.visualViewport;
    let bottom = (viewport?.offsetTop || 0) + (viewport?.height || innerHeight);
    const keyboard = visibleRect(document.getElementById('vkbd'));
    if (keyboard && keyboard.bottom > 0) bottom = Math.min(bottom, keyboard.top);
    // Existing workspace and keyboard padding already reserve part of this space.
    const workspace = document.querySelector('.workspace');
    const reserved = (workspace ? parseFloat(getComputedStyle(workspace).paddingBottom) || 0 : 0)
      + (parseFloat(getComputedStyle(shell).paddingBottom) || 0);
    extra = Math.max(0, innerHeight - bottom - reserved);
  }
  document.documentElement.style.setProperty('--study-bottom-inset', Math.ceil(extra) + 'px');
}

function listenForStudyViewport() {
  if (listening) return;
  listening = true;
  for (const event of ['pointerdown','touchstart','touchmove','wheel','keydown','compositionstart']) {
    document.addEventListener(event, e => {
      interactionVersion++;
      const pageScrollKey = event === 'keydown' && !e.isComposing && !e.target?.closest?.('input,textarea,select,[contenteditable="true"]') && ['PageUp','PageDown','Home','End','ArrowUp','ArrowDown'].includes(e.key);
      if (event === 'wheel' || event === 'touchmove' || pageScrollKey) lastUserScrollAt = Date.now();
    }, {capture:true,passive:true});
  }
  const resize = () => {
    updateStudyViewportSpace();
    if (readyAction?.isCurrent()) scheduleStudyControlReveal(readyAction.control, readyAction.isCurrent);
  };
  window.visualViewport?.addEventListener('resize', resize);
  window.addEventListener('resize', resize);
  document.addEventListener('gp:view-changed', () => {
    revealRequest++; readyAction = null; actionObserver?.disconnect(); observedShell = null; updateStudyViewportSpace();
  });
}

// One reveal after layout settles. A newer question or deliberate user action wins.
export function scheduleStudyControlReveal(control, isCurrent) {
  if (typeof document === 'undefined' || !window.matchMedia('(max-width:860px)').matches) return;
  listenForStudyViewport();
  readyAction = {control,isCurrent};
  const element = typeof control === 'string' ? document.getElementById(control) : control;
  const shell = element?.closest('.studyShell');
  if (shell && shell !== observedShell && typeof ResizeObserver !== 'undefined') {
    actionObserver ||= new ResizeObserver(() => {
      if (readyAction?.isCurrent()) scheduleStudyControlReveal(readyAction.control, readyAction.isCurrent);
    });
    actionObserver.disconnect(); observedShell = shell; actionObserver.observe(shell);
  }
  const request = ++revealRequest, intent = interactionVersion;
  const active = document.activeElement, scroll = window.scrollY;
  requestAnimationFrame(() => requestAnimationFrame(() => {
    if (request !== revealRequest || intent !== interactionVersion || !isCurrent() || studyOverlayOpen()) return;
    if (Date.now() - lastUserScrollAt < 500) return;
    if (active !== document.activeElement || Math.abs(window.scrollY - scroll) > 8) return;
    const el = typeof control === 'string' ? document.getElementById(control) : control;
    if (!el || el.disabled) return;
    ensureStudyControlVisible(el);
  }));
}

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
  listenForStudyViewport();
  updateStudyViewportSpace();
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
  if (visibleRect(nav)) {
    const r = visibleRect(nav);
    if (r.bottom > viewportTop && r.top < viewportBottom) safeBottom = Math.min(safeBottom, r.top - 12);
  }
  const keyboard = visibleRect(document.getElementById('vkbd'));
  if (keyboard && keyboard.bottom > viewportTop && keyboard.top < viewportBottom) safeBottom = Math.min(safeBottom, keyboard.top - 12);
  if (safeBottom <= safeTop) return false;
  const rect = el.getBoundingClientRect();
  let delta = rect.bottom > safeBottom ? rect.bottom - safeBottom : rect.top < safeTop ? rect.top - safeTop : 0;
  if (rect.height > safeBottom - safeTop) delta = rect.top - safeTop;
  if (Math.abs(delta) < 1) return false;
  window.scrollBy({top:delta,behavior:'auto'});
  return true;
}
