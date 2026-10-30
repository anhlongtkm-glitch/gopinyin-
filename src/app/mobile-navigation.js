import { showView } from './navigation.js';
import { navigationVersion } from './routes.js';
import { openModal, closeModal } from '../shared/dialogs.js';
import { currentUser } from '../features/auth/service.js';
import { state as gameSession } from '../features/game/session.js';
import { togglePause } from '../features/game/panda-runtime.js';
import { state as pronSession } from '../features/pronunciation/session.js';
import { stopRecording, cancelAssessment, setPhase } from '../features/pronunciation/recording.js';
import { renderVisibleMascots } from '../shared/mascot.js';
import { rememberFocus } from '../shared/focus.js';
import { ensureStudyControlVisible } from '../shared/study/interactions.js';

let pausedNavigation = null;
let suppressResume = false;
let initialized = false;
const modal = () => document.getElementById('mobileMoreModal');
const isVisible = id => { const el = document.getElementById(id); return el && !el.hidden && !el.classList.contains('hidden'); };

export function closeMobileMore({ resume = true } = {}) {
  if (!modal() || modal().hidden) return;
  suppressResume = !resume;
  closeModal('mobileMoreModal');
  suppressResume = false;
}

function resumePausedGame() {
  if (pausedNavigation == null || document.querySelector('.modal:not([hidden])')) return;
  if (!suppressResume && navigationVersion() === pausedNavigation && isVisible('gameCard') && gameSession.state?.running && gameSession.state.paused) togglePause();
  pausedNavigation = null;
}

function openMore() {
  if (!modal()?.hidden) return;
  document.dispatchEvent(new CustomEvent('gp:more-opened'));
  if (isVisible('gameCard') && gameSession.state?.running && !gameSession.state.paused) {
    pausedNavigation = navigationVersion();
    togglePause();
  }
  if (isVisible('pronCard')) {
    if (pronSession.S?.phase === 'recording') stopRecording('manual');
    else if (['requesting', 'starting'].includes(pronSession.S?.phase)) { cancelAssessment(); setPhase('idle'); }
  }
  const user = currentUser();
  document.getElementById('mobileAccountLabel').textContent = user ? 'Tài khoản của bạn' : 'Đăng nhập';
  document.getElementById('mobileAccountSub').textContent = user ? 'Hồ sơ và thiết lập tài khoản' : 'Lưu tiến độ trên mọi thiết bị';
  document.getElementById('mobileLogoutBtn').hidden = !user;
  document.getElementById('mobileMoreBtn').setAttribute('aria-expanded', 'true');
  openModal('mobileMoreModal');
  renderVisibleMascots();
}

export function syncMobileNavigation() {
  let view = isVisible('appCard') || isVisible('libraryCard') || isVisible('pronCard') || isVisible('pronLibCard') ? 'practice' : isVisible('bearCard') ? 'bear' : isVisible('readingsCard') ? 'readings' : isVisible('aiCard') ? 'ai' : isVisible('gameCard') || isVisible('gamesCard') ? 'games' : isVisible('rankCard') ? 'rank' : 'dash';
  document.querySelectorAll('[data-mobile-view]').forEach(button => {
    if (button.dataset.mobileView === view) button.setAttribute('aria-current', 'page');
    else button.removeAttribute('aria-current');
  });
  const more = document.getElementById('mobileMoreBtn');
  if (more) {
    if (['ai', 'rank','readings'].includes(view)) more.setAttribute('aria-current', 'page');
    else more.removeAttribute('aria-current');
  }
}

export function initializeMobileNavigation() {
  if (initialized || !modal()) return;
  initialized = true;
  document.getElementById('mobileMoreBtn').addEventListener('click', openMore);
  document.querySelectorAll('[data-mobile-view],[data-more-view]').forEach(button => button.addEventListener('click', () => {
    closeMobileMore({ resume: false });
    showView(button.dataset.mobileView || button.dataset.moreView);
  }));
  document.getElementById('mobileAccountBtn').addEventListener('click', () => {
    document.getElementById(currentUser() ? 'wsProfileBtn' : 'wsLoginBtn')?.click();
    const opened = document.querySelector('.modal:not([hidden]):not(#mobileMoreModal)');
    if (opened) rememberFocus(opened, document.getElementById('mobileMoreBtn'));
    closeMobileMore();
  });
  document.getElementById('mobileLogoutBtn').addEventListener('click', () => {
    closeMobileMore({ resume: false }); document.getElementById('wsLogoutBtn')?.click();
  });
  window.addEventListener('gp:modal-closed', event => {
    if (event.detail === 'mobileMoreModal') document.getElementById('mobileMoreBtn').setAttribute('aria-expanded', 'false');
    resumePausedGame();
  });
  document.addEventListener('gp:view-changed', () => { closeMobileMore({ resume: false }); syncMobileNavigation(); });
  window.addEventListener('hashchange', () => closeMobileMore({ resume: false }));
  const media = window.matchMedia('(max-width:860px)');
  media.addEventListener('change', event => { if (!event.matches) closeMobileMore(); syncMobileNavigation(); });
  const syncKeyboard = () => {
    const focused = document.activeElement?.matches('input,textarea,[contenteditable="true"]');
    const viewport = window.visualViewport;
    const keyboardOpen = media.matches && focused && viewport && innerHeight - viewport.height > 120;
    document.body.classList.toggle('keyboard-open', !!keyboardOpen);
    const input = document.activeElement;
    if (focused && !input.readOnly) requestAnimationFrame(() => {
      if (document.activeElement === input && !input.readOnly) ensureStudyControlVisible(input);
    });
  };
  window.visualViewport?.addEventListener('resize', syncKeyboard);
  document.addEventListener('focusin', syncKeyboard);
  document.addEventListener('focusout', () => requestAnimationFrame(syncKeyboard));
  let scheduled = false;
  const observer = new MutationObserver(() => {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => { scheduled = false; syncMobileNavigation(); });
  });
  document.querySelectorAll('.ws-main>section').forEach(el => observer.observe(el, { attributes: true, attributeFilter: ['class', 'hidden'] }));
  syncMobileNavigation();
}
