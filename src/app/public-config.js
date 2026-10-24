(function () {
  const merge = (...sources) => Object.assign({}, ...sources.filter(Boolean));
  const windowRef = typeof window !== 'undefined' ? window : globalThis;

  const runtimeConfig = merge(
    windowRef.__APP_CONFIG__ || {},
    windowRef.__ENV__ || {},
    {
      APP_NAME: windowRef.GOPINYIN_APP_NAME || 'GoPinyin',
      SITE_URL: windowRef.GOPINYIN_SITE_URL || 'https://gopinyin.app',
      SUPPORT_EMAIL: windowRef.GOPINYIN_SUPPORT_EMAIL || 'hotro@gopinyin.app',
      PRO_VERIFY_URL: windowRef.GOPINYIN_PRO_VERIFY_URL || '',
      PRO_CONTENT_URL: windowRef.GOPINYIN_PRO_CONTENT_URL || '',
      BANK_NAME: windowRef.GOPINYIN_BANK_NAME || 'Vietcombank',
      BANK_BIN: windowRef.GOPINYIN_BANK_BIN || '970436',
      BANK_ACC: windowRef.GOPINYIN_BANK_ACC || '9342383345',
      BANK_OWNER: windowRef.GOPINYIN_BANK_OWNER || 'NGUYEN VAN LONG',
      AI_PROXY_URL: windowRef.GOPINYIN_AI_PROXY_URL || '',
      AI_PROXY_TOKEN: windowRef.GOPINYIN_AI_PROXY_TOKEN || '',
      DOMAIN: windowRef.GOPINYIN_DOMAIN || 'gopinyin.app'
    }
  );

  windowRef.APP_CONFIG = merge(windowRef.APP_CONFIG || {}, runtimeConfig);
  windowRef.__APP_CONFIG__ = windowRef.APP_CONFIG;

  if (!windowRef.PRO_VERIFY_URL && windowRef.APP_CONFIG.PRO_VERIFY_URL) {
    windowRef.PRO_VERIFY_URL = windowRef.APP_CONFIG.PRO_VERIFY_URL;
  }
  if (!windowRef.PRO_CONTENT_URL && windowRef.APP_CONFIG.PRO_CONTENT_URL) {
    windowRef.PRO_CONTENT_URL = windowRef.APP_CONFIG.PRO_CONTENT_URL;
  }
  if (!windowRef.GOPINYIN_SUPPORT_EMAIL && windowRef.APP_CONFIG.SUPPORT_EMAIL) {
    windowRef.GOPINYIN_SUPPORT_EMAIL = windowRef.APP_CONFIG.SUPPORT_EMAIL;
  }

  windowRef.GOPINYIN_APP_CONFIG = windowRef.APP_CONFIG;
})();
