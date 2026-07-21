/**
 * Hybrid audio: sample packs (CC0 Kenney + OGA) with soft procedural fallback.
 * BGM via Web Audio loop (reliable after first gesture) + HTMLAudio backup.
 *
 * Critical autoplay rule: never await before calling Audio.play() / startBgm
 * in the same user-gesture stack — await breaks Safari/Chrome gesture chain.
 */

const STORAGE_KEY = "deadline-defense-muted";
const MASTER_GAIN = 0.85;
const BGM_MENU_GAIN = 0.48;
const BGM_BATTLE_GAIN = 0.55;
const SFX_GAIN = 0.9;

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
    this._bgmBuffers = new Map(); // mode -> AudioBuffer
    this._loadPromise = null;
    this._bgmLoadPromises = new Map();
    this._bgmSource = null; // looping BufferSource
    this._bgmEl = null; // HTMLAudio fallback
    this._bgmMode = null;
    this._bgmFadeTimer = null;
    this._procBgm = null;
    this.bgmOn = false;
    this._lastPlay = new Map();
    this._pendingBgmMode = null;
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

  /**
   * Call from user gesture. Must stay mostly synchronous so autoplay works.
   * @returns {Promise<void>}
   */
  unlock() {
    this.ensure();
    // Kick resume WITHOUT awaiting — preserves user-gesture chain for Audio.play
    if (this.ctx && this.ctx.state === "suspended") {
      try {
        void this.ctx.resume();
      } catch {
        /* ignore */
      }
    }
    this._unlocked = true;
    void this.preload();
    void this._ensureBgmBuffer("menu");
    void this._ensureBgmBuffer("battle");

    // If something already requested BGM before unlock, start it now
    if (this._pendingBgmMode && !this.muted) {
      const m = this._pendingBgmMode;
      this._pendingBgmMode = null;
      this.startBgm(m);
    } else if (this.bgmOn && this._bgmMode && !this.muted) {
      this._kickBgmPlayback(this._bgmMode);
    }

    // Still return a promise for callers that want to know when ctx is running
    if (!this.ctx) return Promise.resolve();
    if (this.ctx.state === "running") return Promise.resolve();
    return Promise.race([
      this.ctx.resume().catch(() => {}),
      new Promise((r) => setTimeout(r, 400)),
    ]).then(() => undefined);
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
          /* sample optional */
        }
      })
    );
    return this._loadPromise;
  }

  _ensureBgmBuffer(mode) {
    if (this._bgmBuffers.has(mode)) return Promise.resolve(this._bgmBuffers.get(mode));
    if (this._bgmLoadPromises.has(mode)) return this._bgmLoadPromises.get(mode);
    this.ensure();
    if (!this.ctx) return Promise.resolve(null);

    const track = BGM_TRACKS[mode];
    if (!track) return Promise.resolve(null);

    const p = (async () => {
      try {
        const res = await fetch(track.src);
        if (!res.ok) throw new Error(`bgm ${mode} ${res.status}`);
        const arr = await res.arrayBuffer();
        const buf = await this.ctx.decodeAudioData(arr.slice(0));
        this._bgmBuffers.set(mode, buf);
        // If user already asked for this mode, start now
        if (this.bgmOn && this._bgmMode === mode && !this.muted && !this._bgmSource) {
          this._startWebAudioBgm(mode);
        }
        return buf;
      } catch (err) {
        console.warn("[sfx] BGM decode failed", mode, err);
        return null;
      } finally {
        this._bgmLoadPromises.delete(mode);
      }
    })();
    this._bgmLoadPromises.set(mode, p);
    return p;
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
    if (this._bgmEl) {
      this._bgmEl.muted = this.muted;
      if (this.muted) {
        try {
          this._bgmEl.pause();
        } catch {
          /* ignore */
        }
      }
    }
    if (this.muted) {
      this._stopWebAudioBgm(true);
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
    this._bgmMode = mode;
    this.bgmOn = true;

    if (this.muted) {
      this._pendingBgmMode = mode;
      return;
    }
    if (!this.ctx) {
      this._pendingBgmMode = mode;
      return;
    }

    // Kick resume sync (gesture-safe)
    if (this.ctx.state === "suspended") {
      try {
        void this.ctx.resume();
      } catch {
        /* ignore */
      }
    }

    this._kickBgmPlayback(mode);
  }

  _kickBgmPlayback(mode) {
    // 1) Web Audio buffer loop if already decoded
    if (this._bgmBuffers.has(mode)) {
      this._startWebAudioBgm(mode);
      return;
    }
    // 2) HTMLAudio play immediately (sync call from gesture) while decoding
    this._startHtmlBgm(mode);
    // 3) Decode in background → switch to Web Audio loop when ready
    void this._ensureBgmBuffer(mode).then((buf) => {
      if (!buf || this.muted || this._bgmMode !== mode || !this.bgmOn) return;
      this._startWebAudioBgm(mode);
    });
  }

  _startWebAudioBgm(mode) {
    const buf = this._bgmBuffers.get(mode);
    if (!buf || !this.ctx || this.muted) return;

    // Stop other paths
    this._stopWebAudioBgm(true);
    this._stopProcBgm(true);
    this._pauseHtmlBgm();

    const track = BGM_TRACKS[mode] || BGM_TRACKS.battle;
    const gain = this.ctx.createGain();
    gain.gain.value = 0;
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    src.connect(gain);
    gain.connect(this.bgmBus || this.master);
    try {
      src.start(0);
    } catch (e) {
      console.warn("[sfx] bgm start failed", e);
      return;
    }
    const t = this.ctx.currentTime;
    gain.gain.linearRampToValueAtTime(track.volume, t + 0.45);
    this._bgmSource = { src, gain, mode };
    this.bgmOn = true;
    this._bgmMode = mode;
  }

  _stopWebAudioBgm(immediate = false) {
    if (!this._bgmSource || !this.ctx) {
      this._bgmSource = null;
      return;
    }
    const { src, gain } = this._bgmSource;
    const t = this.ctx.currentTime;
    try {
      if (immediate) {
        src.stop(0);
      } else {
        gain.gain.cancelScheduledValues(t);
        gain.gain.linearRampToValueAtTime(0, t + 0.35);
        src.stop(t + 0.4);
      }
    } catch {
      /* ignore */
    }
    this._bgmSource = null;
  }

  _ensureHtmlEl() {
    if (this._bgmEl) return this._bgmEl;
    const el = new Audio();
    el.loop = true;
    el.preload = "auto";
    el.crossOrigin = "anonymous";
    el.setAttribute("playsinline", "true");
    // Keep element in DOM — some browsers are pickier with detached Audio
    el.style.display = "none";
    try {
      document.body?.appendChild(el);
    } catch {
      /* ignore */
    }
    this._bgmEl = el;
    return el;
  }

  _startHtmlBgm(mode) {
    const track = BGM_TRACKS[mode] || BGM_TRACKS.battle;
    try {
      const el = this._ensureHtmlEl();
      const fileKey = track.src.split("/").pop();
      if (!el.src || !el.src.includes(fileKey)) {
        el.src = track.src;
        try {
          el.load();
        } catch {
          /* ignore */
        }
      }
      el.muted = !!this.muted;
      // Start audible immediately (no 0→fade that leaves silence if fade fails)
      el.volume = Math.min(1, track.volume);
      const playResult = el.play();
      if (playResult && typeof playResult.then === "function") {
        playResult
          .then(() => {
            this._stopProcBgm(true);
          })
          .catch((err) => {
            console.warn("[sfx] HTMLAudio BGM blocked", err?.name || err);
            // Procedural pad so player still hears *something*
            if (!this._bgmBuffers.has(mode)) this._startProcBgm(mode);
          });
      }
    } catch (err) {
      console.warn("[sfx] HTMLAudio BGM error", err);
      this._startProcBgm(mode);
    }
  }

  _pauseHtmlBgm() {
    if (!this._bgmEl) return;
    try {
      this._bgmEl.pause();
    } catch {
      /* ignore */
    }
  }

  _fadeOutHtmlBgm() {
    const el = this._bgmEl;
    if (!el) return;
    if (this._bgmFadeTimer) clearInterval(this._bgmFadeTimer);
    const start = el.volume;
    const steps = 12;
    let i = 0;
    this._bgmFadeTimer = setInterval(() => {
      i++;
      el.volume = Math.max(0, start * (1 - i / steps));
      if (i >= steps) {
        clearInterval(this._bgmFadeTimer);
        this._bgmFadeTimer = null;
        try {
          el.pause();
        } catch {
          /* ignore */
        }
      }
    }, 30);
  }

  stopBgm() {
    this.bgmOn = false;
    this._bgmMode = null;
    this._pendingBgmMode = null;
    this._stopWebAudioBgm(false);
    this._fadeOutHtmlBgm();
    this._stopProcBgm(false);
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
    filter.frequency.value = mode === "battle" ? 1600 : 1200;
    filter.Q.value = 0.5;
    bed.connect(filter);
    filter.connect(this.bgmBus || this.master);
    // Louder procedural bed so silence isn't the only outcome
    bed.gain.linearRampToValueAtTime(mode === "battle" ? 0.14 : 0.11, t0 + 0.5);

    const root = mode === "battle" ? 146.83 : 130.81;
    const thirds = mode === "battle" ? [1, 1.2, 1.5] : [1, 1.25, 1.5];
    const oscs = thirds.map((m, i) => {
      const o = this.ctx.createOscillator();
      o.type = i === 0 ? "triangle" : "sine";
      o.frequency.value = root * m;
      const g = this.ctx.createGain();
      g.gain.value = 0.4 / thirds.length;
      o.connect(g);
      g.connect(bed);
      o.start(t0);
      return o;
    });

    const lfo = this.ctx.createOscillator();
    const lfoG = this.ctx.createGain();
    lfo.type = "sine";
    lfo.frequency.value = mode === "battle" ? 0.22 : 0.12;
    lfoG.gain.value = mode === "battle" ? 220 : 140;
    lfo.connect(lfoG);
    lfoG.connect(filter.frequency);
    lfo.start(t0);

    const melody = this.ctx.createGain();
    melody.gain.value = 0.06;
    melody.connect(filter);
    const scale =
      mode === "battle" ? [0, 2, 3, 5, 7, 8, 10, 12] : [0, 2, 4, 5, 7, 9, 11, 12];
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
      g.gain.exponentialRampToValueAtTime(0.55, t + 0.02);
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
   * @param {string} name
   * @param {{ pitch?: number, heavy?: boolean }} [opts]
   */
  play(name, opts = {}) {
    if (this.muted) return;
    this.ensure();
    if (!this.ctx) return;
    if (this.ctx.state !== "running") {
      try {
        void this.ctx.resume();
      } catch {
        /* ignore */
      }
    }

    if (name === "shoot" && !this._throttle("shoot", 45)) return;
    if (name === "hit" && !this._throttle("hit", 35)) return;

    const sampleKey = this._resolveSampleKey(name, opts);
    const buf = sampleKey ? this._buffers.get(sampleKey) : null;
    if (buf) {
      this._playBuffer(buf, name, opts);
      return;
    }
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

    const filter = this.ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = name === "shoot" || name === "hit" ? 4200 : 9000;
    filter.Q.value = 0.5;

    src.connect(filter);
    filter.connect(g);
    g.connect(this.sfxBus || this.master);
    src.start(0);
  }
}

/* ── Soft procedural fallbacks ── */

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
