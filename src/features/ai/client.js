import { requireAccount, accessToken, currentUser, isStudyAllowed } from "../auth/service.js";
import { aiProxyUrl } from "../../shared/service-config.js";
import { fetchWithTimeout } from "../../shared/http.js";
import models from "../../data/ai-models.json";
// State and behavior owned by features/ai/client. Initialization is orchestrated by app/bootstrap.js.

import { state as aiProvidersState, geminiUrl } from "./providers.js";

export const state = {};

const aiClientState = state;

export function aiServiceError(status, retryAfter, detail = '') {
  const delay = retryAfter || ([429, 402].includes(status) ? '60' : '');
  const seconds = Number(delay);
  const retryAt = delay ? (Number.isFinite(seconds) ? Date.now() + Math.max(0, seconds) * 1000 : Date.parse(delay)) : 0;
  const wait = retryAt > Date.now() ? Math.ceil((retryAt - Date.now()) / 1000) : 60;
  const message = status === 429 || status === 402
    ? 'Đã hết lượt AI miễn phí hoặc đang gọi quá nhanh. Đợi ' + wait + ' giây rồi bấm Thử lại; nếu vẫn hết lượt, hãy thử lại sau khi hạn mức được làm mới.'
    : status === 404
      ? 'Dịch vụ AI chưa khả dụng. Chủ website cần kiểm tra endpoint /api/ai và model Gemini.'
      : detail || 'Không kết nối được dịch vụ AI. Kiểm tra mạng rồi bấm Thử lại.';
  return Object.assign(new Error(message), { status, retryAt: Number.isFinite(retryAt) ? retryAt : 0 });
}

async function aiFetch(url, options) {
  try { return await fetchWithTimeout(url, options); }
  catch { throw aiServiceError(0); }
}

export function aiKindMeta(kind) {
  return aiClientState.AI_KINDS[kind] || aiClientState.AI_KINDS.sentence;
}

export function aiUnitOf(kind) {
  return aiKindMeta(kind).unit;
}

