// Prefer deployment configuration; retain the integration hook used by older embeds.
export function aiProxyUrl() {
  const value = String(window.APP_CONFIG?.AI_PROXY_URL || window.__gpAiProxy || '').trim();
  return serviceUrl(value);
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
