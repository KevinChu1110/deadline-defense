/**
 * Hybrid audio: sample packs (CC0 Kenney + OGA) with soft procedural fallback.
 * BGM: menu.mp3 (Town Theme, CC0) / battle.mp3 (Battle Theme A, CC0)
 */

const STORAGE_KEY = "deadline-defense-muted";
const MASTER_GAIN = 0.72;
const BGM_MENU_GAIN = 0.28;
const BGM_BATTLE_GAIN = 0.32;
const SFX_GAIN = 0.85;

const SAMPLE_MAP = {
  uiClick: "/audio/ui/click.ogg",
  uiSelect: "/audio/ui/select.ogg",
  uiOk: "/audio/ui/ok.ogg",
  uiConfirm: "/audio/ui/confirm.ogg",
  uiToggle: "/audio/ui/toggle.ogg",
  uiHover: "/audio/ui/hover.ogg",
  uiPluck: "/audio/ui/pluck.ogg",
  error: "/audio/ui/error.ogg",
  deploy: "/audio/sfx/deploy.ogg",
  sell: "/audio/sfx/sell.ogg",
  shoot: "/audio/sfx/shoot.ogg",
  shoot2: "/audio/sfx/shoot2.ogg",
  hit: "/audio/sfx/hit_soft.ogg",
  hitHeavy: "/audio/sfx/hit_heavy.ogg",
  hitChop: "/audio/sfx/hit.ogg",
  kill: "/audio/sfx/kill.ogg",
  leak: "/audio/sfx/leak.ogg",
  coins: "/audio/sfx/coins.ogg",
  drop: "/audio/sfx/drop.ogg",
  open: "/audio/sfx/open.ogg",
  bell: "/audio/sfx/bell.ogg",
  waveStart: "/audio/jingles/wave_start.ogg",
  waveClear: "/audio/jingles/wave_clear.ogg",
  win: "/audio/jingles/win.ogg",
  lose: "/audio/jingles/lose.ogg",
};

const BGM_TRACKS = {
  menu: { src: "/audio/bgm/menu.mp3", volume: BGM_MENU_GAIN },
  battle: { src: "/audio/bgm/battle.mp3", volume: BGM_BATTLE_GAIN },
};

class SfxEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.sfxBus = null;
    this.bgmBus = null;
    this.muted = this._loadMuted();
    this._unlocked = false;
    this._buffers = new Map();
    this._loadPromise = null;
    this._bgmEl = null;
    this._bgmMode = null; // 'menu' | 'battle' | null
    this._bgmFadeTimer = null;
    this._procBgm = null;
    this.bgmOn = false;
    this._lastPlay = new Map();
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
    this.master.gain.value = this.muted ? 0 : MASTER_GAIN;
    this.master.connect(this.ctx.destination);

    this.sfxBus = this.ctx.createGain();
    this.sfxBus.gain.value = SFX_GAIN;
    this.sfxBus.connect(this.master);

    this.bgmBus = this.ctx.createGain();
    this.bgmBus.gain.value = 1;
    this.bgmBus.connect(this.master);
  }

  async unlock() {
    this.ensure();
    if (!this.ctx) {
      this._unlocked = true;
      return;
    }
    if (this.ctx.state === "suspended") {
      try {
        await Promise.race([
          this.ctx.resume(),
          new Promise((r) => setTimeout(r, 400)),
        ]);
      } catch {
        /* ignore */
      }
    }
    this._unlocked = true;
    void this.preload();
    // Resume HTMLAudio BGM if needed
    if (this._bgmEl && !this.muted && this._bgmEl.paused && this.bgmOn) {
      this._bgmEl.play().catch(() => {});
    }
  }

  preload() {
    if (this._loadPromise) return this._loadPromise;
    this.ensure();
    if (!this.ctx) {
      this._loadPromise = Promise.resolve();
      return this._loadPromise;
    }
    this._loadPromise = Promise.all(
      Object.entries(SAMPLE_MAP).map(async ([key, url]) => {
        try {
          const res = await fetch(url);
          if (!res.ok) return;
          const arr = await res.arrayBuffer();
          const buf = await this.ctx.decodeAudioData(arr.slice(0));
          this._buffers.set(key, buf);
        } catch {
          /* sample optional; procedural fallback */
        }
      })
    );
    return this._loadPromise;
  }

  setMuted(muted) {
    this.muted = !!muted;
    this._saveMuted();
    this.ensure();
    if (this.master && this.ctx) {
      const t = this.ctx.currentTime;
      this.master.gain.cancelScheduledValues(t);
      this.master.gain.setTargetAtTime(this.muted ? 0 : MASTER_GAIN, t, 0.04);
    }
    if (this.muted) {
      this._pauseBgmEl();
      this._stopProcBgm(true);
    } else if (this._bgmMode) {
      this.startBgm(this._bgmMode);
    }
  }

  toggleMute() {
    this.setMuted(!this.muted);
    return this.muted;
  }

  /**
   * @param {'menu'|'battle'} mode
   */
  startBgm(mode = "battle") {
    this.ensure();
    if (!this.ctx || this.muted) {
      this._bgmMode = mode;
      return;
    }
    if (this.bgmOn && this._bgmMode === mode) {
      // ensure playing
      if (this._bgmEl?.paused) this._bgmEl.play().catch(() => {});
      return;
    }
    this._bgmMode = mode;
    this.bgmOn = true;
    void this._playSampleBgm(mode);
  }

  /** @deprecated use startBgm('battle') */
  startBgmBattle() {
    this.startBgm("battle");
  }

  stopBgm() {
    this.bgmOn = false;
    this._bgmMode = null;
    this._fadeOutBgmEl();
    this._stopProcBgm(false);
  }

  async _playSampleBgm(mode) {
    const track = BGM_TRACKS[mode] || BGM_TRACKS.battle;
    try {
      if (!this._bgmEl) {
        this._bgmEl = new Audio();
        this._bgmEl.loop = true;
        this._bgmEl.preload = "auto";
      }
      const el = this._bgmEl;
      const fileKey = track.src.split("/").pop();
      const needSrc = !el.src || !el.src.includes(fileKey);
      if (needSrc) {
        el.src = track.src;
        el.load();
      }
      el.volume = 0;
      try {
        await el.play();
      } catch {
        // autoplay blocked — fall back to soft procedural bed
        this._startProcBgm(mode);
        return;
      }
      this._stopProcBgm(true);
      this._fadeBgmElTo(track.volume, 900);
    } catch {
      this._startProcBgm(mode);
    }
  }

  _fadeBgmElTo(target, ms = 600) {
    const el = this._bgmEl;
    if (!el) return;
    if (this._bgmFadeTimer) clearInterval(this._bgmFadeTimer);
    const start = el.volume;
    const steps = Math.max(8, Math.floor(ms / 30));
    let i = 0;
    this._bgmFadeTimer = setInterval(() => {
      i++;
      const t = i / steps;
      el.volume = Math.max(0, Math.min(1, start + (target - start) * t));
      if (i >= steps) {
        clearInterval(this._bgmFadeTimer);
        this._bgmFadeTimer = null;
      }
    }, 30);
  }

  _fadeOutBgmEl() {
    const el = this._bgmEl;
    if (!el) return;
    this._fadeBgmElTo(0, 500);
    setTimeout(() => {
      try {
        el.pause();
      } catch {
        /* ignore */
      }
    }, 520);
  }

  _pauseBgmEl() {
    if (this._bgmEl) {
      try {
        this._bgmEl.pause();
      } catch {
        /* ignore */
      }
    }
  }

  /** Soft procedural pad if mp3 fails */
  _startProcBgm(mode) {
    this.ensure();
    if (!this.ctx || this.muted) return;
    this._stopProcBgm(true);
    const t0 = this.ctx.currentTime;
    const bed = this.ctx.createGain();
    bed.gain.value = 0;
    const filter = this.ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = mode === "battle" ? 1400 : 1100;
    filter.Q.value = 0.5;
    bed.connect(filter);
    filter.connect(this.bgmBus || this.master);
    bed.gain.linearRampToValueAtTime(mode === "battle" ? 0.08 : 0.055, t0 + 0.8);

    // Gentle triad pad (A minor-ish / C major-ish) — triangle only, no harsh square
    const root = mode === "battle" ? 146.83 : 130.81; // D3 / C3
    const thirds = mode === "battle" ? [1, 1.2, 1.5] : [1, 1.25, 1.5];
    const oscs = thirds.map((m, i) => {
      const o = this.ctx.createOscillator();
      o.type = i === 0 ? "triangle" : "sine";
      o.frequency.value = root * m;
      const g = this.ctx.createGain();
      g.gain.value = 0.35 / thirds.length;
      o.connect(g);
      g.connect(bed);
      o.start(t0);
      return o;
    });

    // Soft pulse on filter for life
    const lfo = this.ctx.createOscillator();
    const lfoG = this.ctx.createGain();
    lfo.type = "sine";
    lfo.frequency.value = mode === "battle" ? 0.22 : 0.12;
    lfoG.gain.value = mode === "battle" ? 220 : 140;
    lfo.connect(lfoG);
    lfoG.connect(filter.frequency);
    lfo.start(t0);

    // Light melody plucks (pentatonic) every ~1.6s
    const melody = this.ctx.createGain();
    melody.gain.value = 0.035;
    melody.connect(filter);
    const scale = mode === "battle"
      ? [0, 2, 3, 5, 7, 8, 10, 12]
      : [0, 2, 4, 5, 7, 9, 11, 12];
    const base = mode === "battle" ? 293.66 : 261.63;
    let step = 0;
    const tick = () => {
      if (!this._procBgm || this.muted) return;
      const t = this.ctx.currentTime;
      const deg = scale[step % scale.length];
      step += mode === "battle" ? 2 : 1;
      const freq = base * Math.pow(2, deg / 12);
      const o = this.ctx.createOscillator();
      o.type = "sine";
      o.frequency.setValueAtTime(freq, t);
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.5, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.55);
      o.connect(g);
      g.connect(melody);
      o.start(t);
      o.stop(t + 0.6);
    };
    tick();
    const interval = setInterval(tick, mode === "battle" ? 900 : 1600);

    this._procBgm = { oscs, lfo, bed, filter, interval, melody };
  }

  _stopProcBgm(immediate = false) {
    if (!this._procBgm || !this.ctx) {
      this._procBgm = null;
      return;
    }
    const { oscs, lfo, bed, interval } = this._procBgm;
    clearInterval(interval);
    const t = this.ctx.currentTime;
    try {
      bed.gain.cancelScheduledValues(t);
      bed.gain.linearRampToValueAtTime(0, t + (immediate ? 0.05 : 0.4));
      const stopAt = t + (immediate ? 0.08 : 0.45);
      oscs.forEach((o) => o.stop(stopAt));
      lfo.stop(stopAt);
    } catch {
      /* ignore */
    }
    this._procBgm = null;
  }

  _throttle(name, ms) {
    const now = performance.now();
    const last = this._lastPlay.get(name) || 0;
    if (now - last < ms) return false;
    this._lastPlay.set(name, now);
    return true;
  }

  /**
   * Play a named cue. Sample-first, soft procedural fallback.
   * @param {string} name
   * @param {{ pitch?: number, heavy?: boolean }} [opts]
   */
  play(name, opts = {}) {
    if (this.muted) return;
    this.ensure();
    if (!this.ctx) return;
    if (this.ctx.state !== "running") this.ctx.resume?.();

    // Rate-limit spammy combat SFX
    if (name === "shoot" && !this._throttle("shoot", 45)) return;
    if (name === "hit" && !this._throttle("hit", 35)) return;

    const sampleKey = this._resolveSampleKey(name, opts);
    const buf = sampleKey ? this._buffers.get(sampleKey) : null;
    if (buf) {
      this._playBuffer(buf, name, opts);
      return;
    }
    // not loaded yet — kick preload and use procedural
    void this.preload();
    const fn = FALLBACK[name];
    if (fn) fn(this.ctx, this.sfxBus || this.master, opts);
  }

  _resolveSampleKey(name, opts) {
    if (name === "hit") return opts.heavy ? "hitHeavy" : "hit";
    if (name === "shoot") return Math.random() > 0.5 ? "shoot" : "shoot2";
    if (name === "uiClick") return "uiClick";
    if (SAMPLE_MAP[name]) return name;
    return null;
  }

  _playBuffer(buf, name, opts = {}) {
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const pitch = opts.pitch != null ? opts.pitch : 1;
    // slight random detune for combat variety
    const detune =
      name === "shoot" || name === "hit" || name === "kill"
        ? 0.94 + Math.random() * 0.12
        : 1;
    src.playbackRate.value = pitch * detune;

    const g = this.ctx.createGain();
    let peak = 0.9;
    if (name === "shoot") peak = 0.55;
    if (name === "hit") peak = opts.heavy ? 0.75 : 0.5;
    if (name === "kill") peak = 0.65;
    if (name === "uiClick") peak = 0.55;
    if (name === "waveStart" || name === "waveClear") peak = 0.7;
    if (name === "win" || name === "lose") peak = 0.85;
    if (name === "leak") peak = 0.7;
    g.gain.value = peak;

    // Soft high-cut on combat to reduce harshness
    const filter = this.ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value =
      name === "shoot" || name === "hit" ? 4200 : 9000;
    filter.Q.value = 0.5;

    src.connect(filter);
    filter.connect(g);
    g.connect(this.sfxBus || this.master);
    src.start(0);
  }
}

