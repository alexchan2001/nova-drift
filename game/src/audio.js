// Sound effects, synthesized with WebAudio: no audio files, nothing loads over
// the network. The context is created on the first user gesture and stays muted
// until then, so the title screen is silent in a fresh tab.

export function createAudio() {
  let ctx = null;
  let master = null;
  let muted = false;

  function ensure() {
    if (ctx) {
      if (ctx.state === 'suspended') ctx.resume();
      return true;
    }
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return false;
    ctx = new AudioContext();
    master = ctx.createGain();
    master.gain.value = 0.35;
    master.connect(ctx.destination);
    return true;
  }

  /** A short oscillator blip that slides from one frequency to another. */
  function blip({ type = 'square', from = 440, to = 220, dur = 0.08, vol = 0.5, when = 0 }) {
    if (!ensure() || muted) return;
    const t0 = ctx.currentTime + when;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(from, t0);
    osc.frequency.exponentialRampToValueAtTime(Math.max(1, to), t0 + dur);
    gain.gain.setValueAtTime(vol, t0);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    osc.connect(gain);
    gain.connect(master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  /** A burst of filtered noise, for explosions. */
  function noise({ dur = 0.3, vol = 0.6, freq = 800, when = 0 }) {
    if (!ensure() || muted) return;
    const t0 = ctx.currentTime + when;
    const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
    const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(freq, t0);
    filter.frequency.exponentialRampToValueAtTime(Math.max(40, freq * 0.2), t0 + dur);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(vol, t0);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    src.start(t0);
  }

  return {
    /** Call from any user gesture so the context is allowed to start. */
    unlock() {
      ensure();
    },
    toggleMute() {
      muted = !muted;
      return muted;
    },
    isMuted() {
      return muted;
    },
    laser() {
      blip({ type: 'square', from: 880, to: 320, dur: 0.07, vol: 0.22 });
    },
    enemyShot() {
      blip({ type: 'sawtooth', from: 300, to: 160, dur: 0.12, vol: 0.12 });
    },
    explosion(big = false) {
      noise({ dur: big ? 0.55 : 0.28, vol: big ? 0.7 : 0.4, freq: big ? 500 : 900 });
      blip({ type: 'sine', from: 160, to: 40, dur: big ? 0.4 : 0.22, vol: 0.4 });
    },
    hit() {
      noise({ dur: 0.2, vol: 0.5, freq: 1200 });
      blip({ type: 'sawtooth', from: 220, to: 60, dur: 0.25, vol: 0.4 });
    },
    pickup() {
      blip({ type: 'sine', from: 660, to: 990, dur: 0.09, vol: 0.35 });
      blip({ type: 'sine', from: 990, to: 1320, dur: 0.1, vol: 0.3, when: 0.07 });
    },
    powerup() {
      blip({ type: 'triangle', from: 440, to: 660, dur: 0.1, vol: 0.4 });
      blip({ type: 'triangle', from: 660, to: 880, dur: 0.1, vol: 0.4, when: 0.09 });
      blip({ type: 'triangle', from: 880, to: 1320, dur: 0.14, vol: 0.35, when: 0.18 });
    },
    waveClear() {
      blip({ type: 'triangle', from: 523, to: 523, dur: 0.1, vol: 0.35 });
      blip({ type: 'triangle', from: 659, to: 659, dur: 0.1, vol: 0.35, when: 0.1 });
      blip({ type: 'triangle', from: 784, to: 784, dur: 0.16, vol: 0.35, when: 0.2 });
    },
    bomb() {
      noise({ dur: 0.7, vol: 0.7, freq: 400 });
      blip({ type: 'sine', from: 120, to: 30, dur: 0.6, vol: 0.5 });
    },
    gameOver() {
      blip({ type: 'triangle', from: 392, to: 392, dur: 0.22, vol: 0.4 });
      blip({ type: 'triangle', from: 311, to: 311, dur: 0.22, vol: 0.4, when: 0.22 });
      blip({ type: 'triangle', from: 233, to: 233, dur: 0.4, vol: 0.4, when: 0.44 });
    },
  };
}
