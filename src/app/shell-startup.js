import { enterWorkspace, showView } from "./navigation.js";
import { closeModal } from "../shared/dialogs.js";
export function initializeAppShellStartup() {
  enterWorkspace();
  document.addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    const open = document.querySelectorAll('.modal:not([hidden])');
    if (open.length) closeModal(open[open.length - 1].id);
  });
  document.querySelector('.ws-sideBrand')?.addEventListener('click', () => showView('dash'));
}
