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
  // 官方楓之谷 UI 音效(Sound.wz UI.img)
  uiClick: "/audio/ui-msw/BtMouseClick.mp3",
  uiSelect: "/audio/ui-msw/WorldSelect.mp3",
  uiOk: "/audio/ui-msw/DlgNotice.mp3",
  uiConfirm: "/audio/ui-msw/MenuUp.mp3",
  uiToggle: "/audio/ui-msw/Tab.mp3",
  uiHover: "/audio/ui-msw/BtMouseOver.mp3",
  uiPluck: "/audio/ui-msw/MenuDown.mp3",
  error: "/audio/ui/error.ogg",
  // 官方遊戲音效(Sound.wz)
  mesoPick: "/audio/msw/pickup.mp3",
  mapleJump: "/audio/msw/jump.mp3",
  levelUp: "/audio/msw/levelup.mp3",
  mobHit: "/audio/msw/mob_hit.mp3",
  atkSword: "/audio/msw/atk_sword.mp3",
  atkPunch: "/audio/msw/atk_punch.mp3",
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

/**
 * Multi-track playlists (longer pieces rotate so loops feel less short).
 * menu.mp3 ≈ 3:12 (Little Town orchestral), menu_b ≈ 1:58, field ≈ field theme
 */
const BGM_PLAYLISTS = {
  menu: [
    { src: "/bgm/login.mp3", volume: BGM_MENU_GAIN },   // 楓之谷登入主題(WZ BgmUI/Title)
    { src: "/bgm/hunt.mp3", volume: BGM_MENU_GAIN * 0.9 }, // FloralLife 歡樂野外
    { src: "/bgm/select.mp3", volume: BGM_MENU_GAIN * 0.9 }, // 頻道選擇
  ],
  battle: [
    { src: "/audio/bgm/battle.mp3", volume: BGM_BATTLE_GAIN },
    { src: "/audio/bgm/battle_b.mp3", volume: BGM_BATTLE_GAIN * 0.95 },
  ],
};

