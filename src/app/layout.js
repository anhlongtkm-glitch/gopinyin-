// State and behavior owned by app/layout. Initialization is orchestrated by app/bootstrap.js.

import { state as domState } from "../shared/dom.js";

export function initializeAppLayout() {
  /* ── ★ Header: đổ bóng khi cuộn (sticky) ── */
  (function () {
    const bar = domState.$('topBar');
    if (!bar) return;
    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        bar.classList.toggle('scrolled', (window.scrollY || document.documentElement.scrollTop || 0) > 8);
        ticking = false;
      });
    };
    window.addEventListener('scroll', onScroll, {
      passive: true
    });
    onScroll();
  })();

  /* ── Init ── */
}
