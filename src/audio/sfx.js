/**
 * Procedural SFX via Web Audio API — no external audio files.
 * Unlock on first user gesture (browser autoplay policy).
 */

const STORAGE_KEY = "deadline-defense-muted";

class SfxEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.muted = this._loadMuted();
    this._unlocked = false;
    this._bgmNodes = null;
    this.bgmOn = false;
  }

  _loadMuted() {
    try {
      return localStorage.getItem(STORAGE_KEY) === "1";
    } catch {
      return false;
    }
  }

  _saveMuted() {
    try {
      localStorage.setItem(STORAGE_KEY, this.muted ? "1" : "0");
    } catch {
      /* ignore */
    }
  }

  ensure() {
    if (this.ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 0.55;
    this.master.connect(this.ctx.destination);
  }

  async unlock() {
    this.ensure();
    if (!this.ctx) return;
    if (this.ctx.state === "suspended") {
      try {
        await this.ctx.resume();
      } catch {
        /* ignore */
      }
    }
    this._unlocked = true;
  }

  setMuted(muted) {
    this.muted = !!muted;
    this._saveMuted();
    this.ensure();
    if (this.master) {
      const t = this.ctx.currentTime;
      this.master.gain.cancelScheduledValues(t);
      this.master.gain.setTargetAtTime(this.muted ? 0 : 0.55, t, 0.03);
    }
    if (this.muted) this.stopBgm();
  }

  toggleMute() {
    this.setMuted(!this.muted);
    return this.muted;
  }

  /** Soft office hum / arpeggio bed while a wave is active */
  startBgm() {
    this.ensure();
    if (!this.ctx || this.muted || this.bgmOn) return;
    this.bgmOn = true;
    const t0 = this.ctx.currentTime;

    const filter = this.ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 900;
    filter.Q.value = 0.6;

    const bed = this.ctx.createGain();
    bed.gain.value = 0.0;
    bed.connect(filter);
    filter.connect(this.master);
    bed.gain.linearRampToValueAtTime(0.04, t0 + 0.6);

    // dual soft oscillators
    const o1 = this.ctx.createOscillator();
    const o2 = this.ctx.createOscillator();
    o1.type = "triangle";
    o2.type = "sine";
    o1.frequency.value = 110;
    o2.frequency.value = 164.81;
    o1.connect(bed);
    o2.connect(bed);
    o1.start(t0);
    o2.start(t0);

    // light pulse LFO on filter
    const lfo = this.ctx.createOscillator();
    const lfoGain = this.ctx.createGain();
    lfo.frequency.value = 0.18;
    lfoGain.gain.value = 180;
    lfo.connect(lfoGain);
    lfoGain.connect(filter.frequency);
    lfo.start(t0);

    this._bgmNodes = { o1, o2, lfo, bed, filter };
  }

  stopBgm() {
    if (!this._bgmNodes || !this.ctx) {
      this.bgmOn = false;
      return;
    }
    const { o1, o2, lfo, bed } = this._bgmNodes;
    const t = this.ctx.currentTime;
    try {
      bed.gain.cancelScheduledValues(t);
      bed.gain.linearRampToValueAtTime(0, t + 0.35);
      o1.stop(t + 0.4);
      o2.stop(t + 0.4);
      lfo.stop(t + 0.4);
    } catch {
      /* ignore */
    }
    this._bgmNodes = null;
    this.bgmOn = false;
  }

  play(name, opts = {}) {
    if (this.muted) return;
    this.ensure();
    if (!this.ctx || this.ctx.state !== "running") {
      // try resume; still schedule if possible
      this.ctx?.resume?.();
    }
    if (!this.ctx) return;

    const fn = SOUNDS[name];
    if (fn) fn(this.ctx, this.master, opts);
  }
}

function envGain(ctx, dest, t0, { attack = 0.01, decay = 0.12, peak = 0.3, sustain = 0.0001 } = {}) {
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(Math.max(0.0001, peak), t0 + attack);
  g.gain.exponentialRampToValueAtTime(Math.max(0.0001, sustain), t0 + attack + decay);
  g.connect(dest);
  return g;
}

function tone(ctx, dest, t0, {
  type = "square",
  freq = 440,
  freqEnd = null,
  duration = 0.12,
  peak = 0.2,
  attack = 0.005,
  decay = null,
} = {}) {
  const osc = ctx.createOscillator();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (freqEnd != null) {
    osc.frequency.exponentialRampToValueAtTime(Math.max(1, freqEnd), t0 + duration);
  }
  const g = envGain(ctx, dest, t0, {
    attack,
    decay: decay ?? duration,
    peak,
  });
  osc.connect(g);
  osc.start(t0);
  osc.stop(t0 + duration + 0.05);
}

