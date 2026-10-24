// State and behavior owned by features/landing/controller. Initialization is orchestrated by app/bootstrap.js.

import { state as accountStorageState } from "../../shared/account-storage.js";

import { state as audioEffectsState } from "../../shared/audio/effects.js";

/* ═══════════════ LANDING: HIỆU ỨNG & TƯƠNG TÁC ═══════════════ */
export function landingFX() {
  /* Năm footer */
  const yr = accountStorageState.$('lpYear');
  if (yr) yr.textContent = String(new Date().getFullYear());

  /* Nav trôi + bóng */
  const nav = accountStorageState.$('lpNav');
  if (nav) {
    const onScroll = () => {
      nav.classList.toggle('scrolled', window.scrollY > 12);
    };
    window.addEventListener('scroll', onScroll, {
      passive: true
    });
    onScroll();
  }

  /* Chữ Hán bay ngược nền */
  const charsHost = accountStorageState.$('lpChars');
  if (charsHost) {
    const hanzi = '你好中文学习汉语拼音字词读写意思朋友学校生活工作吃饭时间'.split('');
    for (let i = 0; i < 14; i++) {
      const s = document.createElement('span');
      s.textContent = hanzi[i % hanzi.length];
      s.style.left = Math.random() * 96 + 'vw';
      s.style.fontSize = 26 + Math.random() * 54 + 'px';
      s.style.animationDuration = 16 + Math.random() * 20 + 's';
      s.style.animationDelay = -Math.random() * 30 + 's';
      s.style.opacity = String(0.03 + Math.random() * 0.045);
      charsHost.appendChild(s);
    }
  }

  /* Reveal khi cuộn
     ★ Trình duyệt/WebView cũ không có IntersectionObserver → trước đây dòng
     `new IntersectionObserver(...)` NÉM LỖI, làm hỏng cả phần còn lại của
     file (đếm số, hiệu ứng, VÀ toàn bộ khối khởi tạo ở cuối) → app trắng.
     Nay thiếu IO thì hiện luôn mọi thứ thay vì chết. */
  const hasIO = typeof IntersectionObserver === 'function';
  const io = hasIO ? new IntersectionObserver(es => {
    es.forEach(e => {
      if (e.isIntersecting) {
        e.target.classList.add('in');
        io.unobserve(e.target);
      }
    });
  }, {
    threshold: .12
  }) : null;
  if (io) accountStorageState.$$('.reveal').forEach(el => io.observe(el));else accountStorageState.$$('.reveal').forEach(el => el.classList.add('in'));

  /* Đếm số thống kê */
  const runCount = el => {
    const target = parseInt(el.dataset.count || '0', 10);
    if (!target) {
      el.textContent = '0';
      return;
    }
    const t0 = performance.now(),
      dur = 1400;
    const tick = t => {
      const k = Math.min((t - t0) / dur, 1),
        ease = 1 - Math.pow(1 - k, 3);
      el.textContent = Math.round(target * ease).toLocaleString('vi-VN');
      if (k < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  };
  const cio = hasIO ? new IntersectionObserver(es => {
    es.forEach(e => {
      if (!e.isIntersecting) return;
      runCount(e.target);
      cio.unobserve(e.target);
    });
  }, {
    threshold: .4
  }) : null;
  if (cio) accountStorageState.$$('[data-count]').forEach(el => cio.observe(el));else accountStorageState.$$('[data-count]').forEach(runCount);

  /* Hiệu ứng ánh sáng theo chuột trên thẻ tính năng */
  accountStorageState.$$('.lp-feature').forEach(card => {
    card.addEventListener('pointermove', e => {
      const r = card.getBoundingClientRect();
      card.style.setProperty('--mx', e.clientX - r.left + 'px');
      card.style.setProperty('--my', e.clientY - r.top + 'px');
    });
  });

  /* Âm thanh hover nhẹ cho nav/CTA (chỉ desktop) */
  if (matchMedia('(hover:hover)').matches) {
    accountStorageState.$$('.lp-btn,.ws-navItem,.dashCard,.vocabCard').forEach(el => {
      el.addEventListener('mouseenter', () => audioEffectsState.Sfx.hover());
    });
  }
  accountStorageState.$$('.lp-btn,.lp-module,.lp-feature').forEach(el => el.addEventListener('click', () => audioEffectsState.Sfx.tap()));
}

/* ═══════════════ KHỞI TẠO ═══════════════ */
/* ★ Bọc try/catch: hiệu ứng landing KHÔNG được phép làm chết khối khởi tạo
   (đăng nhập, Pro, render) phía dưới. */
