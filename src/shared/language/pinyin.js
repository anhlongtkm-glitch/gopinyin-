// State and behavior owned by shared/language/pinyin. Initialization is orchestrated by app/bootstrap.js.

import { state as dataCatalogState } from "../../data/catalog.js";

import { normalize } from "./normalization.js";

export const state = {};

const languagePinyinState = state;

/* ★ Mapping chữ cái Latin đứng riêng trong câu Hán → chữ Hán phổ biến tương ứng
   + pinyin của chữ Hán đó. Dùng để sửa lỗi Gemini/OpenRouter đôi khi
   trả về câu Hán lẫn chữ Latin (vd "这款盒子要用 A A A 瓦吗?" — do hiểu nhầm
   "sóng A" thành 3 chữ A lặp). Thay bằng chữ Hán tương đương (A→甲, B→乙, …)
   kèm cập nhật pinyin để người dùng không thấy chữ Latin lẫn vào chữ Hán nữa. */
/* ★ Sửa câu Hán có chữ Latin lẫn vào: thay từng chữ cái Latin đơn lẻ bằng
   chữ Hán tương ứng theo LATIN_TO_HANZI, đồng thời cập nhật pinyin tương ứng.
   - Chuỗi Latin dài ≥2 ký tự KHÔNG phải chuỗi lặp (vd "ABC", "Bb") → trả về ok:false
     để caller bỏ câu đó (không sửa được an toàn).
   - Chuỗi lặp (AAA, BBB) → tách từng ký tự rồi thay bình thường.
   - Số ký tự Hán+Latin phải KHỚP số âm tiết pinyin, nếu không cũng bỏ.
   - Khoảng trắng giữa 2 chữ Hán sau khi thay được tự động gộp lại. */
export function sanitizeLatinInChinese(zh, py) {
  if (!zh || !/[A-Za-z]/.test(zh)) return {
    zh,
    py,
    ok: true,
    changed: false
  };
  const badMatch = zh.match(/[A-Za-z]{2,}/);
  if (badMatch && !/^(.)\1+$/.test(badMatch[0])) {
    return {
      zh,
      py,
      ok: false,
      reason: 'chuỗi Latin không lặp dài ≥2: "' + badMatch[0] + '"'
    };
  }
  const pySyllables = String(py || '').trim().split(/\s+/).filter(Boolean);
  const hanOrLatin = [];
  for (const ch of zh) {
    if (/[A-Za-z]/.test(ch)) hanOrLatin.push(ch);else if (/[\u3400-\u9fff]/.test(ch)) hanOrLatin.push(ch);
  }
  if (hanOrLatin.length !== pySyllables.length) {
    return {
      zh,
      py,
      ok: false,
      reason: `số đơn vị Hán+Latin (${hanOrLatin.length}) ≠ số âm tiết pinyin (${pySyllables.length})`
    };
  }
  const newPy = [...pySyllables];
  let hi = 0;
  let newZh = '';
  for (const ch of zh) {
    if (/[A-Za-z]/.test(ch)) {
      const map = dataCatalogState.LATIN_TO_HANZI[ch.toUpperCase()];
      if (!map) return {
        zh,
        py,
        ok: false,
        reason: 'không có mapping cho chữ "' + ch + '"'
      };
      newZh += map.hz;
      newPy[hi] = map.py;
      hi++;
    } else {
      newZh += ch;
      if (/[\u3400-\u9fff]/.test(ch)) hi++;
    }
  }
  let prev;
  do {
    prev = newZh;
    newZh = newZh.replace(/([\u3400-\u9fff])\s+([\u3400-\u9fff])/g, '$1$2');
  } while (newZh !== prev);
  return {
    zh: newZh,
    py: newPy.join(' '),
    ok: true,
    changed: true
  };
}

/* Tách 1 chuỗi pinyin viết liền (đã bỏ số thanh, đã bỏ dấu) thành các âm tiết */