export function buildAiPrompt(userText, count, level, avoid, kind) {
  const n = Number(count) || 20;
  const k = aiClientState.AI_KINDS[kind] ? kind : 'sentence';
  /* Phần "tạo cái gì" đổi theo loại nội dung — các quy tắc định dạng bên dưới giữ nguyên */
  const askSentence = ['Hãy tạo đúng ' + n + ' câu tiếng Trung hoàn chỉnh, đúng ngữ pháp, tự nhiên, dùng được ngay trong giao tiếp (KHÔNG phải từ đơn lẻ).'];
  const askWord = ['Hãy tạo đúng ' + n + ' TỪ hoặc CỤM TỪ tiếng Trung (từ vựng) đúng chủ đề — KHÔNG phải câu dài, KHÔNG phải đoạn văn.', 'Mỗi mục là một từ/cụm từ ngắn gọn, thông dụng, dùng được ngay (thường 2–4 chữ Hán; có thể 1 chữ nếu là từ đơn thật sự cần thiết).', 'Ưu tiên danh từ, động từ, tính từ và cụm từ cố định mà người học cần nhớ để dùng trong tình huống này.'];
  const askBoth = ['Hãy tạo đúng ' + n + ' mục, chia ĐỀU làm hai phần cùng chủ đề: KHOẢNG MỘT NỬA là TỪ/CỤM TỪ ngắn (2–4 chữ Hán) và một nửa là CÂU hoàn chỉnh, tự nhiên.', 'Xen kẽ từ vựng và câu, đừng dồn hết từ vựng lên đầu.'];
  const ask = k === 'word' ? askWord : k === 'both' ? askBoth : askSentence;
  const rows = ['Bạn là trợ lý tạo bài học tiếng Trung cho người Việt muốn tập GIAO TIẾP.', 'Chủ đề người dùng yêu cầu: ' + userText, ...ask, /* ★ Tôn trọng giới hạn người dùng nêu trong chủ đề (số chữ, phong cách, ngành nghề…) */
  'Nếu người dùng nêu giới hạn cụ thể trong chủ đề (số chữ tối đa, ngành nghề, mức trang trọng, phong cách…), PHẢI tuân thủ đúng giới hạn đó.', level ? 'Trình độ tương đương ' + level + '.' : '', avoid && avoid.length ? 'KHÔNG được lặp lại các mục đã có: ' + avoid.join(' | ') : '',
  // ★ Cảnh báo: TUYỆT ĐỐI không dùng chữ cái Latin (A, B, C, …) hoặc chữ số (0-9) trong câu tiếng Trung.
  //   Nếu câu gốc có tên riêng/ký hiệu chứa chữ cái, hãy dịch sang chữ Hán tương đương (A→甲, B→乙, C→丙, …) hoặc dùng cách diễn đạt khác.
  //   Không được chèn chữ Latin lặp lại (vd "AAA" thay vì 1 chữ "A") — đây là lỗi thường gặp khi dịch các từ như "sóng A", "loại A", …',
  'QUY TẮC BẮT BUỘC:', '- Trường "zh" chỉ chứa chữ Hán (\u4e00-\u9fff), dấu câu tiếng Trung và khoảng trắng. KHÔNG chứa chữ cái Latin A-Z, a-z hoặc chữ số 0-9.', '- Pinyin viết đầy đủ dấu thanh (ā á ǎ à ē é ě è …) — KHÔNG dùng số thanh (ni3, hao3).', '- Nghĩa tiếng Việt tự nhiên, dùng được trong giao tiếp, không phiên âm Hán-Việt.',
  // ★ Chất lượng CƠ BẢN — tránh các câu như "请打一下表" ↔ "bật đồng hồ tính tiền"
  //   (dịch không sát nghĩa, tình huống lạ mà người bản ngữ ít nói):
  '- Bản dịch tiếng Việt phải SÁT với đúng nội dung tiếng Trung: nội dung và ngữ cảnh phải khớp 100% — KHÔNG thêm thắt, KHÔNG bỏ sót, KHÔNG dịch máy móc từng chữ.', '- Chỉ tạo nội dung THÔNG DỤNG, tình huống thực tế hàng ngày (mua sắm, đi lại, nhà hàng, khách sạn, công sở…). TUYỆT ĐỐI không tạo nội dung lạ, tình huống vô nghĩa hoặc cách dùng hiếm gặp.', '- ĐÚNG 1-1: số âm tiết pinyin phải BẰNG số chữ Hán của mục (không tính dấu câu) — mỗi chữ Hán ứng đúng một âm tiết, không thiếu không dư.', '- Áp dụng đúng quy tắc BIẾN ĐIỆU THANH: 一 đọc "yí" trước thanh 4 ("一下" = "yí xià"), đọc "yì" trước các thanh còn lại; 不 đọc "bú" trước thanh 4; âm tiết lặp trong từ láy đọc nhẹ (妈妈 = "mā ma").', 'BẮT BUỘC: chỉ trả về MẢNG JSON thuần, không giải thích, không markdown, không có ```json.', 'Mỗi phần tử: {"zh":"chữ Hán","py":"pinyin có dấu thanh","vi":"nghĩa tiếng Việt tự nhiên"}'];
  return rows.filter(Boolean).join('\n');
}
/* ★ Gọi AI. Mọi nhà cung cấp đều dùng API key → kiểm tra key ở MỘT chỗ.
   opt.temperature: sinh câu dùng 0.9 (cần đa dạng), DỊCH dùng thấp (0.2-0.3) để bám sát nghĩa.
   opt.image = {mime, data} (base64 thuần) → gửi kèm ảnh cho model đọc ảnh (dịch ảnh). */

/* ★ Gọi AI. Mọi nhà cung cấp đều dùng API key → kiểm tra key ở MỘT chỗ.
   opt.temperature: sinh câu dùng 0.9 (cần đa dạng), DỊCH dùng thấp (0.2-0.3) để bám sát nghĩa.
   opt.image = {mime, data} (base64 thuần) → gửi kèm ảnh cho model đọc ảnh (dịch ảnh). */
