// State and behavior owned by shared/audio/effects. Initialization is orchestrated by app/bootstrap.js.

export const state = {};

const audioEffectsState = state;

export function initializeAudioEffects() {
  /* ═══════════════ SFX ENGINE — âm thanh tổng hợp, ấn tượng ═══════════════ */
  audioEffectsState.Sfx = function () {
    let ctx = null,
      enabled = true;
    function ac() {
      if (!ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return null;
        ctx = new AC();
      }
      if (ctx.state === 'suspended') ctx.resume();
      return ctx;
    }
    function tone(o) {
      if (!enabled) return;
      const c = ac();
      if (!c) return;
      const t0 = c.currentTime + (o.delay || 0);
      const osc = c.createOscillator(),
        g = c.createGain();
      osc.type = o.type || 'sine';
      osc.frequency.setValueAtTime(o.f, t0);
      if (o.f2) osc.frequency.exponentialRampToValueAtTime(Math.max(1, o.f2), t0 + (o.dur || .15));
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(o.v || .16, t0 + .012);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + (o.dur || .15));
      osc.connect(g);
      g.connect(c.destination);
      osc.start(t0);
      osc.stop(t0 + (o.dur || .15) + .05);
    }
    function noise(dur, vol, delay) {
      if (!enabled) return;
      const c = ac();
      if (!c) return;
      const t0 = c.currentTime + (delay || 0);
      const buf = c.createBuffer(1, c.sampleRate * dur, c.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
      const src = c.createBufferSource();
      src.buffer = buf;
      const f = c.createBiquadFilter();
      f.type = 'bandpass';
      f.frequency.value = 1800;
      const g = c.createGain();
      g.gain.value = vol || .12;
      src.connect(f);
      f.connect(g);
      g.connect(c.destination);
      src.start(t0);
    }
    return {
      setEnabled(v) {
        enabled = v;
      },
      isEnabled() {
        return enabled;
      },
      click() {
        tone({
          f: 660,
          f2: 520,
          dur: .07,
          type: 'triangle',
          v: .1
        });
      },
      hover() {
        tone({
          f: 880,
          dur: .04,
          type: 'sine',
          v: .035
        });
      },
      tap() {
        tone({
          f: 520,
          f2: 760,
          dur: .09,
          type: 'triangle',
          v: .12
        });
      },
      pop() {
        tone({
          f: 300,
          f2: 900,
          dur: .14,
          type: 'sine',
          v: .16
        });
      },
      correct(combo) {
        const base = 523.25 * Math.pow(1.0595, Math.min(combo || 0, 12));
        tone({
          f: base,
          dur: .12,
          type: 'sine',
          v: .15
        });
        tone({
          f: base * 1.26,
          dur: .12,
          type: 'sine',
          v: .13,
          delay: .07
        });
        tone({
          f: base * 1.5,
          dur: .22,
          type: 'sine',
          v: .13,
          delay: .14
        });
      },
      wrong() {
        tone({
          f: 196,
          f2: 110,
          dur: .28,
          type: 'sawtooth',
          v: .1
        });
        tone({
          f: 147,
          dur: .2,
          type: 'sine',
          v: .08,
          delay: .05
        });
      },
      combo(n) {
        for (let i = 0; i < 3; i++) tone({
          f: 440 * Math.pow(1.122, i + n % 5),
          dur: .09,
          type: 'triangle',
          v: .1,
          delay: i * .05
        });
      },
      whoosh() {
        noise(.22, .07);
        tone({
          f: 220,
          f2: 660,
          dur: .25,
          type: 'sine',
          v: .07
        });
      },
      unlock() {
        [523, 659, 784, 1047].forEach((f, i) => tone({
          f,
          dur: .35,
          type: 'sine',
          v: .14,
          delay: i * .09
        }));
        noise(.4, .05, .1);
      },
      win() {
        [523, 659, 784, 1047, 1319].forEach((f, i) => tone({
          f,
          dur: .4,
          type: 'triangle',
          v: .13,
          delay: i * .11
        }));
        tone({
          f: 1568,
          dur: .6,
          type: 'sine',
          v: .1,
          delay: .5
        });
      },
      page() {
        tone({
          f: 392,
          f2: 588,
          dur: .18,
          type: 'triangle',
          v: .09
        });
      }
    };
  }();
  /* Bật âm thanh sau tương tác đầu tiên (chính sách trình duyệt) */['pointerdown', 'keydown'].forEach(ev => window.addEventListener(ev, function once() {
    audioEffectsState.Sfx.unlock();
    window.removeEventListener(ev, once);
  }, {
    once: true
  }));

  /* ═══════════════ CONFETTI ═══════════════ */
}