/* Tách 1 chuỗi pinyin viết liền (đã bỏ số thanh, đã bỏ dấu) thành các âm tiết */
export function splitPinyinSyllables(str) {
  const s = String(str || '').toLowerCase().replace(/[^a-zü]/g, '');
  if (!s) return [];
  const out = [];
  let i = 0;
  while (i < s.length) {
    let matched = '';
    for (let L = Math.min(6, s.length - i); L >= 1; L--) {
      const cand = s.slice(i, i + L);
      if (languagePinyinState.PINYIN_SYLLABLES.has(cand)) {
        matched = cand;
        break;
      }
    }
    if (matched) {
      out.push(matched);
      i += matched.length;
    } else {
      // không khớp âm tiết nào → gom nguyên âm+phụ âm tới nguyên âm kế tiếp
      const m = s.slice(i).match(/^[^aeiouü]*[aeiouü]+/);
      const take = m ? m[0] : s[i];
      out.push(take);
      i += take.length;
    }
  }
  return out;
}

/* Đặt dấu thanh cho 1 âm tiết không dấu: quy tắc a > e > o > (i/u/ü cuối) */

export function applyTone(syl, t) {
  if (!t || t < 1 || t > 4) return syl;
  const low = syl.toLowerCase();
  let ch = null;
  if (low.includes('a')) ch = 'a';else if (low.includes('e')) ch = 'e';else if (low.includes('o')) ch = 'o';else {
    /* 'iu' → dấu trên u ; 'ui' → dấu trên i ; còn lại nguyên âm cuối */
    const vm = low.match(/[iuü]/g);
    if (vm) ch = vm[vm.length - 1];else ch = low[0];
  }
  if (!ch) return syl;
  const marks = languagePinyinState.TONE_MARKS[ch];
  if (!marks) return syl;
  const idx = low.indexOf(ch);
  if (idx < 0) return syl;
  /* giữ nguyên chữ hoa nếu có */
  const isUpper = syl[idx] !== low[idx];
  let rep = marks[t - 1];
  if (isUpper) rep = rep.toUpperCase();
  return syl.slice(0, idx) + rep + syl.slice(idx + 1);
}

/* ★ Chuyển 1 TOKEN (có thể chứa nhiều âm tiết + số thanh) thành dạng có dấu.
   Ví dụ: "ni3hao3" → "nǐ hǎo" ; "zhong1guo2" → "zhōng guó"
   Xử lý ca khó: "Yuenan4" (AI viết liền 2 âm tiết, chỉ số thanh ở CUỐI)
     → tách "Yue"+"nan", gán thanh 4 cho âm tiết cuối → "yuè nàn"
   Xử lý erhua: "wan2r" → "wánr" (giữ 'r' dính vào âm tiết, KHÔNG tách thành "wán r") */

/* ★ Chuyển 1 TOKEN (có thể chứa nhiều âm tiết + số thanh) thành dạng có dấu.
   Ví dụ: "ni3hao3" → "nǐ hǎo" ; "zhong1guo2" → "zhōng guó"
   Xử lý ca khó: "Yuenan4" (AI viết liền 2 âm tiết, chỉ số thanh ở CUỐI)
     → tách "Yue"+"nan", gán thanh 4 cho âm tiết cuối → "yuè nàn"
   Xử lý erhua: "wan2r" → "wánr" (giữ 'r' dính vào âm tiết, KHÔNG tách thành "wán r") */
