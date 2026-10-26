(function () {
  const merge = (...sources) => Object.assign({}, ...sources.filter(Boolean));
  const windowRef = typeof window !== 'undefined' ? window : globalThis;

  const runtimeConfig = merge(
    {
      SUPABASE_URL: windowRef.GOPINYIN_SUPABASE_URL || '',
      SUPABASE_PUBLISHABLE_KEY: windowRef.GOPINYIN_SUPABASE_PUBLISHABLE_KEY || '',
      APP_NAME: windowRef.GOPINYIN_APP_NAME || 'GoPinyin',
      SITE_URL: windowRef.GOPINYIN_SITE_URL || 'https://gopinyin.io.vn',
      SUPPORT_EMAIL: windowRef.GOPINYIN_SUPPORT_EMAIL || 'hotro@gopinyin.app',
      AI_PROXY_URL: windowRef.GOPINYIN_AI_PROXY_URL || '',
      DOMAIN: windowRef.GOPINYIN_DOMAIN || 'gopinyin.io.vn'
    },
    windowRef.__APP_CONFIG__ || {},
    windowRef.__ENV__ || {}
  );

  windowRef.APP_CONFIG = merge(windowRef.APP_CONFIG || {}, runtimeConfig);
  windowRef.__APP_CONFIG__ = windowRef.APP_CONFIG;

  if (!windowRef.GOPINYIN_SUPPORT_EMAIL && windowRef.APP_CONFIG.SUPPORT_EMAIL) {
    windowRef.GOPINYIN_SUPPORT_EMAIL = windowRef.APP_CONFIG.SUPPORT_EMAIL;
  }

  windowRef.GOPINYIN_APP_CONFIG = windowRef.APP_CONFIG;
})();
