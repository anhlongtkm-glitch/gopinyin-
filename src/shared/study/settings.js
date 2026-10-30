// Native dialogs keep lesson controls in one viewport without cloning their state.
import { trapTab, rememberFocus } from '../focus.js';
import { state as pronSession } from '../../features/pronunciation/session.js';
import { stopRecording, cancelAssessment, setPhase } from '../../features/pronunciation/recording.js';
const settingsIds = { typing: 'typingSettings', pron: 'pronSettings' };
let initialized = false;

export function openStudySettings(mode = 'typing') {
  const id = settingsIds[mode] || settingsIds.typing;
  const dialog = document.getElementById(id);
  if (!dialog || !dialog.closest('.studyShell')?.getClientRects().length) return false;
  if (mode === 'pron') {
    if (pronSession.S.phase === 'recording') stopRecording('manual');
    else if (['requesting', 'starting'].includes(pronSession.S.phase)) { cancelAssessment(); setPhase('idle', ''); }
  }
  if (!dialog.open) dialog.showModal();
  dialog.querySelector('[role="tab"][aria-selected="true"]')?.focus({ preventScroll: true });
  return true;
}

export function initializeStudySettings() {
  if (initialized) return;
  initialized = true;
  for (const [mode, id] of Object.entries(settingsIds)) {
    const dialog = document.getElementById(id);
    const trigger = document.getElementById(mode === 'pron' ? 'pronOptionsBtn' : 'typingOptionsBtn');
    if (!dialog || !trigger) continue;
    const tabs = Array.from(dialog.querySelectorAll('[data-settings-tab]'));
    const panels = Array.from(dialog.querySelectorAll('[data-settings-panel]'));
    let returnFocus = trigger;
    const activate = tab => {
      const value = tab.dataset.settingsTab;
      tabs.forEach(item => {
        const selected = item === tab;
        item.setAttribute('aria-selected', String(selected));
        item.tabIndex = selected ? 0 : -1;
      });
      panels.forEach(panel => { panel.hidden = panel.dataset.settingsPanel !== value; });
    };
    tabs.forEach((tab, index) => {
      tab.id = id + 'Tab-' + tab.dataset.settingsTab;
      const panel = panels.find(item => item.dataset.settingsPanel === tab.dataset.settingsTab);
      if (panel) {
        panel.id = id + 'Panel-' + tab.dataset.settingsTab;
        panel.setAttribute('aria-labelledby', tab.id);
        tab.setAttribute('aria-controls', panel.id);
      }
      tab.addEventListener('click', () => activate(tab));
      tab.addEventListener('keydown', event => {
        if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
        event.preventDefault();
        const nextIndex = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : (index + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
        activate(tabs[nextIndex]);
        tabs[nextIndex].focus({ preventScroll: true });
      });
    });
    trigger.addEventListener('click', () => {
      returnFocus = document.activeElement || trigger;
      openStudySettings(mode);
    });
    dialog.querySelectorAll('[data-settings-close]').forEach(button => button.addEventListener('click', () => dialog.close()));
    dialog.addEventListener('click', event => {
      if (event.target !== dialog) return;
      const rect = dialog.getBoundingClientRect();
      if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.close();
    });
    dialog.addEventListener('cancel', event => event.stopPropagation());
    dialog.addEventListener('keydown', event => trapTab(event, dialog));
    dialog.addEventListener('close', () => {
      if (returnFocus?.isConnected && returnFocus.getClientRects().length && !document.querySelector('dialog[open],.modal:not([hidden]),.appModal.show')) returnFocus.focus({ preventScroll: true });
    });
    // A route change must not leave a top-layer dialog over a different screen.
    const shell = dialog.closest('.studyShell');
    new MutationObserver(() => { if (dialog.open && shell.classList.contains('hidden')) dialog.close(); }).observe(shell, { attributes: true, attributeFilter: ['class'] });
    dialog.addEventListener('click', event => {
      if (event.target.closest('#helpBtn,#historyBtn,#resetBtn,#pronResetBtn,[data-open-study-help]')) {
        dialog.close();
        queueMicrotask(() => {
          const opened = document.querySelector('.modal:not([hidden]),.appModal.show');
          if (opened) rememberFocus(opened, trigger);
        });
      }
    }, true);
  }

  const typingHint = document.getElementById('hintBtn');
  const typingProxy = document.getElementById('typingPyToggle');
  const chinese = document.getElementById('chinese');
  if (typingHint && typingProxy && chinese) {
    const sync = () => {
      const shown = chinese.classList.contains('show-pinyin');
      typingProxy.classList.toggle('off', !shown);
      typingProxy.setAttribute('aria-pressed', String(shown));
    };
    typingProxy.addEventListener('click', () => { typingHint.click(); sync(); });
    new MutationObserver(sync).observe(chinese, { attributes: true, attributeFilter: ['class'] });
    sync();
  }
  const pronToggle = document.getElementById('pronPyToggle');
  const pronQuick = document.getElementById('pronQuickPyToggle');
  if (pronToggle && pronQuick) {
    const sync = () => {
      const shown = pronToggle.getAttribute('aria-pressed') === 'true';
      const label = pronQuick.querySelector('[data-hint-label]');
      if (label) label.textContent = 'Pinyin';
      pronQuick.setAttribute('aria-pressed', String(shown));
    };
    pronQuick.addEventListener('click', () => { pronToggle.click(); sync(); });
    new MutationObserver(sync).observe(pronToggle, { attributes: true, attributeFilter: ['aria-pressed'] });
    sync();
  }
  for (const [proxyId, targetId] of [
    ['typingQuickHanToggle', 'hanToggle'], ['typingQuickViToggle', 'viToggle'],
    ['pronQuickHanToggle', 'pronHanToggle'], ['pronQuickViToggle', 'pronViToggle']
  ]) {
    const proxy = document.getElementById(proxyId), target = document.getElementById(targetId);
    if (!proxy || !target) continue;
    const sync = () => proxy.setAttribute('aria-pressed', target.getAttribute('aria-pressed') || 'false');
    proxy.addEventListener('click', () => { target.click(); sync(); });
    new MutationObserver(sync).observe(target, { attributes: true, attributeFilter: ['aria-pressed'] });
    sync();
  }
}
