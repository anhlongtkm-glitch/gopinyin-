const triggers = new WeakMap();
export function rememberFocus(modal, trigger = document.activeElement) {
  if (modal && !modal.contains(trigger)) triggers.set(modal, trigger);
}
export function restoreFocus(modal) {
  const trigger = triggers.get(modal);
  triggers.delete(modal);
  if (trigger?.isConnected && trigger.getClientRects().length && !trigger.disabled) trigger.focus();
}
export function trapTab(event, modal) {
  if (event.key !== 'Tab') return;
  const controls = [...modal.querySelectorAll('button,input,select,textarea,summary,a[href],[tabindex="0"]')]
    .filter(el => !el.disabled && el.getClientRects().length);
  if (!controls.length) { event.preventDefault(); return; }
  const first = controls[0], last = controls[controls.length - 1];
  if (!modal.contains(document.activeElement) || (event.shiftKey && document.activeElement === first)) {
    event.preventDefault(); (event.shiftKey ? last : first).focus();
  } else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
}
