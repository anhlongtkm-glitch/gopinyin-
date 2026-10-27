import { fireConfetti, stopConfetti } from './confetti.js';
const preferenceKey = 'gp:celebrations';
let timer, currentPriority = 0, initialized = false;
const seen = new Set();
export function effectPreference() { try { return localStorage.getItem(preferenceKey) || 'full'; } catch { return 'full'; } }
export function setEffectPreference(value) {
  if (!['full','reduced','off'].includes(value)) return;
  try { localStorage.setItem(preferenceKey,value); } catch {}
  document.documentElement.dataset.effects = value;
  const status = document.getElementById('journeyCelebration');
  if (status && value === 'off') { status.hidden = true; clearTimeout(timer); currentPriority = 0; }
  document.querySelectorAll('.mascot,.mascot-image,.ws-main>section').forEach(el => el.getAnimations().forEach(animation => animation.cancel()));
  stopConfetti();
}
export function celebrate({id, title, kind = 'correct'}) {
  if (!id || seen.has(id) || document.hidden) return;
  seen.add(id); if (seen.size > 1000) seen.delete(seen.values().next().value);
  const priority = {correct:1,quest:2,complete:3,badge:4,level:5}[kind] || 1;
  if (priority < currentPriority || effectPreference() === 'off') return;
  const el = document.getElementById('journeyCelebration');
  if (!el) return;
  clearTimeout(timer); currentPriority = priority;
  el.textContent = title; el.dataset.kind = kind; el.hidden = false;
  const reduced = effectPreference() === 'reduced' || matchMedia('(prefers-reduced-motion:reduce)').matches;
  el.classList.toggle('is-still',reduced);
  stopConfetti();
  if (!reduced && priority >= 2) fireConfetti(priority === 5 ? 60 : 32);
  timer = setTimeout(() => { el.hidden = true; currentPriority = 0; }, reduced ? 1600 : kind === 'level' ? 1500 : priority >= 2 ? 1100 : 450);
}
export function initializeCelebrations() {
  if (initialized) return; initialized = true;
  const el = document.createElement('div'); el.id = 'journeyCelebration'; el.className = 'journeyCelebration'; el.role = 'status'; el.setAttribute('aria-live','polite'); el.hidden = true; document.body.append(el);
  document.documentElement.dataset.effects = effectPreference();
  document.addEventListener('gp:view-changed', () => {
    const view = [...document.querySelectorAll('.ws-main>section')].find(section=>!section.hidden&&!section.classList.contains('hidden'));
    if (!view || effectPreference() !== 'full' || matchMedia('(prefers-reduced-motion:reduce)').matches) return;
    view.getAnimations().forEach(animation=>animation.cancel());
    view.animate([{opacity:.55,transform:'translateY(6px)'},{opacity:1,transform:'translateY(0)'}],{duration:220,easing:'ease-out'});
  });
  document.addEventListener('visibilitychange', () => { if (document.hidden) { clearTimeout(timer); el.hidden = true; currentPriority = 0; stopConfetti(); } });
}
