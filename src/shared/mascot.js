// Presentation only: mascot reactions never render a lesson or change learning state.
export const MASCOT_POSES = Object.freeze([
  'welcome', 'guide', 'search', 'connection', 'reading', 'typing', 'listening',
  'speaking', 'thinking', 'ready', 'approve', 'encourage', 'clap', 'celebrate',
  'star', 'trophy', 'face-neutral', 'face-focus', 'face-happy', 'face-thinking',
  'face-encourage', 'face-excited'
]);
const records = new WeakMap();
const pending = new Set();
let initialized = false;
let frame = 0;
let viewportObserver;
const reducedMotion = () => ['reduced','off'].includes(document.documentElement.dataset.effects) || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
const visible = el => el.isConnected && !el.closest('[hidden],.hidden,details:not([open])') && !!el.getClientRects().length;

function paint(el) {
  if (!visible(el)) return;
  const pose = MASCOT_POSES.includes(el.dataset.mascot) ? el.dataset.mascot : 'ready';
  let record = records.get(el);
  if (!record) {
    const img = document.createElement('img');
    img.className = 'mascot-image';
    img.alt = '';
    img.width = 512;
    img.height = 512;
    img.decoding = 'async';
    img.draggable = false;
    img.addEventListener('error', () => { el.classList.add('mascot-unavailable'); });
    img.addEventListener('load', () => { el.classList.remove('mascot-unavailable'); });
    el.classList.add('mascot');
    el.setAttribute('aria-hidden', 'true');
    el.append(img);
    record = { img, pose: '', eventKey: null, animation: null };
    records.set(el, record);
  }
  if (record.pose !== pose) {
    const small = ['inline', 'face'].includes(el.dataset.mascotSize);
    record.img.src = 'assets/mascot/' + pose + (small ? '-small' : '') + '.webp';
    record.pose = pose;
  }
}

export function renderVisibleMascots() {
  if (typeof document === 'undefined') return;
  document.querySelectorAll('[data-mascot]').forEach(el => {
    if (!visible(el)) return;
    const rect = el.getBoundingClientRect();
    if (rect.top < innerHeight + 240 && rect.bottom > -240) paint(el);
    else if (!pending.has(el)) { pending.add(el); viewportObserver?.observe(el); }
  });
}

export function setMascot(target, pose, { animate = false, eventKey } = {}) {
  if (typeof document === 'undefined') return false;
  const el = typeof target === 'string' ? document.getElementById(target) : target;
  if (!el || !MASCOT_POSES.includes(pose)) return false;
  const record = records.get(el);
  if (eventKey == null && record && record.pose !== pose) record.eventKey = null;
  if (eventKey != null && record?.eventKey === eventKey) return false;
  if (el.dataset.mascot !== pose) el.dataset.mascot = pose;
  paint(el);
  const next = records.get(el);
  if (next && eventKey != null) next.eventKey = eventKey;
  if (animate && next && visible(el) && !reducedMotion()) {
    next.animation?.cancel();
    next.animation = next.img.animate?.([
      { transform: 'translateY(0) rotate(0)' },
      { transform: 'translateY(-6px) rotate(-3deg)', offset: .45 },
      { transform: 'translateY(0) rotate(0)' }
    ], { duration: 420, easing: 'ease-out' });
  }
  return true;
}

export function initializeMascots() {
  if (initialized) return;
  initialized = true;
  viewportObserver = typeof IntersectionObserver === 'function' ? new IntersectionObserver(entries => {
    for (const entry of entries) if (entry.isIntersecting && visible(entry.target)) {
      paint(entry.target); pending.delete(entry.target); viewportObserver.unobserve(entry.target);
    }
  }, { rootMargin: '240px' }) : null;
  const schedule = () => {
    if (frame) return;
    frame = requestAnimationFrame(() => { frame = 0; renderVisibleMascots(); });
  };
  // Observe visibility owners, not every keystroke/feedback update in the document.
  document.querySelectorAll('.ws-main>section,.modal,.complete,#gaOverlay,#accountAccessNotice,[data-mascot]').forEach(el => {
    new MutationObserver(schedule).observe(el, { attributes: true, attributeFilter: ['hidden', 'class', 'data-mascot'] });
  });
  document.addEventListener('toggle', schedule, true);
  document.addEventListener('gp:view-changed', schedule);
  window.addEventListener('resize', schedule, { passive: true });
  window.addEventListener('scroll', schedule, { passive: true });
  renderVisibleMascots();
}
