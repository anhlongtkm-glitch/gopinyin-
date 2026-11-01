export const AI_INITIAL_COUNT = 10;
export const AI_REFILL_COUNT = 10;
export const AI_REFILL_EVERY = 5;
export function completedAiItems(typing) {
  return Math.max(0, Math.min(typing.order.length, typing.index + (typing.awaitingEnter ? 1 : 0)));
}
export function aiRefillDue(typing, lastBoundary = 0) {
  return completedAiItems(typing) - lastBoundary >= AI_REFILL_EVERY;
}
