// In-memory UI context only; no database or progress format changes.
import { navigationVersion } from './routes.js';
const positions = new Map();

export function rememberLibraryPosition(id = 'libraryCard') {
  const el = document.getElementById(id);
  if (el && !el.classList.contains('hidden')) positions.set(id, window.scrollY);
}

export function restoreLibraryPosition(id = 'libraryCard') {
  if (!positions.has(id)) return;
  const navigation = navigationVersion();
  requestAnimationFrame(() => requestAnimationFrame(() => {
    const el = document.getElementById(id);
    if (navigation !== navigationVersion() || !el || el.classList.contains('hidden') || document.querySelector('.modal:not([hidden])')) return;
    window.scrollTo({ top: positions.get(id), behavior: 'instant' });
  }));
}

export function initializeViewContext() {
  document.addEventListener('click', event => {
    if (event.target.closest?.('[data-vsrc]')) rememberLibraryPosition();
    if (event.target.closest?.('[data-psrc]')) rememberLibraryPosition('pronLibCard');
  }, true);
}
