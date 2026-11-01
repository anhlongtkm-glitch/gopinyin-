import { sfxCtx, state } from '../../shared/audio/typing-sfx.js';

let voices = 0;
export function unlockPandaAudio() {
  const context = sfxCtx();
  if (context?.state === 'suspended') context.resume().catch(() => {});
}
function tone(context, frequency, endFrequency, duration, volume, delay = 0, type = 'triangle') {
  if (voices >= 16 || !state._sfxMaster) return;
  const osc = context.createOscillator(), gain = context.createGain();
  const at = context.currentTime + delay + .001;
  osc.type = type;
  osc.frequency.setValueAtTime(frequency, at);
  osc.frequency.exponentialRampToValueAtTime(endFrequency, at + duration);
  gain.gain.setValueAtTime(.0001, at);
  gain.gain.exponentialRampToValueAtTime(volume, at + .006);
  gain.gain.exponentialRampToValueAtTime(.0001, at + duration);
  osc.connect(gain); gain.connect(state._sfxMaster);
  voices++;
  osc.onended = () => { voices--; osc.disconnect(); gain.disconnect(); };
  osc.start(at); osc.stop(at + duration + .015);
}
// Short layered envelopes keep rapid typing crisp and leave room for spoken words.
export function pandaSound(kind, combo = 0) {
  try {
    const ac = sfxCtx();
    if (!ac) return;
    unlockPandaAudio();
    if (kind === 'shot') {
      const pitch = 1 + Math.min(combo, 15) * .012;
      tone(ac, 1050 * pitch, 260, .085, .24);
      tone(ac, 175, 75, .055, .14, 0, 'sine');
    } else if (kind === 'complete' || kind === 'reward') {
      tone(ac, 160, 48, .16, .2, 0, 'sine');
      const notes = kind === 'reward' ? [659, 831, 988, 1319] : [523, 784];
      notes.forEach((note, index) => tone(ac, note, note * 1.015, .17, .085, .035 + index * .045, 'sine'));
    } else if (kind === 'impact') {
      tone(ac, 210, 58, .12, .2, 0, 'sine');
      tone(ac, 620, 170, .065, .09, 0, 'triangle');
    } else if (kind === 'boss') {
      [523, 659, 784, 1047].forEach((note, index) => tone(ac, note, note, .24, .12, index * .075, 'sine'));
    } else if (kind === 'miss') tone(ac, 180, 85, .15, .1, 0, 'sine');
  } catch { /* Audio must never block input on unsupported devices. */ }
}
