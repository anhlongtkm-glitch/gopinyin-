export function timeoutSignal(milliseconds = 30000) {
  if (typeof AbortSignal.timeout === 'function') return AbortSignal.timeout(milliseconds);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), milliseconds);
  timer.unref?.();
  return controller.signal;
}

// The signal also bounds consumption of the response body.
export function fetchWithTimeout(url, options = {}, milliseconds = 30000) {
  return fetch(url, { ...options, signal: timeoutSignal(milliseconds) });
}