export function numToneToDiacritic(token) {
  let w = String(token || '');
  if (!w) return '';
  w = w.replace(/u:/gi, 'ü').replace(/U:/g, 'Ü');
  w = w.replace(/v/g, 'ü').replace(/V/g, 'Ü');
  if (!/[1-5]/.test(w)) return w;
  /* Quét tuần tự: mỗi lần gặp số thanh → chốt âm tiết vừa gom được với thanh đó.
     Lưu ý ERHUA: âm tiết kết thúc bằng 'r' (wánr, huìr) là 1 âm tiết trọn vẹn. */
  const out = [];
  let buf = '';
  const flush = tone => {
    if (buf) {
      out.push({
        syl: buf,
        tone: tone || 0
      });
      buf = '';
    }
  };
  for (let i = 0; i < w.length; i++) {
    const c = w[i];
    if (/[1-5]/.test(c)) {
      /* ★ ERHUA: "wan2r" → số 2 rồi 'r'. Âm tiết 儿 hoá trong tiếng Trung
         LUÔN chứa nguyên âm (wan, yi, hui, na, dian…). Nếu buf có nguyên âm thì
         'r' thuộc về âm tiết này → nuốt vào, KHÔNG tách thành âm tiết riêng. */
      if (w[i + 1] && /^r$/i.test(w[i + 1]) && /[aeiouü]/i.test(buf)) {
        buf += 'r';
        i++;
      }
      flush(Number(c));
    } else if (/[a-züA-ZÜ]/.test(c)) {
      buf += c;
    } else {
      flush(0);
    }
  }
  if (buf) flush(0);
  /* ★ Nếu 1 mảnh chứa NHIỀU âm tiết viết liền (vd "Yuenan" với thanh ở cuối),
     tách bằng bảng âm tiết. Thanh điệu gán cho âm tiết ĐẦU — vì khi AI viết liền
     một từ nhiều âm tiết, số thanh đặt sau cả chuỗi thường thuộc về âm tiết đầu
     (vd "Yuenan4" = Yuè+nán, "Beijing3" = Běi+jīng). Nếu để âm tiết cuối sẽ sai. */
  const expanded = [];
  for (const o of out) {
    const plain = stripToneMarks(o.syl).plain.toLowerCase();
    /* ★ ERHUA: âm tiết kết thúc bằng 'r' — trước 'r' có thể là nguyên âm (huir, nár)
       hoặc 'n'/'ng' (wanr, dianr, huir). Tất cả đều là 1 âm tiết trọn vẹn,
       KHÔNG được tách thành "wan"+"r". */
    const isErhua = /(?:[aeiouü]|[aeiouü]n|[aeiouü]ng)r$/i.test(plain);
    if (!isErhua && o.syl.length > 2 && /^[a-zü]+$/.test(plain)) {
      const syls = splitPinyinSyllables(plain);
      if (syls.length > 1 && syls.join('') === plain) {
        syls.forEach((sy, k) => {
          expanded.push({
            syl: sy,
            tone: k === 0 ? o.tone : 0
          }); /* thanh cho âm tiết ĐẦU */
        });
        continue;
      }
    }
    expanded.push(o);
  }
  return expanded.map(o => applyTone(o.syl, o.tone)).join(' ');
}

/* ★ Âm tiết có nhận được 'r' erhua ở cuối không? (wán→wánr, diǎn→diǎnr, huì→huìr)
   Bỏ dấu thanh rồi xét: phải kết thúc bằng NGUYÊN ÂM, hoặc 'n'/'ng' có nguyên âm
   trước. LƯU Ý: "diǎn" kết thúc bằng 'n' → nếu chỉ xét nguyên âm cuối sẽ SAI. */

/* ★ Âm tiết có nhận được 'r' erhua ở cuối không? (wán→wánr, diǎn→diǎnr, huì→huìr)
   Bỏ dấu thanh rồi xét: phải kết thúc bằng NGUYÊN ÂM, hoặc 'n'/'ng' có nguyên âm
   trước. LƯU Ý: "diǎn" kết thúc bằng 'n' → nếu chỉ xét nguyên âm cuối sẽ SAI. */
export function canTakeErhua(syl) {
  const p = normalize(syl).replace(/[^a-zü]/g, '');
  return /(?:[aeiouü]|[aeiouü]n|[aeiouü]ng)$/.test(p);
}

/* ★ Tách 1 chuỗi pinyin (KHÔNG dấu) thành các âm tiết, GIỮ ĐÚNG ERHUA.
   Vì sao cần: "diǎnr" (点儿) chỉ là MỘT âm tiết trọn vẹn, nhưng nếu đem
   splitPinyinSyllables("dianr") thì ra ["dian","r"] → bị chèn dấu cách thành
   "diǎn r" (SAI — dòng đáp án hiện "cǎo méi yǒu diǎn r suān" và chữ 儿 bị lặp).
   → Bóc 'r' erhua ra trước, tách phần lõi, rồi GẮN 'r' lại vào âm tiết cuối:
        "dianr"  → ["dianr"]
        "yidianr"→ ["yi","dianr"]
        "zhongguo"→ ["zhong","guo"]   (không phải erhua → như cũ)
   Trả về null nếu không phải pinyin (không tách được an toàn). */