async function withAiAccount(request, serverVerified = false) {
  // The proxy verifies the bearer token on every request. An active lesson
  // does not need another full account sync before sending that token.
  if ((!serverVerified || !isStudyAllowed()) && !await requireAccount()) {
    throw new Error('Cần đăng nhập để tạo câu AI.');
  }
  const uid = currentUser()?.id;
  if (!uid || !isStudyAllowed()) throw new Error('Phiên học đã thay đổi hoặc mất kết nối.');
  const result = await request();
  if (currentUser()?.id !== uid || !isStudyAllowed()) throw new Error('Phiên học đã thay đổi hoặc mất kết nối.');
  return result;
}
export function callAi(provider, key, prompt, opt) {
  return withAiAccount(() => callAiUnchecked(provider, key, prompt, opt), !!aiProxyUrl());
}
async function callAiUnchecked(provider, key, prompt, opt) {
  /* ★ Nếu app cấu hình proxy AI (window.__gpAiProxy), chuyển cuộc gọi sang server —
     key AI nằm ở server (AI_KEY_* env), client KHÔNG lưu key plaintext.
     Không đặt proxy → giữ nguyên gọi thẳng provider (tương thích cũ). */
  if (aiProxyUrl()) return requestAiProxy(provider, prompt, opt);
  const cfg = aiProvidersState.AI_PROVIDERS[provider] || aiProvidersState.AI_PROVIDERS[aiProvidersState.AI_DEFAULT_PROVIDER];
  if (!key) throw new Error('Bạn chưa nhập API key ' + cfg.name + ' — mở "Tuỳ chọn nâng cao" rồi bấm "' + cfg.keyBtn + '" để lấy key (chỉ 1 lần).');
  const temp = opt && typeof opt.temperature === 'number' ? opt.temperature : .9;
  const img = opt && opt.image && opt.image.data ? opt.image : null;
  if (provider === 'openrouter') return requestOpenRouter(key, prompt, temp, img);
  let lastErr = '';
  for (const mdl of aiProvidersState.GEMINI_MODELS) {
    try {
      const reqParts = [{
        text: prompt
      }];
      if (img) reqParts.push({
        inline_data: {
          mime_type: img.mime,
          data: img.data
        }
      });
      const resp = await aiFetch(geminiUrl(mdl), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': key
        },
        body: JSON.stringify({
          contents: [{
            parts: reqParts
          }],
          generationConfig: {
            temperature: temp
          }
        })
      });
      if (!resp.ok) {
        if ([429, 401, 402, 403].includes(resp.status)) throw aiServiceError(resp.status, resp.headers.get('Retry-After'), 'Không xác thực được kết nối Gemini. Kiểm tra cấu hình API key.');
        lastErr = 'Gemini lỗi ' + resp.status + (resp.status === 429 ? ' (hết hạn mức — đợi 1 phút rồi thử lại, hoặc chuyển sang OpenRouter)' : resp.status === 404 ? ' (model không còn tồn tại)' : resp.status === 403 ? ' (không có quyền dùng model này — model này cần tài khoản đã bật thanh toán, hoặc API key không hợp lệ)' : resp.status === 400 ? ' (API key không hợp lệ)' : '');
        continue;
      }
      const d = await resp.json();
      const parts = d && d.candidates && d.candidates[0] && d.candidates[0].content && d.candidates[0].content.parts;
      const txt = parts ? parts.map(p => p.text || '').join('') : '';
      if (txt) return txt;
      lastErr = 'Gemini không trả nội dung.';
    } catch (e) {
      if (typeof e.status === 'number') throw e;
      lastErr = e && e.message || String(e);
    }
  }
  throw new Error(lastErr || 'Gemini không trả nội dung.');
}
/* ★ Gọi AI qua server proxy (window.__gpAiProxy): key nằm ở server, client chỉ gửi prompt.
   Dùng khi đã cấu hình proxy để không lưu API key plaintext trên máy khách. */

/* ★ Gọi AI qua server proxy (window.__gpAiProxy): key nằm ở server, client chỉ gửi prompt.
   Dùng khi đã cấu hình proxy để không lưu API key plaintext trên máy khách. */
export function callAiProxy(provider, prompt, opt) {
  return withAiAccount(() => requestAiProxy(provider, prompt, opt), true);
}
async function requestAiProxy(provider, prompt, opt) {
  const img = opt && opt.image && opt.image.data ? opt.image : null;
  const resp = await aiFetch(aiProxyUrl(), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + await accessToken()
    },
    body: JSON.stringify({
      provider,
      prompt,
      temperature: typeof opt?.temperature === 'number' ? opt.temperature : .9,
      image: img ? {
        mime: img.mime,
        data: img.data
      } : null
    })
  });
  if (!resp.ok) {
    let m = '';
    try {
      m = (await resp.json()).error || '';
    } catch (e) {}
    throw aiServiceError(resp.status, resp.headers.get('Retry-After'), m);
  }
  const d = await resp.json();
  if (d && d.text) return d.text;
  throw new Error('Máy chủ proxy không trả nội dung.');
}
/* ★ OpenRouter — chỉ dùng các model MIỄN PHÍ (đuôi ":free"). Thử lần lượt, model nào
   chết/hết hạn mức thì nhảy sang model kế tiếp. Dùng khi Gemini hết hạn mức. */