/* ── Soft procedural fallbacks (triangle/sine heavy, less square/saw) ── */

function envGain(ctx, dest, t0, { attack = 0.01, decay = 0.12, peak = 0.3, sustain = 0.0001 } = {}) {
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(Math.max(0.0001, peak), t0 + attack);
  g.gain.exponentialRampToValueAtTime(Math.max(0.0001, sustain), t0 + attack + decay);
  g.connect(dest);
  return g;
}

function tone(ctx, dest, t0, {
  type = "sine",
  freq = 440,
  freqEnd = null,
  duration = 0.12,
  peak = 0.2,
  attack = 0.008,
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

function noiseBurst(ctx, dest, t0, { duration = 0.08, peak = 0.12, filterFreq = 1800 } = {}) {
  const len = Math.max(1, Math.floor(ctx.sampleRate * duration));
  const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  const filter = ctx.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.value = filterFreq;
  filter.Q.value = 0.8;
  const g = envGain(ctx, dest, t0, { attack: 0.002, decay: duration, peak });
  src.connect(filter);
  filter.connect(g);
  src.start(t0);
  src.stop(t0 + duration + 0.02);
}

const FALLBACK = {
  uiClick(ctx, master) {
    const t = ctx.currentTime;
    tone(ctx, master, t, { type: "sine", freq: 720, freqEnd: 920, duration: 0.05, peak: 0.07 });
  },
  deploy(ctx, master) {
    const t = ctx.currentTime;
    tone(ctx, master, t, { type: "triangle", freq: 260, freqEnd: 480, duration: 0.1, peak: 0.1 });
    tone(ctx, master, t + 0.05, { type: "sine", freq: 540, freqEnd: 720, duration: 0.1, peak: 0.07 });
  },
  sell(ctx, master) {
    const t = ctx.currentTime;
    tone(ctx, master, t, { type: "sine", freq: 480, freqEnd: 200, duration: 0.14, peak: 0.08 });
  },
  shoot(ctx, master, { pitch = 1 } = {}) {
    const t = ctx.currentTime;
    tone(ctx, master, t, {
      type: "triangle",
      freq: 380 * pitch,
      freqEnd: 160 * pitch,
      duration: 0.06,
      peak: 0.06,
    });
    noiseBurst(ctx, master, t, { duration: 0.03, peak: 0.03, filterFreq: 2200 * pitch });
  },
  hit(ctx, master, { heavy = false } = {}) {
    const t = ctx.currentTime;
    tone(ctx, master, t, {
      type: "triangle",
      freq: heavy ? 140 : 240,
      freqEnd: heavy ? 55 : 100,
      duration: heavy ? 0.11 : 0.05,
      peak: heavy ? 0.12 : 0.07,
    });
    noiseBurst(ctx, master, t, {
      duration: heavy ? 0.07 : 0.035,
      peak: heavy ? 0.08 : 0.04,
      filterFreq: heavy ? 800 : 1400,
    });
  },
  kill(ctx, master) {
    const t = ctx.currentTime;
    tone(ctx, master, t, { type: "sine", freq: 520, freqEnd: 880, duration: 0.09, peak: 0.08 });
    tone(ctx, master, t + 0.05, { type: "triangle", freq: 700, freqEnd: 1000, duration: 0.1, peak: 0.06 });
  },
  leak(ctx, master) {
    const t = ctx.currentTime;
    tone(ctx, master, t, { type: "triangle", freq: 220, freqEnd: 90, duration: 0.22, peak: 0.12 });
    noiseBurst(ctx, master, t, { duration: 0.14, peak: 0.07, filterFreq: 500 });
  },
  waveStart(ctx, master) {
    const t = ctx.currentTime;
    [392, 494, 587].forEach((f, i) => {
      tone(ctx, master, t + i * 0.08, { type: "sine", freq: f, duration: 0.16, peak: 0.09 });
    });
  },
  waveClear(ctx, master) {
    const t = ctx.currentTime;
    [392, 494, 587, 784].forEach((f, i) => {
      tone(ctx, master, t + i * 0.07, { type: "sine", freq: f, duration: 0.14, peak: 0.08 });
    });
  },
  win(ctx, master) {
    const t = ctx.currentTime;
    [523, 659, 784, 1046].forEach((f, i) => {
      tone(ctx, master, t + i * 0.1, { type: "sine", freq: f, duration: 0.24, peak: 0.1 });
    });
  },
  lose(ctx, master) {
    const t = ctx.currentTime;
    tone(ctx, master, t, { type: "triangle", freq: 280, freqEnd: 90, duration: 0.4, peak: 0.14 });
    tone(ctx, master, t + 0.1, { type: "sine", freq: 180, freqEnd: 60, duration: 0.45, peak: 0.1 });
  },
  error(ctx, master) {
    const t = ctx.currentTime;
    tone(ctx, master, t, { type: "triangle", freq: 200, duration: 0.08, peak: 0.07 });
    tone(ctx, master, t + 0.09, { type: "triangle", freq: 150, duration: 0.1, peak: 0.07 });
  },
};

export const sfx = new SfxEngine();