// Back-compat single-track map (first of playlist)
const BGM_TRACKS = {
  menu: BGM_PLAYLISTS.menu[0],
  battle: BGM_PLAYLISTS.battle[0],
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
    this._bgmSource = null; // looping BufferSource (fallback)
    this._bgmEl = null; // HTMLAudio primary for multi-track
    this._bgmMode = null;
    this._bgmFadeTimer = null;
    this._procBgm = null;
    this.bgmOn = false;
    this._lastPlay = new Map();
    this._pendingBgmMode = null;
    this._playlistIndex = { menu: 0, battle: 0 };
    this._bgmEndedHandler = null;
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
    // Prefer HTMLAudio multi-track playlist (rotates so short loops feel less obvious).
    // Web Audio single-buffer loop is only a last-resort fallback.
    this._stopWebAudioBgm(true);
    this._stopProcBgm(true);
    this._startHtmlBgm(mode);
  }

  _nextPlaylistTrack(mode) {
    const list = BGM_PLAYLISTS[mode] || BGM_PLAYLISTS.menu;
    let idx = this._playlistIndex[mode] ?? 0;
    idx = (idx + 1) % list.length;
    this._playlistIndex[mode] = idx;
    return list[idx];
  }

  _currentPlaylistTrack(mode) {
    const list = BGM_PLAYLISTS[mode] || BGM_PLAYLISTS.menu;
    const idx = this._playlistIndex[mode] ?? 0;
    return list[idx % list.length];
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
    const track = this._currentPlaylistTrack(mode);
    try {
      const el = this._ensureHtmlEl();
      // Rotate tracks on natural end — do NOT set loop=true (feels too short)
      el.loop = false;
      if (this._bgmEndedHandler) {
        el.removeEventListener("ended", this._bgmEndedHandler);
      }
      this._bgmEndedHandler = () => {
        if (!this.bgmOn || this.muted || this._bgmMode !== mode) return;
        this._nextPlaylistTrack(mode);
        this._startHtmlBgm(mode);
      };
      el.addEventListener("ended", this._bgmEndedHandler);

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
      el.volume = Math.min(1, track.volume);
      const playResult = el.play();
      if (playResult && typeof playResult.then === "function") {
        playResult
          .then(() => {
            this._stopProcBgm(true);
          })
          .catch((err) => {
            console.warn("[sfx] HTMLAudio BGM blocked", err?.name || err);
            // Fallback: soft procedural pad, or try Web Audio of first track
            void this._ensureBgmBuffer(mode).then((buf) => {
              if (buf && this.bgmOn && !this.muted) this._startWebAudioBgm(mode);
              else this._startProcBgm(mode);
            });
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

    // Map skill/family aliases → base cues + pitch
    const mapped = this._mapSkillSound(name, opts);
    name = mapped.name;
    opts = { ...opts, ...mapped.opts };

    if (name === "shoot" && !this._throttle("shoot", 45)) return;
    if (name === "hit" && !this._throttle("hit", 35)) return;
    // UI 音效節流：讓「明確呼叫 + 全域委派」不會重複播放
    if (name === "uiClick" && !this._throttle("uiClick", 60)) return;
    if (name === "uiHover" && !this._throttle("uiHover", 50)) return;
    if (name === "mobHit" && !this._throttle("mobHit", 40)) return;
    if (name === "mesoPick" && !this._throttle("mesoPick", 45)) return;

    const sampleKey = this._resolveSampleKey(name, opts);
    const buf = sampleKey ? this._buffers.get(sampleKey) : null;
    if (buf) {
      this._playBuffer(buf, name, opts);
      return;
    }
    void this.preload();
    const fn = FALLBACK[name] || FALLBACK[mapped.fallback];
    if (fn) fn(this.ctx, this.sfxBus || this.master, opts);
  }

  /**
   * Differentiated SFX by combat family / effect
   */
  _mapSkillSound(name, opts) {
    const fam = opts.family;
    const effect = opts.effect;
    if (name === "shoot") {
      // skill flags first
      if (opts.fire) return { name: "shoot2", opts: { pitch: 0.7 }, fallback: "shoot" };
      if (opts.ice) return { name: "shoot", opts: { pitch: 1.5 }, fallback: "shoot" };
      if (opts.pierce) return { name: "shoot", opts: { pitch: 1.25 }, fallback: "shoot" };
      if (opts.multi) return { name: "shoot2", opts: { pitch: 1.2 }, fallback: "shoot" };
      if (opts.lockOn) return { name: "hitChop", opts: { pitch: 1.1 }, fallback: "shoot" };
      if (opts.crit) return { name: "shoot", opts: { pitch: 1.45 }, fallback: "shoot" };
      if (fam === "archer") return { name: "shoot", opts: { pitch: 1.35 }, fallback: "shoot" };
      if (fam === "mage") return { name: "shoot2", opts: { pitch: 0.75 }, fallback: "shoot" };
      if (fam === "thief") return { name: "shoot", opts: { pitch: 1.55 }, fallback: "shoot" };
      if (fam === "pirate") return { name: "hitChop", opts: { pitch: 0.9 }, fallback: "shoot" };
      if (fam === "warrior") return { name: "shoot2", opts: { pitch: 0.95 }, fallback: "shoot" };
    }
    if (name === "hit") {
      if (effect === "burn" || opts.fire) return { name: "hitHeavy", opts: { pitch: 0.85, heavy: true }, fallback: "hit" };
      if (effect === "slow" || opts.ice) return { name: "hit", opts: { pitch: 1.4 }, fallback: "hit" };
      if (effect === "analyzed" || opts.holy) return { name: "bell", opts: { pitch: 1.2 }, fallback: "hit" };
      if (opts.crit) return { name: "hitHeavy", opts: { pitch: 1.15, heavy: true }, fallback: "hit" };
      if (opts.heavy) return { name: "hitHeavy", opts: { heavy: true }, fallback: "hit" };
      if (fam === "warrior") return { name: "hitChop", opts: { pitch: 0.95 }, fallback: "hit" };
      if (fam === "thief") return { name: "hit", opts: { pitch: 1.5 }, fallback: "hit" };
      if (fam === "archer") return { name: "hit", opts: { pitch: 1.25 }, fallback: "hit" };
      if (fam === "pirate") return { name: "hitHeavy", opts: { pitch: 0.9, heavy: true }, fallback: "hit" };
    }
    if (name === "kill") {
      if (opts.boss) return { name: "waveClear", opts: {}, fallback: "kill" };
    }
    if (name === "jobChange") return { name: "waveClear", opts: {}, fallback: "waveClear" };
    if (name === "bossPhase") return { name: "bell", opts: { pitch: 0.7 }, fallback: "waveStart" };
    return { name, opts, fallback: name };
  }

  _resolveSampleKey(name, opts) {
    if (name === "hit") return opts.heavy ? "hitHeavy" : "hit";
    if (name === "shoot") return Math.random() > 0.5 ? "shoot" : "shoot2";
    if (name === "uiClick") return "uiClick";
    if (SAMPLE_MAP[name]) return name;
    return null;
  }

  /** Convenience: shoot by job family + skill flags */
  playShoot(family, skillOpts = {}) {
    this.play("shoot", { family, ...skillOpts });
  }

  playHit(opts = {}) {
    this.play("hit", opts);
  }

  /**
   * Boss 專用音效（預示 / 施放）
   * @param {'telegraph'|'cast'|'phase'|'kill'} phase
   * @param {{ bossId?: string, skillId?: string, skillType?: string, skillName?: string }} meta
   */
  playBoss(phase, meta = {}) {
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
    const key = `boss_${phase}_${meta.bossId || "x"}_${meta.skillId || meta.skillType || "y"}`;
    if (!this._throttle(key, phase === "telegraph" ? 80 : 50)) return;

    const dest = this.sfxBus || this.master;
    const bossId = meta.bossId || "";
    const skillId = meta.skillId || "";
    const skillType = meta.skillType || "";

    if (phase === "telegraph") {
      playBossTelegraph(this.ctx, dest, bossId, skillId, skillType);
      return;
    }
    if (phase === "cast") {
      playBossCast(this.ctx, dest, bossId, skillId, skillType);
      return;
    }
    if (phase === "phase") {
      playBossPhaseSting(this.ctx, dest, bossId);
      return;
    }
    if (phase === "kill") {
      playBossKill(this.ctx, dest, bossId);
      return;
    }
    // fallback
    this.play("bossPhase");
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
  bossPhase(ctx, master) {
    const t = ctx.currentTime;
    tone(ctx, master, t, { type: "sine", freq: 220, freqEnd: 180, duration: 0.2, peak: 0.1 });
    tone(ctx, master, t + 0.08, { type: "triangle", freq: 330, duration: 0.18, peak: 0.08 });
  },
};

/* ═══════════════════════════════════════════
 * Boss 專屬音色（程序合成，每王不同性格）
 * 海怒斯：深海濕潤／氣泡
 * 拉圖斯：時鐘／水晶／次元
 * 炎魔：熔岩／金屬重擊
 * 暗黑龍王：龍吼／毒／雷
 * 皮卡啾：俏皮高頻／花瓣／狂暴轉暗
 * ═══════════════════════════════════════════ */

function bossBase(bossId) {
  // 各 Boss 主頻、波形、噪音色
  const map = {
    boss_hainurs: { f: 110, wave: "sine", noise: 600, wet: true },
    boss_papulatus: { f: 440, wave: "triangle", noise: 2400, wet: false },
    boss_zakum: { f: 90, wave: "sawtooth", noise: 400, wet: false },
    boss_dark_dragon: { f: 70, wave: "sawtooth", noise: 900, wet: true },
    boss_pink_bean: { f: 520, wave: "square", noise: 3200, wet: false },
    boss_horntail: { f: 110, wave: "sine", noise: 600, wet: true },
  };
  return map[bossId] || { f: 200, wave: "triangle", noise: 1200, wet: false };
}

function playBossTelegraph(ctx, dest, bossId, skillId, skillType) {
  const t = ctx.currentTime;
  const b = bossBase(bossId);
  // 預示：短促上升音 + 輕噪音
  tone(ctx, dest, t, {
    type: b.wave === "sawtooth" ? "triangle" : b.wave,
    freq: b.f * 1.5,
    freqEnd: b.f * 2.2,
    duration: 0.18,
    peak: 0.09,
  });
  noiseBurst(ctx, dest, t, { duration: 0.1, peak: 0.04, filterFreq: b.noise });
  // 拉圖斯預示多一聲時鐘
  if (bossId === "boss_papulatus") {
    tone(ctx, dest, t + 0.12, { type: "sine", freq: 880, duration: 0.06, peak: 0.07 });
    tone(ctx, dest, t + 0.2, { type: "sine", freq: 880, duration: 0.06, peak: 0.05 });
  }
  // 皮卡啾俏皮
  if (bossId === "boss_pink_bean") {
    tone(ctx, dest, t + 0.1, { type: "square", freq: 660, freqEnd: 990, duration: 0.08, peak: 0.05 });
  }
  // 全場招預示更長
  if (skillType === "silence" || skillId === "time_stop" || skillId === "seal" || skillId === "mouth") {
    tone(ctx, dest, t + 0.15, { type: "sine", freq: b.f, freqEnd: b.f * 0.7, duration: 0.25, peak: 0.08 });
  }
}

function playBossCast(ctx, dest, bossId, skillId, skillType) {
  const t = ctx.currentTime;
  const b = bossBase(bossId);
  const id = skillId || "";
  const typ = skillType || "";

  // ── 依 skill id 專屬 ──
  if (id === "phys_immune" || id === "turtleneck" || typ === "immune") {
    // 金屬盾
    tone(ctx, dest, t, { type: "triangle", freq: 600, freqEnd: 200, duration: 0.2, peak: 0.1 });
    tone(ctx, dest, t + 0.05, { type: "sine", freq: 900, freqEnd: 400, duration: 0.25, peak: 0.07 });
    noiseBurst(ctx, dest, t, { duration: 0.12, peak: 0.05, filterFreq: 3000 });
    return;
  }
  if (id === "mouth") {
    // 嘴炮：低頻嗡 + 噪音爆破
    tone(ctx, dest, t, { type: "sawtooth", freq: 80, freqEnd: 40, duration: 0.35, peak: 0.11 });
    noiseBurst(ctx, dest, t, { duration: 0.2, peak: 0.1, filterFreq: 900 });
    noiseBurst(ctx, dest, t + 0.1, { duration: 0.15, peak: 0.06, filterFreq: 400 });
    return;
  }
  if (id === "fire_pillar" || id === "pillar" || id === "breath" || id === "petal" || id === "tide") {
    // 柱／息／潮：上升焰 + 衝擊
    noiseBurst(ctx, dest, t, { duration: 0.25, peak: 0.1, filterFreq: id === "tide" ? 500 : 1200 });
    tone(ctx, dest, t, { type: "sawtooth", freq: b.f, freqEnd: b.f * 3, duration: 0.28, peak: 0.1 });
    tone(ctx, dest, t + 0.15, { type: "triangle", freq: 200, freqEnd: 80, duration: 0.2, peak: 0.09 });
    return;
  }
  if (id === "crush" || (id === "slam" && bossId === "boss_hainurs")) {
    // 千斤墜：超重落地
    tone(ctx, dest, t, { type: "sine", freq: 60, freqEnd: 30, duration: 0.35, peak: 0.16 });
    noiseBurst(ctx, dest, t, { duration: 0.2, peak: 0.12, filterFreq: 200 });
    noiseBurst(ctx, dest, t + 0.05, { duration: 0.15, peak: 0.08, filterFreq: 80 });
    return;
  }
  if (id === "dispel") {
    tone(ctx, dest, t, { type: "sine", freq: 800, freqEnd: 200, duration: 0.3, peak: 0.08 });
    tone(ctx, dest, t + 0.08, { type: "triangle", freq: 600, freqEnd: 100, duration: 0.25, peak: 0.06 });
    return;
  }
  if (id === "summon" || id === "black_ball" || id === "statue" || typ === "summonPulse") {
    [b.f, b.f * 1.25, b.f * 1.5].forEach((f, i) => {
      tone(ctx, dest, t + i * 0.06, { type: "triangle", freq: f, freqEnd: f * 1.4, duration: 0.12, peak: 0.07 });
    });
    noiseBurst(ctx, dest, t + 0.1, { duration: 0.1, peak: 0.05, filterFreq: b.noise });
    return;
  }
  if (id === "time_magic" || id === "time_stop" || id.includes("time")) {
    // 時鐘：滴答 + 次元掃頻
    tone(ctx, dest, t, { type: "sine", freq: 1200, duration: 0.05, peak: 0.08 });
    tone(ctx, dest, t + 0.1, { type: "sine", freq: 1200, duration: 0.05, peak: 0.07 });
    tone(ctx, dest, t + 0.15, { type: "triangle", freq: 400, freqEnd: 80, duration: 0.4, peak: 0.12 });
    noiseBurst(ctx, dest, t + 0.2, { duration: 0.2, peak: 0.06, filterFreq: 2000 });
    return;
  }
  if (id === "reflect" || id === "scale" || typ === "reflect") {
    tone(ctx, dest, t, { type: "sine", freq: 1000, freqEnd: 1400, duration: 0.12, peak: 0.09 });
    tone(ctx, dest, t + 0.06, { type: "triangle", freq: 1400, freqEnd: 600, duration: 0.18, peak: 0.08 });
    noiseBurst(ctx, dest, t, { duration: 0.08, peak: 0.05, filterFreq: 4000 });
    return;
  }
  if (id === "drain") {
    tone(ctx, dest, t, { type: "sine", freq: 300, freqEnd: 120, duration: 0.35, peak: 0.1 });
    tone(ctx, dest, t + 0.1, { type: "triangle", freq: 180, freqEnd: 90, duration: 0.3, peak: 0.08 });
    return;
  }
  if (id === "arm" || id === "slam") {
    // 手臂／揮掌
    tone(ctx, dest, t, { type: "sawtooth", freq: 120, freqEnd: 45, duration: 0.22, peak: 0.13 });
    noiseBurst(ctx, dest, t, { duration: 0.12, peak: 0.09, filterFreq: 500 });
    return;
  }
  if (id === "lava") {
    noiseBurst(ctx, dest, t, { duration: 0.28, peak: 0.11, filterFreq: 700 });
    tone(ctx, dest, t, { type: "sawtooth", freq: 90, freqEnd: 50, duration: 0.3, peak: 0.1 });
    return;
  }
  if (id === "seal" || typ === "silence") {
    // 封印／沉默：壓制低鳴
    tone(ctx, dest, t, { type: "sine", freq: 180, freqEnd: 90, duration: 0.3, peak: 0.11 });
    tone(ctx, dest, t + 0.05, { type: "triangle", freq: 240, freqEnd: 100, duration: 0.28, peak: 0.08 });
    return;
  }
  if (id === "cube" || typ === "healCube") {
    [523, 659, 784].forEach((f, i) => {
      tone(ctx, dest, t + i * 0.05, { type: "sine", freq: f, duration: 0.15, peak: 0.08 });
    });
    return;
  }
  if (id === "curse" || typ === "curse") {
    tone(ctx, dest, t, { type: "sawtooth", freq: 150, freqEnd: 60, duration: 0.4, peak: 0.1 });
    tone(ctx, dest, t + 0.1, { type: "triangle", freq: 100, freqEnd: 40, duration: 0.35, peak: 0.08 });
    return;
  }
  if (id === "poison" || typ === "poisonBreath") {
    noiseBurst(ctx, dest, t, { duration: 0.3, peak: 0.09, filterFreq: 500 });
    tone(ctx, dest, t, { type: "sine", freq: 140, freqEnd: 70, duration: 0.35, peak: 0.08 });
    tone(ctx, dest, t + 0.12, { type: "triangle", freq: 200, freqEnd: 80, duration: 0.25, peak: 0.06 });
    return;
  }
  if (id === "tail") {
    tone(ctx, dest, t, { type: "sawtooth", freq: 100, freqEnd: 40, duration: 0.2, peak: 0.12 });
    noiseBurst(ctx, dest, t, { duration: 0.1, peak: 0.08, filterFreq: 600 });
    return;
  }
  if (id === "chain" || typ === "chainLightning") {
    // 連鎖閃電：連續高頻
    [0, 0.07, 0.14].forEach((off, i) => {
      noiseBurst(ctx, dest, t + off, { duration: 0.06, peak: 0.1, filterFreq: 3500 - i * 400 });
      tone(ctx, dest, t + off, { type: "square", freq: 800 - i * 100, freqEnd: 400, duration: 0.08, peak: 0.07 });
    });
    return;
  }
  if (id === "rock") {
    noiseBurst(ctx, dest, t, { duration: 0.08, peak: 0.06, filterFreq: 1500 });
    tone(ctx, dest, t + 0.08, { type: "triangle", freq: 90, freqEnd: 40, duration: 0.18, peak: 0.12 });
    noiseBurst(ctx, dest, t + 0.1, { duration: 0.12, peak: 0.1, filterFreq: 300 });
    return;
  }
  if (id === "feather" || typ === "multiSilence") {
    [660, 770, 880].forEach((f, i) => {
      tone(ctx, dest, t + i * 0.05, { type: "sine", freq: f, freqEnd: f * 1.2, duration: 0.1, peak: 0.06 });
    });
    noiseBurst(ctx, dest, t, { duration: 0.12, peak: 0.04, filterFreq: 4000 });
    return;
  }
  if (id === "rage" || typ === "enrage" || typ === "hastePulse") {
    tone(ctx, dest, t, { type: "sawtooth", freq: 80, freqEnd: 200, duration: 0.35, peak: 0.14 });
    tone(ctx, dest, t + 0.1, { type: "square", freq: 200, freqEnd: 400, duration: 0.25, peak: 0.1 });
    noiseBurst(ctx, dest, t, { duration: 0.25, peak: 0.1, filterFreq: 800 });
    return;
  }
  if (typ === "coreStrike") {
    tone(ctx, dest, t, { type: "triangle", freq: b.f * 1.2, freqEnd: b.f * 0.4, duration: 0.28, peak: 0.12 });
    noiseBurst(ctx, dest, t, { duration: 0.15, peak: 0.08, filterFreq: b.noise });
    return;
  }
  if (typ === "shockwave") {
    tone(ctx, dest, t, { type: "sine", freq: b.f, freqEnd: b.f * 0.4, duration: 0.25, peak: 0.12 });
    noiseBurst(ctx, dest, t, { duration: 0.14, peak: 0.09, filterFreq: b.noise * 0.5 });
    return;
  }

  // ── Boss 性格預設施放音 ──
  if (bossId === "boss_hainurs") {
    tone(ctx, dest, t, { type: "sine", freq: 100, freqEnd: 50, duration: 0.3, peak: 0.11 });
    noiseBurst(ctx, dest, t, { duration: 0.18, peak: 0.07, filterFreq: 500 });
    // 氣泡
    tone(ctx, dest, t + 0.1, { type: "sine", freq: 400, freqEnd: 700, duration: 0.08, peak: 0.04 });
    tone(ctx, dest, t + 0.16, { type: "sine", freq: 500, freqEnd: 800, duration: 0.07, peak: 0.03 });
  } else if (bossId === "boss_papulatus") {
    tone(ctx, dest, t, { type: "sine", freq: 880, duration: 0.05, peak: 0.08 });
    tone(ctx, dest, t + 0.08, { type: "triangle", freq: 440, freqEnd: 110, duration: 0.3, peak: 0.1 });
  } else if (bossId === "boss_zakum") {
    tone(ctx, dest, t, { type: "sawtooth", freq: 70, freqEnd: 35, duration: 0.3, peak: 0.13 });
    noiseBurst(ctx, dest, t, { duration: 0.2, peak: 0.1, filterFreq: 450 });
  } else if (bossId === "boss_dark_dragon") {
    tone(ctx, dest, t, { type: "sawtooth", freq: 55, freqEnd: 30, duration: 0.4, peak: 0.14 });
    tone(ctx, dest, t + 0.1, { type: "triangle", freq: 90, freqEnd: 40, duration: 0.3, peak: 0.09 });
    noiseBurst(ctx, dest, t, { duration: 0.22, peak: 0.08, filterFreq: 350 });
  } else if (bossId === "boss_pink_bean") {
    tone(ctx, dest, t, { type: "square", freq: 520, freqEnd: 780, duration: 0.12, peak: 0.08 });
    tone(ctx, dest, t + 0.1, { type: "sine", freq: 660, freqEnd: 330, duration: 0.2, peak: 0.09 });
  } else {
    tone(ctx, dest, t, { type: "triangle", freq: b.f, freqEnd: b.f * 0.5, duration: 0.25, peak: 0.1 });
  }
}

function playBossPhaseSting(ctx, dest, bossId) {
  const t = ctx.currentTime;
  const b = bossBase(bossId);
  // 相位轉換：三連音，每王音階不同
  const chords = {
    boss_hainurs: [110, 147, 165],
    boss_papulatus: [440, 554, 659],
    boss_zakum: [82, 110, 131],
    boss_dark_dragon: [65, 82, 98],
    boss_pink_bean: [523, 659, 784],
  };
  const notes = chords[bossId] || [b.f, b.f * 1.25, b.f * 1.5];
  notes.forEach((f, i) => {
    tone(ctx, dest, t + i * 0.1, {
      type: bossId === "boss_zakum" || bossId === "boss_dark_dragon" ? "sawtooth" : "sine",
      freq: f,
      duration: 0.22,
      peak: 0.1,
    });
  });
  noiseBurst(ctx, dest, t, { duration: 0.15, peak: 0.06, filterFreq: b.noise });
}

function playBossKill(ctx, dest, bossId) {
  const t = ctx.currentTime;
  const b = bossBase(bossId);
  playBossPhaseSting(ctx, dest, bossId);
  tone(ctx, dest, t + 0.35, { type: "sine", freq: b.f * 2, freqEnd: b.f * 4, duration: 0.35, peak: 0.1 });
  noiseBurst(ctx, dest, t + 0.3, { duration: 0.25, peak: 0.08, filterFreq: b.noise });
}

export const sfx = new SfxEngine();