export function callOpenRouter(key, prompt, temp, img) {
  return withAiAccount(() => requestOpenRouter(key, prompt, temp, img));
}
async function requestOpenRouter(key, prompt, temp, img) {
  let lastErr = '';
  /* có ảnh → dùng content dạng mảng (text + image_url base64) */
  const content = img && img.data ? [{
    type: 'text',
    text: prompt
  }, {
    type: 'image_url',
    image_url: {
      url: 'data:' + img.mime + ';base64,' + img.data
    }
  }] : prompt;
  for (const mdl of aiClientState.OPENROUTER_MODELS) {
    try {
      const resp = await aiFetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + key
        },
        body: JSON.stringify({
          model: mdl,
          messages: [{
            role: 'user',
            content: content
          }],
          temperature: typeof temp === 'number' ? temp : .9
        })
      });
      if (!resp.ok) {
        if ([429, 401, 402, 403].includes(resp.status)) throw aiServiceError(resp.status, resp.headers.get('Retry-After'), 'Không xác thực được kết nối OpenRouter. Kiểm tra cấu hình API key.');
        lastErr = 'OpenRouter lỗi ' + resp.status + (resp.status === 401 ? ' (API key không hợp lệ)' : resp.status === 402 ? ' (hết hạn mức miễn phí)' : resp.status === 429 ? ' (gọi quá nhanh — đợi 1 phút)' : '');
        if (resp.status === 401) break; /* key sai → đổi model cũng vô ích */
        continue;
      }
      const d = await resp.json();
      const txt = d && d.choices && d.choices[0] && d.choices[0].message && d.choices[0].message.content;
      if (txt && txt.trim()) return txt;
      lastErr = 'OpenRouter không trả nội dung.';
    } catch (e) {
      if (typeof e.status === 'number') throw e;
      lastErr = e && e.message || String(e);
    }
  }
  throw new Error(lastErr || 'OpenRouter không trả nội dung.');
}
/* ★ Làm sạch pinyin AI trả về — bản viết lại chắc chắn hơn.
   Xử lý MỌI kiểu AI hay trả về:
     1) ni3 → nǐ          (số thanh dính liền)
     2) ni3 hao3 → nǐ hǎo
     3) ni3hao3 → nǐ hǎo  (số thanh làm ranh giới âm tiết, KHÔNG có dấu cách)
     4) ni3hao3ma5        (cả câu dính liền)
     5) nv / lv → nü / lü (không có số thanh — 'v' là cách gõ 'ü')
     6) lu:3 / nu:3 → lǚ   (kiểu cũ dùng 'u:')
     7) xi'an / nǚ'ér      (dấu nháy ngăn âm tiết → giữ tách âm tiết)
     8) zhōngguó viết liền theo TỪ → tự tách thành zhōng guó
   Trả về: các âm tiết ngăn nhau bằng ĐÚNG MỘT dấu cách. */

/* Bảng âm tiết pinyin hợp lệ (không dấu) — dùng để tách chuỗi viết liền */

export function initializeAiClient() {
  /* ★ LOẠI NỘI DUNG AI SINH RA:
     · sentence = câu hoàn chỉnh (mặc định, hành vi cũ)
     · word     = TỪ / CỤM TỪ (từ vựng) — không phải câu dài
     · both     = nửa từ vựng + nửa câu, cùng chủ đề
     unit dùng cho mọi nhãn đếm ("5 câu" / "5 từ" / "5 mục"). */
  aiClientState.AI_KINDS = {
    sentence: {
      unit: 'câu',
      label: 'Câu hoàn chỉnh',
      ico: '📝'
    },
    word: {
      unit: 'từ',
      label: 'Từ vựng',
      ico: '🔤'
    },
    both: {
      unit: 'mục',
      label: 'Câu + từ vựng',
      ico: '📝🔤'
    }
  };
  /* ★ OpenRouter — chỉ dùng các model MIỄN PHÍ (đuôi ":free"). Thử lần lượt, model nào
     chết/hết hạn mức thì nhảy sang model kế tiếp. Dùng khi Gemini hết hạn mức. */
  aiClientState.OPENROUTER_MODELS = models.openrouter;
}