/* ★ Tách 1 chuỗi pinyin (KHÔNG dấu) thành các âm tiết, GIỮ ĐÚNG ERHUA.
   Vì sao cần: "diǎnr" (点儿) chỉ là MỘT âm tiết trọn vẹn, nhưng nếu đem
   splitPinyinSyllables("dianr") thì ra ["dian","r"] → bị chèn dấu cách thành
   "diǎn r" (SAI — dòng đáp án hiện "cǎo méi yǒu diǎn r suān" và chữ 儿 bị lặp).
   → Bóc 'r' erhua ra trước, tách phần lõi, rồi GẮN 'r' lại vào âm tiết cuối:
        "dianr"  → ["dianr"]
        "yidianr"→ ["yi","dianr"]
        "zhongguo"→ ["zhong","guo"]   (không phải erhua → như cũ)
   Trả về null nếu không phải pinyin (không tách được an toàn). */
export function splitPinyinKeepingErhua(plain) {
  const p = String(plain || '').toLowerCase();
  if (!/^[a-zü]+$/.test(p) || p.length < 3) return null;
  const isErhua = /(?:[aeiouü]|[aeiouü]n|[aeiouü]ng)r$/.test(p);
  const core = isErhua ? p.slice(0, -1) : p;
  const syls = splitPinyinSyllables(core);
  if (!syls.length || syls.join('') !== core) return null;
  if (isErhua) syls[syls.length - 1] += 'r';
  return syls;
}

/* ★ Chuẩn hoá pinyin: bỏ dấu câu, chuyển số thanh → dấu, tách âm tiết viết liền */

