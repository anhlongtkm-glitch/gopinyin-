// State and behavior owned by shared/audio/typing-sfx. Initialization is orchestrated by app/bootstrap.js.

export const state = {};

const audioTypingSfxState = state;

export function sfxCtx() {
  if (audioTypingSfxState._sfxAC) return audioTypingSfxState._sfxAC;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  try {
    audioTypingSfxState._sfxAC = new AC();
    audioTypingSfxState._sfxMaster = audioTypingSfxState._sfxAC.createGain();
    audioTypingSfxState._sfxMaster.gain.value = 0.5; /* âm lượng tổng — vừa phải, không chói */
    audioTypingSfxState._sfxMaster.connect(audioTypingSfxState._sfxAC.destination);
  } catch (e) {
    audioTypingSfxState._sfxAC = null;
  }
  return audioTypingSfxState._sfxAC;
}
/* power: 1 = gõ 1 ký tự, >1 = nổ khi gõ xong cả từ */

/* power: 1 = gõ 1 ký tự, >1 = nổ khi gõ xong cả từ */
export function sfxShot(power) {
  const ac = sfxCtx();
  if (!ac || !audioTypingSfxState._sfxMaster) return;
  if (ac.state === 'suspended') {
    try {
      ac.resume();
    } catch (e) {}
  }
  const k = power || 1;
  const t0 = ac.currentTime + 0.001;
  try {
    /* 1) nhiễu trắng rất ngắn — tiếng "bụp" của phát bắn */
    const dur = 0.05 + 0.03 * k;
    const len = Math.max(1, Math.floor(ac.sampleRate * dur));
    const buf = ac.createBuffer(1, len, ac.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
    const noise = ac.createBufferSource();
    noise.buffer = buf;
    const bp = ac.createBiquadFilter();
    bp.type = 'bandpass';
    bp.Q.value = 1.2;
    bp.frequency.setValueAtTime(2200 + Math.random() * 1200, t0);
    bp.frequency.exponentialRampToValueAtTime(520, t0 + dur);
    const gN = ac.createGain();
    gN.gain.setValueAtTime(0.0001, t0);
    gN.gain.exponentialRampToValueAtTime(0.5 * k, t0 + 0.004);
    gN.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    noise.connect(bp);
    bp.connect(gN);
    gN.connect(audioTypingSfxState._sfxMaster);
    noise.start(t0);
    noise.stop(t0 + dur + 0.01);
    /* 2) "pew" — sóng vuông quét tần số xuống */
    const osc = ac.createOscillator();
    osc.type = 'square';
    const f0 = (680 + Math.random() * 220) * Math.min(1.5, k);
    const d2 = 0.085 + 0.03 * k;
    osc.frequency.setValueAtTime(f0, t0);
    osc.frequency.exponentialRampToValueAtTime(110, t0 + d2);
    const gO = ac.createGain();
    gO.gain.setValueAtTime(0.0001, t0);
    gO.gain.exponentialRampToValueAtTime(0.15 * k, t0 + 0.006);
    gO.gain.exponentialRampToValueAtTime(0.0001, t0 + d2);
    osc.connect(gO);
    gO.connect(audioTypingSfxState._sfxMaster);
    osc.start(t0);
    osc.stop(t0 + d2 + 0.01);
  } catch (e) {/* thiết bị không hỗ trợ → bỏ qua, không làm hỏng game */}
}

/* ── Hint / Skip / Reset ── */
/* Cho bàn phím ảo / nơi khác gọi được (ẩn/hiện pinyin — chỉ Enter và nút 💡) */

export function initializeAudioTypingSfx() {
  /* ═══════════════════════════════════════════════════════════
     ★ ÂM THANH HIỆU ỨNG (Web Audio API) — KHÔNG cần file ngoài
     • sfxShot(): tiếng "bắn" rất ngắn (~90ms) mỗi khi gõ ĐÚNG 1 ký tự.
       Trộn 2 lớp: nhiễu trắng qua bandpass (tiếng "bụp") + sóng vuông
       quét tần số từ cao xuống thấp (tiếng "pew").
     • Cao độ hơi ngẫu nhiên mỗi phím → nghe tự nhiên, không đều đều.
     • AudioContext chỉ tạo ở lần bấm phím đầu tiên (đúng cử chỉ người
       dùng) nên không bị chính sách autoplay của trình duyệt chặn.
     ═══════════════════════════════════════════════════════════ */
  audioTypingSfxState._sfxAC = null;
  audioTypingSfxState._sfxMaster = null;
}
