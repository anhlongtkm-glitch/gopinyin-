import { dataOwner } from "../../shared/storage/account-data.js";
// State and behavior owned by features/ai/providers. Initialization is orchestrated by app/bootstrap.js.

export const state = {};

const aiProvidersState = state;

export function geminiUrl(m) {
  return 'https://generativelanguage.googleapis.com/v1beta/models/' + m + ':generateContent';
}

export function aiLsGet(k, def) {
  try {
    return localStorage.getItem(k) || def;
  } catch (e) {
    return def;
  }
}

export function aiLsSet(k, v) {
  try {
    localStorage.setItem(k, v);
  } catch (e) {}
}
// Provider keys stay on this device and are isolated by account UUID.
export function aiKeyStore(prov, v) {
  try {
    if (dataOwner()) localStorage.setItem('gp:device-ai-key:' + dataOwner() + ':' + prov, v || '');
  } catch (e) {}
}

export function aiKeyLoad(prov) {
  try {
    const v = localStorage.getItem('gp:device-ai-key:' + dataOwner() + ':' + prov);
    if (v != null && v !== '') return v;

  } catch (e) {}
  return '';
}

/* ═══════════════════════════════════════════════════════════
   ★ AI SINH CÂU — VIẾT PROMPT → HỌC NGAY
   • AI viết đợt câu đầu, bạn học luôn.
   • Sắp hết câu thì AI TỰ viết tiếp — không giới hạn số lượng.
   • Câu mới KHÔNG BAO GIỜ lặp câu cú (tập seen trong cùng phiên).
   • Phiên học KHÔNG lưu tiến độ: bấm "← Thư viện" là xong.
   ═══════════════════════════════════════════════════════════ */

export function initializeAiProviders() {
  /* ═══════════════════════════════════════════════════════════
     ★ AI SINH CÂU — bạn viết prompt → AI tạo câu tiếng Trung hoàn chỉnh
     ★ CHỈ GIỮ NHỮNG DỊCH VỤ THỰC SỰ DÙNG ĐƯỢC: Google Gemini (chính)
       + OpenRouter (dự phòng khi Gemini hết hạn mức). Cả hai đều dùng
       API key MIỄN PHÍ, không đăng nhập, không popup → chạy được ở mọi nơi.
     ★ Không giới hạn số lượng: "Tạo thêm" ghi thêm vào bộ đang học
     ═══════════════════════════════════════════════════════════ */
  /* ★ CẤU HÌNH NHÀ CUNG CẤP — một chỗ duy nhất: tên, trang lấy API key, chữ trên nút,
     hướng dẫn, placeholder ô key. Dropdown + hàng "Lấy API key" đọc từ đây. */
  aiProvidersState.AI_PROVIDERS = {
    gemini: {
      name: 'Google Gemini',
      keyUrl: 'https://aistudio.google.com/app/apikey',
      keyBtn: '🔑 Lấy API key Gemini (miễn phí)',
      keyHint: 'Bấm nút trên → đăng nhập tài khoản Google → bấm <b>“Create API key”</b> → <b>sao chép</b> key rồi dán vào ô “API key” phía trên. Key chỉ lưu trên máy bạn.',
      ph: 'Dán API key Gemini vào đây (lưu trên máy bạn)'
    },
    openrouter: {
      name: 'OpenRouter',
      keyUrl: 'https://openrouter.ai/keys',
      keyBtn: '🔑 Lấy API key OpenRouter (miễn phí)',
      keyHint: 'Bấm nút trên → đăng nhập bằng Google/GitHub → bấm <b>“Create Key”</b> → <b>sao chép</b> key rồi dán vào ô “API key” phía trên. App chỉ dùng các model có đuôi <b>:free</b> nên không mất tiền.',
      ph: 'Dán API key OpenRouter vào đây (lưu trên máy bạn)'
    }
  };
  aiProvidersState.AI_DEFAULT_PROVIDER = 'gemini';
  // ★ Từ 09/10/2026 free tier CHỈ còn dòng Flash-Lite (model Flash thường → trả phí).
  // → Thử gemini-2.0-flash-lite (chắc chắn dùng được key miễn phí) TRƯỚC, rồi các Lite khác.
  // Model không tồn tại/hết hạn mức/không có quyền thì tự nhảy sang model kế tiếp.
  aiProvidersState.GEMINI_MODELS = ['gemini-2.0-flash-lite', 'gemini-2.5-flash-lite', 'gemini-3.1-flash-lite', 'gemini-3.5-flash-lite'];
  aiProvidersState.AI_PROV_KEY = 'cts:ai:provider';
  aiProvidersState.AI_KEY_KEY = 'cts:ai:key';
}
