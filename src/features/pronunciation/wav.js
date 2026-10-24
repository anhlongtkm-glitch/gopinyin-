// State and behavior owned by features/pronunciation/wav. Initialization is orchestrated by app/bootstrap.js.

export const state = {};

const pronunciationWavState = state;

export function initializePronunciationWav() {
  /* ═══════════════════════════════════════════════════════════
     PronWav — chuyển bản ghi (webm/opus) sang WAV 16 kHz mono.
     Cần cho dịch vụ chấm phát âm: Azure chỉ nhận WAV PCM / OGG-OPUS,
     KHÔNG nhận webm. Chuyển ngay trong trình duyệt để không phải
     cài ffmpeg ở server.
     ═══════════════════════════════════════════════════════════ */
  pronunciationWavState.PronWav = {
    async encode(blob, rate) {
      const target = rate || 16000;
      const AC = window.AudioContext || window.webkitAudioContext;
      const OAC = window.OfflineAudioContext || window.webkitOfflineAudioContext;
      if (!AC || !OAC) return null;
      let decoded = null;
      const tmp = new AC();
      try {
        decoded = await tmp.decodeAudioData(await blob.arrayBuffer());
      } catch (e) {
        try {
          tmp.close();
        } catch (x) {}
        return null;
      }
      try {
        tmp.close();
      } catch (e) {}
      try {
        const frames = Math.max(1, Math.ceil(decoded.duration * target));
        const off = new OAC(1, frames, target);
        const src = off.createBufferSource();
        src.buffer = decoded;
        src.connect(off.destination);
        src.start(0);
        const rendered = await off.startRendering();
        return this.toWav(rendered);
      } catch (e) {
        return null;
      }
    },
    toWav(buffer) {
      const ch = buffer.getChannelData(0);
      const len = ch.length;
      const out = new ArrayBuffer(44 + len * 2);
      const v = new DataView(out);
      const w = (o, s) => {
        for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i));
      };
      w(0, 'RIFF');
      v.setUint32(4, 36 + len * 2, true);
      w(8, 'WAVE');
      w(12, 'fmt ');
      v.setUint32(16, 16, true);
      v.setUint16(20, 1, true);
      v.setUint16(22, 1, true);
      v.setUint32(24, buffer.sampleRate, true);
      v.setUint32(28, buffer.sampleRate * 2, true);
      v.setUint16(32, 2, true);
      v.setUint16(34, 16, true);
      w(36, 'data');
      v.setUint32(40, len * 2, true);
      let o = 44;
      for (let i = 0; i < len; i++) {
        const s = Math.max(-1, Math.min(1, ch[i]));
        v.setInt16(o, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
        o += 2;
      }
      return out;
    },
    toBase64(buf) {
      const bytes = new Uint8Array(buf);
      let s = '';
      const CH = 0x8000;
      for (let i = 0; i < bytes.length; i += CH) {
        s += String.fromCharCode.apply(null, bytes.subarray(i, i + CH));
      }
      return btoa(s);
    }
  };
}
