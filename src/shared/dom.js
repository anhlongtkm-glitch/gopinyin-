// State and behavior owned by shared/dom. Initialization is orchestrated by app/bootstrap.js.

export const state = {};

const domState = state;

export function initializeDom() {
  domState.$ = id => document.getElementById(id);
}