/* ★ Chuẩn hoá pinyin: bỏ dấu câu, chuyển số thanh → dấu, tách âm tiết viết liền */
export function fixPinyin(p) {
  if (p == null) return '';
  let s = String(p).trim();
  if (!s) return '';
  /* 1) bỏ rào markdown / ngoặc bao quanh cả chuỗi */
  s = s.replace(/^```[a-z]*\s*/i, '').replace(/\s*```$/, '');
  s = s.replace(/^[\s"'“”‘’\[\]()【】]+|[\s"'“”‘’\[\]()【】]+$/g, '');
  /* 2) 'u:' / 'v' (cách gõ 'ü') → 'ü' — PHẢI chạy TRƯỚC khi bỏ dấu câu,
        nếu không dấu ':' sẽ bị xoá mất (lu:3 → "lu 3") */
  s = s.replace(/u:/gi, 'ü').replace(/U:/g, 'Ü');
  s = s.replace(/v/g, 'ü').replace(/V/g, 'Ü');
  /* 3) dấu nháy ngăn âm tiết (xi'an, nǚ'ér) → tạm đổi thành khoảng trắng */
  s = s.replace(/['’`]/g, ' ');
  /* 4) bỏ dấu câu cả Trung lẫn Latin (KHÔNG xoá dấu thanh pinyin).
        LƯU Ý: KHÔNG dùng dải [\] hay dải rộng \uff00-\uffef trong character class
        vì sẽ vô tình nuốt ký tự dấu thanh như ǐ ǎ ǒ ǔ. Liệt kê tường minh. */
  s = s.replace(/[，。？！、；：·〈〉《》「」『』【】（）〔〕…—–～]/g, ' ');
  s = s.replace(/[!?,.;:(){}<>|~@#$%^&*_+="'`]/g, ' ');
  s = s.replace(/[\u201c\u201d\u2018\u2019\u3010\u3011\u300a\u300b]/g, ' ');
  s = s.replace(/\uFF01|\uFF1F|\uFF0C|\uFF0E|\uFF1B|\uFF1A|\uFF08|\uFF09|\uFF3B|\uFF3D|\uFF5B|\uFF5D|\uFF0F|\uFF5C|\uFF20|\uFF03|\uFF05|\uFF06|\uFF0A|\uFF0B|\uFF0D|\uFF1D|\uFF5E/g, ' ');
  s = s.replace(/[\/\\\[\]]/g, ' ');
  s = s.replace(/\s+/g, ' ').trim();
  if (!s) return '';
  /* 5) xử lý từng token */
  const toks = s.split(' ').filter(Boolean);
  const out = [];
  for (const tk of toks) {
    if (/[1-5]/.test(tk)) {
      /* có số thanh → chuyển trực tiếp (có thể ra nhiều âm tiết) */
      const conv = numToneToDiacritic(tk);
      if (conv) out.push(conv);
      continue;
    }
    /* KHÔNG có số thanh */
    if (/[\u3400-\u9fff]/.test(tk)) {
      out.push(tk);
      continue;
    }
    /* Giữ lại chữ Latin + ü + MỌI ký tự nguyên âm có dấu thanh pinyin.
       TRƯỚC ĐÂY dùng /[^a-zA-ZüÜ]/g → xoá mất ǎ/ǐ/ǒ/ǔ khiến "hǎo" thành "ho".
       Nay dùng thuộc tính Unicode \p{Script=Latin} để giữ nguyên dấu. */
    const bare = tk.replace(/[^\p{Script=Latin}]/gu, '');
    if (!bare) continue;
    const hasToneDiacritic = /[āáǎàēéěèōóǒòīíǐìūúǔùǖǘǚǜ]/.test(bare);
    /* Nếu token đã có dấu thanh → chỉ cần chuẩn hoá, KHÔNG tách (giữ đúng như AI trả) */
    if (hasToneDiacritic) {
      /* thử tách nếu là nhiều âm tiết viết liền (zhōngguó → zhōng guó).
         ★ Giữ nguyên erhua: "diǎnr" phải ở lại 1 âm tiết (KHÔNG thành "diǎn r"). */
      const info = stripToneMarks(bare);
      const plainLow = info.plain.toLowerCase();
      const syls = splitPinyinKeepingErhua(plainLow);
      if (syls && syls.length > 1) {
        out.push(syls.map((sy, k) => applyTone(sy, info.tones[k] || 0)).join(' '));
        continue;
      }
      out.push(bare);
      continue;
    }
    /* Chuỗi latin KHÔNG dấu: thử tách thành nhiều âm tiết pinyin (zhongguo → zhong guo).
       ★ Vẫn giữ erhua: "dianr" ở lại 1 âm tiết (KHÔNG thành "dian r"). */
    const low = bare.toLowerCase();
    const syls2 = splitPinyinKeepingErhua(low);
    if (syls2 && syls2.length > 1) {
      out.push(syls2.join(' '));
      continue;
    }
    out.push(low);
  }
  /* 6) GỘP ERHUA: "wán r" → "wánr", "huì r" → "huìr".
        Chuẩn pinyin viết 儿 hoá dính liền vào âm tiết gốc.
        Chỉ gộp khi âm tiết trước kết thúc bằng NGUYÊN ÂM (kể cả có dấu thanh)
        và âm tiết sau đúng là "r" đứng riêng. */
  const merged = [];
  for (let i = 0; i < out.length; i++) {
    const cur = out[i],
      nxt = out[i + 1];
    if (nxt !== undefined && /^r$/i.test(nxt.replace(/\s/g, '')) && canTakeErhua(cur)) {
      merged.push(cur.replace(/\s$/, '') + 'r');
      i++; /* bỏ qua 'r' đã gộp */
      continue;
    }
    merged.push(cur);
  }
  return merged.join(' ').replace(/\s+/g, ' ').trim().toLowerCase();
}

/* Bản đồ ký tự có DẤU THANH → (nguyên âm gốc, số thanh 1-4).
   Dùng cho tách/ghép pinyin viết liền (stripToneMarks). */

/* Bỏ dấu thanh khỏi 1 chuỗi pinyin, đồng thời ghi lại thanh của từng âm tiết
   để có thể tách chuỗi viết liền rồi gán lại dấu đúng vị trí.
   Ví dụ: "zhōngguó" → { plain:"zhongguo", tones:[1,2] } */
export function stripToneMarks(str) {
  const s = String(str || '');
  let plain = '';
  const tones = [];
  for (const ch of s) {
    const info = languagePinyinState.TONE_MAP[ch];
    if (info) {
      plain += info.base;
      tones.push(info.tone);
    } else {
      plain += ch; /* phụ âm/âm tiết chưa có dấu → không ghi thanh */
    }
  }
  return {
    plain,
    tones
  };
}
/* ★ Lấy nghĩa tiếng Việt từ 1 hàng AI — AI hay ĐỔI TÊN trường hoặc bỏ trống
   (vi / vietnamese / nghia / meaning / dich / translation / vn / viText…) */

export function initializeLanguagePinyin() {
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
  languagePinyinState.PINYIN_SYLLABLES = new Set(('a ai an ang ao e ei en eng er o ou ' + 'ba bai ban bang bao bei ben beng bi bian biao bie bin bing bo bu ' + 'pa pai pan pang pao pei pen peng pi pian piao pie pin ping po pou pu ' + 'ma mai man mang mao me mei men meng mi mian miao mie min ming miu mo mou mu ' + 'fa fan fang fei fen feng fo fou fu ' + 'da dai dan dang dao de dei den deng di dia dian diao die ding diu dong dou du duan dui dun duo ' + 'ta tai tan tang tao te teng ti tian tiao tie ting tong tou tu tuan tui tun tuo ' + 'na nai nan nang nao ne nei nen neng ni nian niang niao nie nin ning niu nong nou nu nuan nuo nue nü nüe ' + 'la lai lan lang lao le lei leng li lia lian liang liao lie lin ling liu lo long lou lu luan lun luo lue lü lüe ' + 'ga gai gan gang gao ge gei gen geng gong gou gu gua guai guan guang gui gun guo ' + 'ka kai kan kang kao ke ken keng kong kou ku kua kuai kuan kuang kui kun kuo ' + 'ha hai han hang hao he hei hen heng hong hou hu hua huai huan huang hui hun huo ' + 'ji jia jian jiang jiao jie jin jing jiong jiu ju juan jue jun ' + 'qi qia qian qiang qiao qie qin qing qiong qiu qu quan que qun ' + 'xi xia xian xiang xiao xie xin xing xiong xiu xu xuan xue xun ' + 'zha zhai zhan zhang zhao zhe zhei zhen zheng zhi zhong zhou zhu zhua zhuai zhuan zhuang zhui zhun zhuo ' + 'cha chai chan chang chao che chen cheng chi chong chou chu chua chuai chuan chuang chui chun chuo ' + 'sha shai shan shang shao she shei shen sheng shi shou shu shua shuai shuan shuang shui shun shuo ' + 'ran rang rao re ren reng ri rong rou ru rua ruan rui run ruo ' + 'za zai zan zang zao ze zei zen zeng zi zong zou zu zuan zui zun zuo ' + 'ca cai can cang cao ce cen ceng ci cong cou cu cuan cui cun cuo ' + 'sa sai san sang sao se sen seng si song sou su suan sui sun suo ' + 'ya yan yang yao ye yi yin ying yo yong you yu yuan yue yun ' + 'wa wai wan wang wei wen weng wo wu ' + 'n ng m hm hng r').split(' '));
  /* Đặt dấu thanh cho 1 âm tiết không dấu: quy tắc a > e > o > (i/u/ü cuối) */
  languagePinyinState.TONE_MARKS = {
    a: ['ā', 'á', 'ǎ', 'à'],
    e: ['ē', 'é', 'ě', 'è'],
    o: ['ō', 'ó', 'ǒ', 'ò'],
    i: ['ī', 'í', 'ǐ', 'ì'],
    u: ['ū', 'ú', 'ǔ', 'ù'],
    ü: ['ǖ', 'ǘ', 'ǚ', 'ǜ']
  };
  /* Bản đồ ký tự có DẤU THANH → (nguyên âm gốc, số thanh 1-4).
     Dùng cho tách/ghép pinyin viết liền (stripToneMarks). */
  languagePinyinState.TONE_MAP = {};
  (function () {
    const m = {
      a: 'āáǎà',
      e: 'ēéěè',
      o: 'ōóǒò',
      i: 'īíǐì',
      u: 'ūúǔù',
      ü: 'ǖǘǚǜ'
    };
    for (const base in m) {
      const arr = [...m[base]];
      arr.forEach((ch, k) => {
        languagePinyinState.TONE_MAP[ch] = {
          base,
          tone: k + 1
        };
      });
    }
  })();
  /* Bỏ dấu thanh khỏi 1 chuỗi pinyin, đồng thời ghi lại thanh của từng âm tiết
     để có thể tách chuỗi viết liền rồi gán lại dấu đúng vị trí.
     Ví dụ: "zhōngguó" → { plain:"zhongguo", tones:[1,2] } */
}
