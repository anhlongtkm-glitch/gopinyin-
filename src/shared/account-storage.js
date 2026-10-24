// State and behavior owned by shared/account-storage. Initialization is orchestrated by app/bootstrap.js.

export const state = {};

const accountStorageState = state;

export function initializeAccountStorage() {
  accountStorageState.$ = id => document.getElementById(id);
  accountStorageState.LS = {
    users: 'gp:users',
    user: 'gp:user',
    pro: 'gp:pro',
    proPlan: 'gp:proPlan',
    goal: 'gp:dailyGoal',
    daily: 'gp:daily',
    streak: 'gp:streak',
    best: 'gp:bestScore',
    seenLanding: 'gp:seenLanding'
  };
  accountStorageState.lsGet = (k, d) => {
    try {
      const v = localStorage.getItem(k);
      return v == null ? d : JSON.parse(v);
    } catch (e) {
      return d;
    }
  };
  accountStorageState.lsSet = (k, v) => {
    try {
      localStorage.setItem(k, typeof v === 'string' ? v : JSON.stringify(v));
    } catch (e) {}
  };
  accountStorageState.$h = (sel, root) => (root || document).querySelector(sel);
  accountStorageState.$$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));
}