function noiseBurst(ctx, dest, t0, { duration = 0.08, peak = 0.15, filterFreq = 1800 } = {}) {
  const len = Math.max(1, Math.floor(ctx.sampleRate * duration));
  const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  const filter = ctx.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.value = filterFreq;
  filter.Q.value = 0.7;
  const g = envGain(ctx, dest, t0, { attack: 0.002, decay: duration, peak });
  src.connect(filter);
  filter.connect(g);
  src.start(t0);
  src.stop(t0 + duration + 0.02);
}

const SOUNDS = {
  uiClick(ctx, master) {
    const t = ctx.currentTime;
    tone(ctx, master, t, { type: "triangle", freq: 660, freqEnd: 880, duration: 0.06, peak: 0.08 });
  },

  deploy(ctx, master) {
    const t = ctx.currentTime;
    tone(ctx, master, t, { type: "square", freq: 220, freqEnd: 440, duration: 0.1, peak: 0.12 });
    tone(ctx, master, t + 0.06, { type: "triangle", freq: 520, freqEnd: 780, duration: 0.12, peak: 0.1 });
    noiseBurst(ctx, master, t, { duration: 0.05, peak: 0.06, filterFreq: 2400 });
  },

  sell(ctx, master) {
    const t = ctx.currentTime;
    tone(ctx, master, t, { type: "triangle", freq: 480, freqEnd: 180, duration: 0.14, peak: 0.1 });
  },

  shoot(ctx, master, { pitch = 1 } = {}) {
    const t = ctx.currentTime;
    tone(ctx, master, t, {
      type: "square",
      freq: 420 * pitch,
      freqEnd: 180 * pitch,
      duration: 0.07,
      peak: 0.07,
    });
    noiseBurst(ctx, master, t, { duration: 0.035, peak: 0.04, filterFreq: 3000 * pitch });
  },

  hit(ctx, master, { heavy = false } = {}) {
    const t = ctx.currentTime;
    tone(ctx, master, t, {
      type: "triangle",
      freq: heavy ? 160 : 280,
      freqEnd: heavy ? 60 : 120,
      duration: heavy ? 0.12 : 0.06,
      peak: heavy ? 0.14 : 0.08,
    });
    noiseBurst(ctx, master, t, {
      duration: heavy ? 0.08 : 0.04,
      peak: heavy ? 0.1 : 0.05,
      filterFreq: heavy ? 900 : 1600,
    });
  },

  kill(ctx, master) {
    const t = ctx.currentTime;
    tone(ctx, master, t, { type: "square", freq: 500, freqEnd: 900, duration: 0.08, peak: 0.09 });
    tone(ctx, master, t + 0.05, { type: "triangle", freq: 700, freqEnd: 1100, duration: 0.1, peak: 0.07 });
  },

  leak(ctx, master) {
    const t = ctx.currentTime;
    tone(ctx, master, t, { type: "sawtooth", freq: 240, freqEnd: 80, duration: 0.22, peak: 0.16 });
    noiseBurst(ctx, master, t, { duration: 0.15, peak: 0.1, filterFreq: 600 });
  },

  waveStart(ctx, master) {
    const t = ctx.currentTime;
    [330, 415, 523].forEach((f, i) => {
      tone(ctx, master, t + i * 0.07, {
        type: "triangle",
        freq: f,
        duration: 0.14,
        peak: 0.1,
      });
    });
  },

  waveClear(ctx, master) {
    const t = ctx.currentTime;
    [392, 494, 587, 784].forEach((f, i) => {
      tone(ctx, master, t + i * 0.06, {
        type: "triangle",
        freq: f,
        duration: 0.12,
        peak: 0.09,
      });
    });
  },

  win(ctx, master) {
    const t = ctx.currentTime;
    const notes = [523, 659, 784, 1046];
    notes.forEach((f, i) => {
      tone(ctx, master, t + i * 0.1, {
        type: "triangle",
        freq: f,
        duration: 0.22,
        peak: 0.12,
      });
    });
  },

  lose(ctx, master) {
    const t = ctx.currentTime;
    tone(ctx, master, t, { type: "sawtooth", freq: 300, freqEnd: 80, duration: 0.45, peak: 0.18 });
    tone(ctx, master, t + 0.12, { type: "triangle", freq: 180, freqEnd: 50, duration: 0.5, peak: 0.12 });
    noiseBurst(ctx, master, t, { duration: 0.3, peak: 0.12, filterFreq: 400 });
  },

  error(ctx, master) {
    const t = ctx.currentTime;
    tone(ctx, master, t, { type: "square", freq: 180, duration: 0.08, peak: 0.08 });
    tone(ctx, master, t + 0.09, { type: "square", freq: 140, duration: 0.1, peak: 0.08 });
  },
};

export const sfx = new SfxEngine();
