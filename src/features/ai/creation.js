// One decision per new lesson, before spending an AI request.
let cancelPending;
export function requestAiSaveChoice(name) {
  cancelAiSaveChoice();
  const dialog = document.getElementById('aiCreateDialog');
  const nameInput = document.getElementById('aiCreateName');
  document.getElementById('aiCreateClose').onclick = cancelAiSaveChoice;
  nameInput.value = name;
  dialog.returnValue = '';
  return new Promise(resolve => {
    const finish = value => {
      dialog.removeEventListener('close', closed);
      nameInput.removeEventListener('keydown', nameKey);
      if (cancelPending === cancel) cancelPending = null;
      resolve(value);
    };
    const cancel = () => finish(null);
    const closed = () => {
      if (dialog.open) return;
      const choice = dialog.returnValue;
      finish(choice === 'save' ? { save: true, name: (nameInput.value.trim() || name).slice(0,80) } : choice === 'temporary' ? { save: false, name } : null);
    };
    const nameKey = event => {
      if (event.key !== 'Enter' || event.isComposing) return;
      event.preventDefault(); dialog.querySelector('[value="save"]').click();
    };
    cancelPending = cancel;
    dialog.addEventListener('close', closed);
    nameInput.addEventListener('keydown', nameKey);
    dialog.showModal();
  });
}
export function cancelAiSaveChoice() {
  cancelPending?.();
  const dialog = document.getElementById('aiCreateDialog');
  if (dialog?.open) dialog.close('cancel');
}
