// Prefer deployment configuration; retain the integration hook used by older embeds.
export function aiProxyUrl() {
  const configured = window.APP_CONFIG?.AI_PROXY_URL;
  // Older embeds may explicitly opt into their personal-key connection.
  const value = configured || window.__gpAiProxy;
  if (configured === false || value === false) return '';
  const endpoint = String(value || '/api/ai').trim();
  // A file preview has no same-origin server; keep its guest shell usable.
  if (location.protocol === 'file:' && !/^https?:\/\//i.test(endpoint)) return '';
  return serviceUrl(endpoint);
}
export function pronApiUrl() {
  return serviceUrl(String(window.APP_CONFIG?.PRON_API_URL || window.PRON_API || '/api/pron').trim());
}
function serviceUrl(value) {
  if (!value) return '';
  const url = new URL(value, location.href);
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) {
    throw new Error('Địa chỉ dịch vụ không hợp lệ.');
  }
  return url.href;
}
