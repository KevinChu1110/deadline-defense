import { getStageById, markStageCleared, loadProgress as loadStageProgress } from "../data/stages.js";
import {
  SPECIALISTS,
  SPECIALIST_ORDER,
  DEFAULT_LOADOUT,
  LOADOUT_MAX,
} from "../data/specialists.js";
import { getItem } from "../data/items.js";
import {
  buildLeveledDef,
  getCardLevel,
  addMapleLeaves,
  rewardForWaveClear,
  rewardForStageWin,
  loadCardProgress,
} from "../data/card-progress.js";
import {
  canJobChange,
  getNextJobIds,
  markJobLearned,
  getJobChangeCost,
  canDeployJob,
  mesosForKill,
  mesosForWaveClear,
} from "../data/job-tree.js";
import { buildPathMetrics } from "./path.js";
import {
  createEnemy,
  createSpecialist,
  fireSpecialist,
  updateEnemy,
  updateSpecialist,
  updateProjectile,
  retargetPierce,
  isTargetable,
  applyHit,
  scoreTarget,
  isSpecialistDisabled,
} from "./entities.js";
import { drawScene } from "./render.js";
import {
  createParticles,
  createRing,
  createFloatText,
  createMuzzle,
  updateFx,
} from "./fx.js";
import { sfx } from "../audio/sfx.js";
import { preloadMobs } from "./assets.js";
import { ENEMIES } from "../data/enemies.js";
import { getJobSkill } from "../data/combat-skills.js";
import {
  createHazardState,
  tickHazards,
  tickPortalCd,
  sampleHazardOnEnemy,
  tryPortalJump,
} from "./hazards.js";
import { computeSynergies } from "../data/synergy.js";
import {
  evaluateStars,
  claimStageStars,
  failConsolationLeaves,
} from "../data/meta-progress.js";
import { buildHitVfx, buildShootVfx, createBossBanner } from "./combat-vfx.js";
import {
  computeClearScore,
  submitStageScore,
  submitArenaScore,
  getNickname,
} from "../data/ranking.js";
import { themeForStage } from "../data/map-themes.js";
import { markJobUsed, markEnemy } from "../data/dex.js";
import { applyChallengeToStage, isJobAllowedThisWeek } from "../data/weekly-challenge.js";
import { BOSSES } from "../data/bosses.js";
import { applyBossCast, tickBossAttacks } from "./boss-attacks.js";
import {
  initBcState,
  tickBcWallet,
  tickBcSpawnCd,
  bcSpawnReady,
  markBcSpawned,
  updateBcSpecialist,
  updateBcEnemy,
  placeEnemyOnBcLane,
  damageEnemyCastle,
} from "./battle-cats-mode.js";

function defaultBuffs() {
  return {
    attackSpeedMult: 1,
    damageMult: 1,
    armorBreak: 0,
    coreShield: 0,
    coreSlowRadius: 0,
    coreSlowPower: 0.55,
  };
}

function buildPathMap(stage) {
  const paths = stage.map.paths || (stage.map.path ? { workflow: stage.map.path } : {});
  const metrics = {};
  for (const [key, points] of Object.entries(paths)) {
    metrics[key] = buildPathMetrics(points);
  }
  return { paths, metrics };
}

/**
 * Main game controller.
 */
export class Game {
  constructor(canvas, ui, stageId = "s01-victoria") {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.ui = ui;
    this.sfx = sfx;
    this.loadout = [...DEFAULT_LOADOUT];
    this.loadStage(stageId);
    this._bindInput();
    this._raf = 0;
    this._last = 0;
    this._preloadAssets();
  }

  _preloadAssets() {
    const files = [
      ...new Set(Object.values(ENEMIES).map((e) => e.sprite).filter(Boolean)),
    ];
    preloadMobs(files).catch(() => {});
  }

  loadStage(stageId, opts = {}) {
    this.stageId = stageId;
    this.stage = structuredClone(getStageById(stageId));
    // 每週挑戰：把規則卡修飾符套進這個 stage 副本（改副本安全）
    this.challenge = opts.challenge || null;
    if (this.challenge) applyChallengeToStage(this.stage, this.challenge);
    const built = buildPathMap(this.stage);
    this.pathMap = built.paths;
    this.pathMetricsMap = built.metrics;
    this.hazardState = createHazardState(this.stage.map);
    this.bcMode = !!(this.stage.bcMode || this.stage.arena || this.stage.map?.bcMode);
    this.reset();
  }

  setLoadout(ids) {
    const clean = [];
    for (const id of ids || []) {
      if (
        SPECIALISTS[id] &&
        !clean.includes(id) &&
        clean.length < LOADOUT_MAX &&
        canDeployJob(id) &&
        (!this.challenge || isJobAllowedThisWeek(id, this.challenge)) // 週挑戰編隊限制
      ) {
        clean.push(id);
      }
    }
    if (!clean.length) clean.push("beginner");
    this.loadout = clean;
    if (this.placingType && !this.loadout.includes(this.placingType)) {
      this.placingType = null;
    }
    this.ui?.onState?.(this.getPublicState());
  }

  reset() {
    this.coreHp = this.stage.coreHp;
    this.coreMax = this.stage.coreHp;
    this.points = this.stage.deploymentPoints;
    this.teamLimit = this.stage.teamLimit;
    /** 局內楓幣：擊殺／清波獲得，用於場上轉職（每關重置） */
    this.mesos = 0;
    this.mesosEarned = 0;
    this.waveMesoFromCrit = 0;
    this.leaks = 0;
    this.coreHitFlash = 0;
    this.usedJobChange = false;
    this.hazardState = createHazardState(this.stage.map);
    this.waveIndex = -1;
    this.waveActive = false;
    this.spawnQueue = [];
    this.enemies = [];
    this.specialists = [];
    this.projectiles = [];
    this.fx = [];
    this.padsOccupied = new Map();
    this.placingType = null;
    this.selectedSpecialistId = null;
    this.hoverPad = null;
    this.speed = 1;
    this.now = 0;
    this.elapsed = 0;
    this.result = null;
    this.paused = false;
    this.pausedForReward = false;
    this.pendingRewardChoices = null;
    this.buffs = defaultBuffs();
    this.pickedItems = [];
    this.bcMode = !!(this.stage.bcMode || this.stage.arena || this.stage.map?.bcMode);
    this.bc = this.bcMode ? initBcState(this.stage.map, this.stage) : null;
    this.status = this.bcMode
      ? "遠征推線 — 點職業卡出兵，推倒敵方基地！"
      : "Ready — 部署初心者、清怪賺楓幣，再場上轉職";
    this.sfx.stopBgm();
    this.ui?.onState?.(this.getPublicState());
  }

  addMesos(amount, { x, y, silent = false } = {}) {
    const n = Math.max(0, Math.floor(amount));
    if (!n) return;
    this.mesos += n;
    this.mesosEarned = (this.mesosEarned || 0) + n;
    if (!silent && x != null && y != null) {
      this.fx.push(createFloatText(x, y - 10, `+${n}幣`, "#fbbf24"));
    }
  }

  start() {
    if (this._raf) cancelAnimationFrame(this._raf);
    this._last = performance.now();
    const loop = (t) => {
      const rawDt = Math.min(0.05, (t - this._last) / 1000);
      this._last = t;
      // freeze combat while reward / pause, still allow tiny fx
      const dt = this.pausedForReward || this.paused ? 0 : rawDt * this.speed;
      this.update(dt, rawDt);
      this.render();
      this._raf = requestAnimationFrame(loop);
    };
    this._raf = requestAnimationFrame(loop);
  }

  stop() {
    cancelAnimationFrame(this._raf);
    this._raf = 0;
  }

  getPublicState() {
    const hasMoreWaves = this.waveIndex + 1 < this.stage.waves.length;
    return {
      stageId: this.stage.id,
      stageCode: this.stage.code,
      stageName: this.stage.name,
      coreHp: this.coreHp,
      coreMax: this.coreMax,
      points: this.points,
      teamCount: this.specialists.length,
      teamLimit: this.teamLimit,
      waveIndex: this.waveIndex,
      waveTotal: this.stage.waves.length,
      waveName: this.waveIndex >= 0 ? this.stage.waves[this.waveIndex].name : "—",
      waveIntel: this.waveIndex >= 0 ? this.stage.waves[this.waveIndex].intel : this.stage.briefing,
      placingType: this.placingType,
      selectedSpecialistId: this.selectedSpecialistId,
      speed: this.speed,
      status: this.status,
      result: this.result,
      waveActive: this.waveActive,
      paused: !!this.paused,
      canStartWave:
        !this.waveActive &&
        !this.pausedForReward &&
        !this.paused &&
        this.result == null &&
        hasMoreWaves,
      muted: this.sfx.muted,
      buffs: { ...this.buffs },
      pickedItems: [...this.pickedItems],
      pendingRewardChoices: this.pendingRewardChoices,
      pausedForReward: this.pausedForReward,
      pathKeys: Object.keys(this.pathMap),
      loadout: [...this.loadout],
      loadoutMax: LOADOUT_MAX,
      leaves: loadCardProgress().leaves,
      mesos: this.mesos || 0,
      mesosEarned: this.mesosEarned || 0,
      leaks: this.leaks || 0,
      synergyLabels: this._synergyBuffs().synergyLabels || [],
      lastStars: this.lastStars || null,
      lastScore: this.lastScore || 0,
      mapTheme: themeForStage(this.stage),
      isArena: !!this.stage.arena,
      arenaBossId: this.stage.arenaBossId || null,
      bcMode: !!this.bcMode,
      enemyCastleHp: this.bc?.enemyCastleHp ?? 0,
      enemyCastleMax: this.bc?.enemyCastleMax ?? 0,
      walletMax: this.bc?.walletMax ?? 0,
      spawnCd: this.bc?.spawnCd ? { ...this.bc.spawnCd } : {},
      jobChangeOptions:
        this.bcMode
          ? []
          : this.selectedSpecialistId
            ? this.getJobChangeOptions(this.selectedSpecialistId)
            : [],
      bossHud: this._getBossHud(),
      controlHud: this._getControlHud(),
      placingHint: this.bcMode
        ? "點右側職業卡出兵 → 單位自動往右推線 · 推倒敵方基地獲勝"
        : this.placingType
          ? `部署「${SPECIALISTS[this.placingType]?.nameZh || "職業"}」— 點地圖綠格／再點卡自動放 · Esc 取消`
          : null,
      coreHitFlash: this.coreHitFlash || 0,
    };
  }

  /**
   * 貓咪大戰爭式出兵（遠征）
   * @returns {boolean}
   */
  tryDeployBc(typeId) {
    if (!this.bcMode || !this.bc) return false;
    if (this.result || this.pausedForReward) return false;
    // 暫停時出兵 = 自動解除暫停（避免教學／誤觸卡住）
    if (this.paused) {
      this.paused = false;
      this.ui?.onPauseChange?.(false);
    }
    if (!typeId || !this.loadout.includes(typeId)) {
      this.sfx.play("error");
      this.ui?.toast?.("此職業不在出戰名單");
      return false;
    }
    if (!canDeployJob(typeId)) {
      this.sfx.play("error");
      this.ui?.toast?.("此職業尚未解鎖");
      return false;
    }
    if (!bcSpawnReady(this.bc, typeId)) {
      this.sfx.play("error");
      this.ui?.toast?.("出兵冷卻中…");
      return false;
    }
    // 只計存活單位
    const alive = this.specialists.filter((s) => s.alive !== false && !s._bcDead).length;
    if (alive >= (this.bc.maxUnits || this.teamLimit)) {
      this.sfx.play("error");
      this.ui?.toast?.("戰場人數已滿");
      return false;
    }
    const level = getCardLevel(typeId);
    const def = buildLeveledDef(typeId, level);
    if (this.points < def.cost) {
      this.sfx.play("error");
      this.ui?.toast?.("錢包不足（會自動回復）");
      return false;
    }
    const base = this.bc.playerBase;
    const yOff = ((this.specialists.length % 5) - 2) * 7;
    const pad = { x: base.x + 36 + Math.random() * 16, y: this.bc.laneY + yOff };
    const unit = createSpecialist(typeId, -1, pad, def);
    unit.bcMode = true;
    unit.bcYOff = yOff;
    unit.facing = 1;
    unit.alive = true;
    unit.hp = 32 + (def.damage || 8) * 2.2;
    unit.maxHp = unit.hp;
    this.specialists.push(unit);
    this.points -= def.cost;
    markBcSpawned(this.bc, typeId);
    this.selectedSpecialistId = null;
    this.placingType = null;
    this.status = `${def.nameZh} 出兵！`;
    this.sfx.play("deploy");
    this.fx.push(...createParticles(pad.x, pad.y, def.color, 10, { speed: 80, life: 0.35 }));
    this.fx.push(createRing(pad.x, pad.y, def.color, { maxR: 36, life: 0.28 }));
    // 遠征：第一隻兵出陣後自動開第一波（更像貓咪大戰爭）
    if (this.waveIndex < 0 && !this.waveActive) {
      this.startNextWave();
    }
    this.ui?.onState?.(this.getPublicState());
    this.ui?.toast?.(`${def.nameZh} −${def.cost} 出兵`);
    return true;
  }

  _winBcSiege() {
    if (this.result) return;
    this.result = "win";
    this.waveActive = false;
    if (this.bc) this.bc.siege = false;
    this.status = "遠征勝利！敵方基地陷落！";
    this.sfx.play("win");
    this.sfx.stopBgm();
    this.fx.push(
      createFloatText(this.bc.enemyBase.x, this.bc.enemyBase.y - 48, "BASE DOWN", "#fde68a")
    );
    this.fx.push(
      ...createParticles(this.bc.enemyBase.x, this.bc.enemyBase.y, "#fbbf24", 28, {
        speed: 140,
        life: 0.7,
      })
    );
    this.waveIndex = Math.max(this.waveIndex, this.stage.waves.length - 1);
    const stageIndex = this.stage.index ?? 0;
    const winLeaves = 25;
    addMapleLeaves(winLeaves, "arena");
    this.lastStars = null;
    const score = computeClearScore({
      coreHp: this.coreHp,
      coreMax: this.coreMax,
      mesos: this.mesosEarned || this.mesos || 0,
      leaks: this.leaks || 0,
      usedJobChange: this.usedJobChange,
      waveTotal: this.stage.waves.length,
      stageIndex: 12,
      bossKill: true,
    });
    this.lastScore = score;
    const nick = getNickname() || "冒險者";
    const bossId = this.stage.arenaBossId;
    const bossName = BOSSES[bossId]?.nameZh || this.stage.name;
    submitArenaScore({
      nick,
      score,
      bossId,
      bossName,
      coreHp: this.coreHp,
      leaks: this.leaks || 0,
    });
    this.ui?.toast?.(`遠征勝利 · 分數 ${score} · 🍁+${winLeaves}`);
    this.ui?.onResult?.("win");
    this.ui?.onState?.(this.getPublicState());
  }

  /** 場上 Boss 血條 + 下一招 */
  _getBossHud() {
    const out = [];
    for (const e of this.enemies || []) {
      if (!e.alive || !e.def?.boss) continue;
      let next = null;
      if (e.bossAtk?.casting) {
        const sk = e.bossAtk.casting.skill;
        next = {
          name: sk?.name || "蓄力",
          t: Math.max(0, e.bossAtk.casting.t),
          maxT: e.bossAtk.casting.maxT || 1,
          casting: true,
          color: sk?.color || e.def.color,
        };
      } else if (e.bossAtk?.queue?.length) {
        const ready = e.bossAtk.queue
          .filter((s) => !(s.once && s._usedOnce))
          .slice()
          .sort((a, b) => a.cd - b.cd)[0];
        if (ready) {
          next = {
            name: ready.name,
            t: Math.max(0, ready.cd),
            maxT: ready.interval || 10,
            casting: false,
            color: ready.color || e.def.color,
          };
        }
      }
      out.push({
        id: e.id,
        name: e.def.nameZh,
        color: e.def.color,
        hp: e.hp,
        maxHp: e.maxHp,
        ratio: e.hp / Math.max(1, e.maxHp),
        next,
        immune: (e.status?.bossImmuneUntil || 0) > this.now,
        reflect: (e.status?.bossReflectUntil || 0) > this.now,
      });
    }
    return out;
  }

  /** 被控職業摘要 */
  _getControlHud() {
    const list = [];
    for (const s of this.specialists || []) {
      const stunLeft = Math.max(0, (s.stunnedUntil || 0) - this.now);
      const silenceLeft = Math.max(0, (s.silencedUntil || 0) - this.now);
      const curseLeft = Math.max(0, (s.cursedUntil || 0) - this.now);
      if (stunLeft <= 0 && silenceLeft <= 0 && curseLeft <= 0) continue;
      list.push({
        id: s.id,
        name: s.def.nameZh,
        stun: stunLeft,
        silence: silenceLeft,
        curse: curseLeft,
      });
    }
    return list;
  }

  /** Deploy cost for current card level */
  getDeployCost(typeId) {
    const def = buildLeveledDef(typeId, getCardLevel(typeId));
    return def?.cost ?? SPECIALISTS[typeId]?.cost ?? 99;
  }

  setPlacing(typeId) {
    if (this.result || this.pausedForReward || this.paused) return;
    if (typeId && !this.loadout.includes(typeId)) {
      this.sfx.play("error");
      this.ui?.toast?.("此職業不在出戰名單");
      return;
    }
    this.placingType = typeId;
    this.selectedSpecialistId = null;
    if (typeId) {
      this.sfx.play("uiClick");
      const d = SPECIALISTS[typeId];
      const lv = getCardLevel(typeId);
      const cost = this.getDeployCost(typeId);
      this.status = `部署 ${d.nameZh} ★${lv} — 拖到綠格「+」鬆手（${cost} 點）`;
      // Keep canvas cursor as a hint
      if (this.canvas) this.canvas.style.cursor = "cell";
    } else if (this.canvas) {
      this.canvas.style.cursor = "crosshair";
    }
    this.ui?.onState?.(this.getPublicState());
  }

  toggleSpeed() {
    if (this.paused) return;
    this.speed = this.speed === 1 ? 2 : this.speed === 2 ? 3 : 1;
    this.sfx.play("uiClick");
    this.ui?.onState?.(this.getPublicState());
  }

  /** 手動暫停／繼續（與選道具暫停分開） */
  setPaused(on) {
    if (this.result) return false;
    if (this.pausedForReward && on) return false; // 選道具時不要疊手動暫停
    const next = !!on;
    if (this.paused === next) return this.paused;
    this.paused = next;
    if (this.paused) {
      this.setPlacing(null);
      this.status = "⏸ 暫停中 — 按 Space 或「繼續」";
    } else {
      this.status = this.waveActive
        ? `第 ${this.waveIndex + 1} 波進行中`
        : "Ready — 可繼續部署後 Start Wave";
      if (!this.sfx.muted) {
        this.sfx.startBgm(this.waveActive ? "battle" : "menu");
      }
    }
    this.sfx.play("uiClick");
    this.ui?.onState?.(this.getPublicState());
    this.ui?.onPauseChange?.(this.paused);
    return this.paused;
  }

  togglePause() {
    if (this.result || this.pausedForReward) return this.paused;
    return this.setPaused(!this.paused);
  }

  toggleMute() {
    const muted = this.sfx.toggleMute();
    if (!muted) {
      this.sfx.play("uiClick");
      // Resume BGM after unmute (gesture-safe — called from click)
      this.sfx.startBgm(this.waveActive ? "battle" : "menu");
    }
    this.ui?.onState?.(this.getPublicState());
    return muted;
  }

  startNextWave() {
    if (this.waveActive || this.result || this.pausedForReward) return;
    // 遠征／一般：暫停中開波 = 自動繼續
    if (this.paused) {
      this.paused = false;
      this.ui?.onPauseChange?.(false);
    }
    const next = this.waveIndex + 1;
    if (next >= this.stage.waves.length) return;

    this.waveIndex = next;
    const wave = this.stage.waves[next];
    this.waveActive = true;
    this.spawnQueue = [];
    this.elapsed = 0;

    const isBossWave =
      next === 4 || next === 9 || /Boss|BOSS|boss|競賽|遠征/.test(wave.name || "");
    for (const group of wave.groups || []) {
      let t = Number(group.at) || 0;
      const pathKey = group.path || "workflow";
      for (const unit of group.units || []) {
        const typeId = Array.isArray(unit) ? unit[0] : unit?.typeId || unit;
        const count = Array.isArray(unit) ? unit[1] : unit?.count || 1;
        if (!typeId) continue;
        for (let i = 0; i < count; i++) {
          this.spawnQueue.push({
            at: t,
            typeId,
            pathKey,
            distanceRatio: group.distanceRatio,
          });
          t += group.interval ?? (this.bcMode ? 0.55 : 0.9);
        }
      }
    }
    this.spawnQueue.sort((a, b) => a.at - b.at);
    this.status = this.bcMode
      ? `遠征 第 ${next + 1} 波：${wave.name}`
      : `第 ${next + 1} 波：${wave.name}`;
    this.sfx.play("waveStart");
    this.sfx.startBgm("battle");
    // 遠征：立刻刷一隻，玩家立刻看到敵人
    if (this.bcMode && this.spawnQueue.length) {
      const first = this.spawnQueue[0];
      if (first.at <= 0.05) {
        this.spawnQueue.shift();
        this._spawnEnemy(first.typeId, first.pathKey, {
          distanceRatio: first.distanceRatio,
        });
      }
    }
    this.ui?.onState?.(this.getPublicState());
    this.ui?.toast?.(
      isBossWave
        ? `⚠ ${wave.name}`
        : this.bcMode
          ? `敵軍來襲！第 ${next + 1}／${this.stage.waves.length} 波`
          : `第 ${next + 1} 波 — ${wave.name}`
    );
  }

  _spawnEnemy(typeId, pathKey, opts = {}) {
    const keys = Object.keys(this.pathMetricsMap);
    let pk = pathKey || "workflow";
    if (!this.pathMetricsMap[pk]) pk = keys[0];
    let metrics = this.pathMetricsMap[pk];
    // 遠征：path 異常時仍強制生成在右側
    if (!metrics) {
      if (this.bcMode && this.bc) {
        metrics = { total: 900, points: [] };
      } else {
        return null;
      }
    }
    let enemy;
    try {
      enemy = createEnemy(typeId, pk, metrics, {
        hpScale: this.stage.hpScale ?? 1,
        speedScale: this.stage.speedScale ?? 1,
        leakScale: this.stage.leakScale ?? 1,
        distanceRatio: this.bcMode ? 0 : opts.distanceRatio,
      });
    } catch (err) {
      console.warn("[spawn] unknown enemy", typeId, err);
      return null;
    }
    if (this.bcMode && this.bc) {
      placeEnemyOnBcLane(enemy, this.bc, this.enemies.length);
    }
    markEnemy(enemy.typeId); // 圖鑑：遇到就記 seen
    this.enemies.push(enemy);
    if (enemy.def.boss) {
      this.fx.push(createRing(enemy.x, enemy.y, enemy.def.color, { maxR: 70, life: 0.55 }));
      this.fx.push(createFloatText(enemy.x, enemy.y - 24, "BOSS", "#f9a8d4"));
      this.sfx.play("waveStart");
      if (this.bcMode) {
        this.ui?.toast?.(`⚠ Boss 登場：${enemy.def.nameZh || typeId}`);
      }
    }
    return enemy;
  }

  /** Resolve pendingSpawns from enemy abilities */
  _flushPendingSpawns(source) {
    if (!source.pendingSpawns?.length) return;
    const jobs = source.pendingSpawns.splice(0, source.pendingSpawns.length);
    const pathKeys = Object.keys(this.pathMetricsMap);
    for (const job of jobs) {
      let targets = [];
      if (job.pathMode === "alt") {
        const alt =
          source.pathKey === "workflow"
            ? pathKeys.find((k) => k !== "workflow") || source.pathKey
            : "workflow";
        targets = [this.pathMetricsMap[alt] ? alt : source.pathKey];
      } else if (job.pathMode === "both") {
        targets = pathKeys.length ? pathKeys : [source.pathKey];
      } else if (job.pathMode === "airdrop") {
        targets = [source.pathKey];
      } else {
        targets = [source.pathKey];
      }
      for (const pk of targets) {
        for (const [typeId, count] of job.units || []) {
          for (let i = 0; i < count; i++) {
            this._spawnEnemy(typeId, pk, {
              distanceRatio:
                job.distanceRatio != null
                  ? job.distanceRatio
                  : job.pathMode === "airdrop"
                    ? 0.5
                    : undefined,
            });
          }
        }
      }
    }
  }

  tryDeployAtPad(padIndex) {
    if (this.result || this.placingType == null || this.pausedForReward) return false;
    if (!this.loadout.includes(this.placingType)) {
      this.sfx.play("error");
      this.ui?.toast?.("此職業不在出戰名單");
      return false;
    }
    if (!canDeployJob(this.placingType)) {
      this.sfx.play("error");
      this.ui?.toast?.("此職業尚未解鎖或學會");
      return false;
    }
    if (this.padsOccupied.has(padIndex)) {
      this.sfx.play("error");
      this.ui?.toast?.("此格已有角色");
      return false;
    }
    if (this.specialists.length >= this.teamLimit) {
      this.sfx.play("error");
      this.ui?.toast?.("場上人數已滿");
      return false;
    }
    const level = getCardLevel(this.placingType);
    const def = buildLeveledDef(this.placingType, level);
    if (this.points < def.cost) {
      this.sfx.play("error");
      this.ui?.toast?.("部署點數不足");
      return false;
    }
    const pad = this.stage.map.pads[padIndex];
    const unit = createSpecialist(this.placingType, padIndex, pad, def);
    markJobUsed(this.placingType); // 圖鑑：部署過就收集
    this.specialists.push(unit);
    this.padsOccupied.set(padIndex, unit.id);
    this.points -= def.cost;
    this.selectedSpecialistId = unit.id;
    // Stay in placing mode so user can deploy multiple of same? Better: clear after one
    this.placingType = null;
    if (this.canvas) this.canvas.style.cursor = "crosshair";
    this.status = `已部署 ${def.nameZh} ★${level}`;
    this.sfx.play("deploy");
    this.fx.push(...createParticles(pad.x, pad.y, def.color, 12, { speed: 90, life: 0.4 }));
    this.fx.push(createRing(pad.x, pad.y, def.color, { maxR: 42, life: 0.3 }));
    this.ui?.onState?.(this.getPublicState());
    this.ui?.toast?.(`${def.nameZh} ★${level} 出戰！（−${def.cost}）`);
    return true;
  }

  selectSpecialistAt(x, y) {
    if (this.pausedForReward) return false;
    for (let i = this.specialists.length - 1; i >= 0; i--) {
      const s = this.specialists[i];
      if (Math.hypot(s.x - x, s.y - y) <= 20) {
        this.selectedSpecialistId = s.id;
        this.placingType = null;
        this.sfx.play("uiClick");
        this.ui?.onState?.(this.getPublicState());
        return true;
      }
    }
    return false;
  }

  sellSelected() {
    if (this.bcMode) {
      this.ui?.toast?.("遠征推線無法回收單位");
      return;
    }
    if (!this.selectedSpecialistId || this.result || this.pausedForReward) return;
    const idx = this.specialists.findIndex((s) => s.id === this.selectedSpecialistId);
    if (idx < 0) return;
    const s = this.specialists[idx];
    this.points += s.def.sellRefund;
    this.padsOccupied.delete(s.padIndex);
    this.fx.push(...createParticles(s.x, s.y, "#94a3b8", 8, { speed: 50 }));
    this.specialists.splice(idx, 1);
    this.selectedSpecialistId = null;
    this.status = `已回收 ${s.def.code}（+${s.def.sellRefund} pts）`;
    this.sfx.play("sell");
    this.ui?.onState?.(this.getPublicState());
  }

  /** 場上轉職 — 消耗局內楓幣（擊殺／清波賺） */
  tryJobChange(unitId, toJobId) {
    if (this.result || this.pausedForReward) return false;
    const unit = this.specialists.find((s) => s.id === unitId);
    if (!unit) {
      this.sfx.play("error");
      return false;
    }
    const fromId = unit.typeId;
    const check = canJobChange(fromId, toJobId);
    if (!check.ok) {
      this.sfx.play("error");
      this.ui?.toast?.(check.reason || "無法轉職");
      return false;
    }
    const cost = check.cost ?? getJobChangeCost(fromId, toJobId);
    if ((this.mesos || 0) < cost) {
      this.sfx.play("error");
      this.ui?.toast?.(
        `楓幣不足（需要 ${cost}，目前 ${this.mesos || 0}）— 多打怪、清波再轉`
      );
      return false;
    }
    this.mesos -= cost;
    const level = getCardLevel(toJobId);
    const def = buildLeveledDef(toJobId, level);
    if (!def) {
      this.mesos += cost; // refund
      this.sfx.play("error");
      return false;
    }
    unit.typeId = toJobId;
    unit.def = def;
    unit.cardLevel = level;
    unit.cooldown = 0;
    unit.attackT = 0;
    unit.lockTargetId = null;
    markJobLearned(toJobId);
    this.usedJobChange = true;
    this.sfx.play("jobChange");
    this.fx.push(...createParticles(unit.x, unit.y, def.color, 22, { speed: 120, life: 0.55 }));
    this.fx.push(createRing(unit.x, unit.y, "#fde68a", { maxR: 60, life: 0.5 }));
    this.fx.push(createRing(unit.x, unit.y, def.color, { maxR: 36, life: 0.35 }));
    this.fx.push(createFloatText(unit.x, unit.y - 28, `✦ 轉職 ${def.nameZh}`, "#fde68a"));
    this.fx.push(createFloatText(unit.x, unit.y - 44, def.skill || "", "#fff7ed"));
    this.fx.push(createBossBanner(`${def.nameZh} 轉職！`, def.color));
    this.status = `${SPECIALISTS[fromId]?.nameZh || fromId} → ${def.nameZh}！（🪙−${cost}）`;
    this.ui?.toast?.(`✦ 轉職成功！${def.nameZh}（🪙−${cost}）· ${def.skill || ""}`);
    this.ui?.onState?.(this.getPublicState());
    return true;
  }

  getJobChangeOptions(unitId) {
    const unit = this.specialists.find((s) => s.id === unitId);
    if (!unit) return [];
    const mesos = this.mesos || 0;
    return getNextJobIds(unit.typeId).map((toId) => {
      const check = canJobChange(unit.typeId, toId);
      const cost = getJobChangeCost(unit.typeId, toId);
      const def = SPECIALISTS[toId];
      const needMore = Math.max(0, cost - mesos);
      return {
        id: toId,
        nameZh: def?.nameZh || toId,
        skill: def?.skill || "",
        tier: def?.jobTier ?? 4,
        cost,
        ok: check.ok && mesos >= cost,
        reason: !check.ok
          ? check.reason
          : mesos < cost
            ? `還差 ${needMore} 楓幣（多打怪）`
            : "",
        color: def?.color || "#888",
      };
    });
  }

  pickReward(itemId) {
    if (!this.pausedForReward || !this.pendingRewardChoices) return;
    if (!this.pendingRewardChoices.includes(itemId)) return;
    const item = getItem(itemId);
    if (!item) return;
    const msg = item.apply(this);
    this.pickedItems.push(itemId);
    this.pausedForReward = false;
    this.pendingRewardChoices = null;
    this.sfx.play("waveClear");
    this.status = `獲得 ${item.nameZh}：${msg}`;
    this.ui?.toast?.(`${item.icon} ${item.nameZh} — ${msg}`);
    this.ui?.onRewardClosed?.();
    this.ui?.onState?.(this.getPublicState());
  }

  _offerRewardsIfAny() {
    const choices = this.stage.waveRewards?.[this.waveIndex];
    if (!choices || !choices.length) return false;
    this.pausedForReward = true;
    this.pendingRewardChoices = [...choices];
    this.status = "選擇一項辦公道具";
    this.ui?.onRewardOffer?.(choices.map((id) => getItem(id)).filter(Boolean));
    this.ui?.onState?.(this.getPublicState());
    return true;
  }

  _onWaveCleared() {
    this.waveActive = false;
    // Soft town theme between waves (not silence)
    this.sfx.startBgm("menu");
    const stageIndex = this.stage.index ?? 0;
    const leafGain = rewardForWaveClear(this.waveIndex, stageIndex);
    addMapleLeaves(leafGain, "wave");
    // 局內楓幣：清波大筆收入（轉職用）
    const mesoWave = mesosForWaveClear(this.waveIndex, stageIndex);
    this.addMesos(mesoWave, { silent: true });
    const bonus = this.stage.waveClearBonus?.[this.waveIndex] ?? 0;
    if (bonus > 0) {
      this.points += bonus;
      this.ui?.toast?.(
        this.bcMode
          ? `波次完成 · 錢包+${bonus} · 🍁+${leafGain}`
          : `波次完成 · 🪙+${mesoWave} 楓幣 · +${bonus} 部署 · 🍁+${leafGain}`
      );
    } else {
      this.ui?.toast?.(
        this.bcMode ? `波次完成 · 🍁+${leafGain}` : `波次完成 · 🪙+${mesoWave} 楓幣 · 🍁+${leafGain}`
      );
    }

    // reset crit meso cap each wave
    this.waveMesoFromCrit = 0;

    // BC 最終波：必須推倒敵方基地
    if (
      this.bcMode &&
      this.bc &&
      this.waveIndex >= this.stage.waves.length - 1 &&
      this.bc.enemyCastleHp > 0
    ) {
      this.bc.siege = true;
      this.status = "總攻！推倒敵方基地！";
      this.ui?.toast?.("總攻！點卡出兵，拆掉敵方基地");
      this.ui?.onState?.(this.getPublicState());
      return;
    }

    if (this.waveIndex >= this.stage.waves.length - 1) {
      this.result = "win";
      this.status = this.stage.arena
        ? "遠征勝利！分數已記入排行。"
        : "神木平安！關卡完成。";
      this.sfx.play("win");
      const isArena = !!this.stage.arena;
      let firstClear = false;
      let winLeaves = 0;
      let evalS = null;
      if (!isArena) {
        const prev = loadStageProgress();
        firstClear = !prev.cleared?.[this.stage.id];
        markStageCleared(this.stage.id);
        winLeaves = rewardForStageWin(stageIndex, firstClear);
        addMapleLeaves(winLeaves, "stage");
        evalS = evaluateStars({
          stageId: this.stage.id,
          coreHp: this.coreHp,
          coreMax: this.coreMax,
          leaks: this.leaks || 0,
          usedJobChange: this.usedJobChange,
        });
        const starClaim = claimStageStars(this.stage.id, evalS.count);
        if (starClaim.gained > 0) {
          addMapleLeaves(starClaim.gained * 15, "stars");
        }
        this.lastStars = evalS;
      } else {
        // 競賽通關給固定楓葉
        winLeaves = 25;
        addMapleLeaves(winLeaves, "arena");
        this.lastStars = null;
      }
      // 排行分數
      const score = computeClearScore({
        coreHp: this.coreHp,
        coreMax: this.coreMax,
        mesos: this.mesosEarned || this.mesos || 0,
        leaks: this.leaks || 0,
        usedJobChange: this.usedJobChange,
        waveTotal: this.stage.waves.length,
        stageIndex: isArena ? 12 : stageIndex,
        bossKill: true,
      });
      this.lastScore = score;
      const nick = getNickname() || "冒險者";
      if (isArena) {
        const bossId = this.stage.arenaBossId;
        const bossName = BOSSES[bossId]?.nameZh || this.stage.name;
        submitArenaScore({
          nick,
          score,
          bossId,
          bossName,
          coreHp: this.coreHp,
          leaks: this.leaks || 0,
        });
        this.ui?.toast?.(`競賽通關 · ${bossName} · 分數 ${score} · 🍁+${winLeaves}`);
      } else {
        submitStageScore(this.stage.id, {
          nick,
          score,
          stars: evalS?.count || 0,
          coreHp: this.coreHp,
          leaks: this.leaks || 0,
        });
        this.ui?.toast?.(
          `通關 🍁+${winLeaves}${firstClear ? "（首通）" : ""} · ★${evalS?.count || 0} · 分數 ${score}`
        );
      }
      const core = this.stage.map.core;
      this.fx.push(...createParticles(core.x, core.y, "#4ade80", 28, { speed: 140, life: 0.8 }));
      this.fx.push(createRing(core.x, core.y, "#22d3ee", { maxR: 80, life: 0.6 }));
      this.ui?.onResult?.("win");
      return;
    }

    // mid-wave item pick
    if (this._offerRewardsIfAny()) {
      this.sfx.play("waveClear");
      return;
    }

    this.sfx.play("waveClear");
    this.status = `Wave ${this.waveIndex + 1} 完成 — 可繼續部署後 Start Wave`;
  }

  update(dt, rawDt = dt) {
    this.fx = updateFx(this.fx, rawDt);
    if (this.coreHitFlash > 0) {
      this.coreHitFlash = Math.max(0, this.coreHitFlash - rawDt);
    }

    // Freeze combat on result/reward — do NOT thrash full UI re-renders (breaks clicks).
    if (this.result) return;
    /* ⚠️ 手動暫停原本只是把 dt 設成 0，整個 update 照跑：spawn 迴圈、敵人迴圈、
       O(職業數×敵人數) 的選目標、投射物迴圈全部繼續執行；而且因為 s.cooldown 不再
       遞減，暫停瞬間 cooldown 剛好歸零的職業會在暫停中射出一發並結算傷害與楓幣。
       暫停就該真的停下來。 */
    if (this.paused) return;
    if (this.pausedForReward) {
      if (!this._uiAcc) this._uiAcc = 0;
      this._uiAcc += rawDt;
      if (this._uiAcc > 0.25) {
        this._uiAcc = 0;
        this.ui?.onState?.(this.getPublicState());
      }
      return;
    }

    this.now += dt;
    if (!this.bcMode) {
      tickHazards(this.hazardState, dt);
      tickPortalCd(this.hazardState, dt);
    }

    // BC：錢包回復 + 出兵 CD
    if (this.bcMode && this.bc) {
      this.points = tickBcWallet(this.bc, this.points, dt);
      tickBcSpawnCd(this.bc, dt);
    }

    const corePos = this.stage.map.core;
    const syn = this._synergyBuffs();
    const stallZones = this.bcMode ? [] : this._stallZones();
    const auraAtk = this._allyAuraAtk();
    const auras = this.enemies
      .filter((e) => e.alive && e.def.hasteAura)
      .map((e) => ({
        id: e.id,
        x: e.x,
        y: e.y,
        r: e.def.hasteRadius || 90,
        power: e.def.hasteAura || 0,
      }));

    if (this.waveActive) {
      this.elapsed += dt;
      while (this.spawnQueue.length && this.spawnQueue[0].at <= this.elapsed) {
        const job = this.spawnQueue.shift();
        this._spawnEnemy(job.typeId, job.pathKey, {
          distanceRatio: job.distanceRatio,
        });
      }
    }

    // snapshot because list grows from summons
    const alliesAlive = this.specialists.filter((s) => s.alive !== false && !s._bcDead);
    const list = this.enemies.slice();
    for (const e of list) {
      if (!e.alive && !e.pendingSpawns?.length) continue;
      if (e.alive) {
        if (this.bcMode && this.bc) {
          // 遠征：專用左右推線物理（不走 path 取樣）
          e.animTime = (e.animTime || 0) + dt;
          if (e.hitFlash > 0) e.hitFlash = Math.max(0, e.hitFlash - dt);
          if (e.status?.burnUntil > this.now) {
            e.hp -= (e.status.burnDps || 0) * dt;
            if (e.hp <= 0) e.alive = false;
          }
          // Boss 招式仍走原系統（位置在推線上即可）
          if (e.def.boss && e.alive) {
            e.bossEvents = tickBossAttacks(e, dt, this.now);
          } else {
            e.bossEvents = [];
          }
          if (e.alive) {
            const bcRes = updateBcEnemy(e, dt, alliesAlive, this.bc);
            if (bcRes.hitPlayerBase > 0 || e.leaked) {
              e.leaked = true;
            }
          }
        } else {
          const hz = sampleHazardOnEnemy(this.hazardState, e, dt, this.stage.map);
          e.status.hazardSpeedMul = hz.speedMul;
          e.status.noSlow = hz.noSlow;
          tryPortalJump(this.hazardState, e);
          updateEnemy(e, dt, this.now, {
            buffs: {
              coreSlowRadius: this.buffs.coreSlowRadius,
              coreSlowPower: this.buffs.coreSlowPower,
              corePos,
            },
            pathMetricsMap: this.pathMetricsMap,
            auras,
            stallZones,
            hazardExtraDist: hz.extraDist,
          });
        }
        if (e._pendingBanner) {
          this.fx.push(createBossBanner(e._pendingBanner, e.def.color));
          this.sfx.playBoss("phase", { bossId: e.def.id || e.typeId });
          this.ui?.toast?.(e._pendingBanner);
          e._pendingBanner = null;
        }
        // Boss 攻擊事件
        if (e.bossEvents?.length) {
          for (const ev of e.bossEvents) {
            if (ev.kind === "bossTelegraph") {
              this.fx.push(createBossBanner(ev.text, e.def.color));
              this.sfx.playBoss("telegraph", {
                bossId: e.def.id || e.typeId,
                skillId: ev.skill?.id,
                skillType: ev.skill?.type,
                skillName: ev.skill?.name,
              });
            } else if (ev.kind === "bossCast") {
              applyBossCast(this, ev);
            }
          }
          e.bossEvents = [];
        }
      }
      if (e.pendingSpawns?.length) {
        this._flushPendingSpawns(e);
      }
      if (e.leaked) {
        let dmg = e.def.leakDamage || 1;
        this.leaks = (this.leaks || 0) + 1;
        if (this.buffs.coreShield > 0) {
          this.buffs.coreShield -= 1;
          dmg = 0;
          this.fx.push(createFloatText(corePos.x, corePos.y - 36, "BLOCK", "#67e8f9"));
          this.sfx.play("hit");
        } else {
          this.coreHp = Math.max(0, this.coreHp - dmg);
          this.coreHitFlash = 0.55;
          this.sfx.play("leak");
          this.fx.push(
            ...createParticles(corePos.x, corePos.y, "#fb7185", 14, { speed: 100, life: 0.5 })
          );
          this.fx.push(createFloatText(corePos.x, corePos.y - 30, `-${dmg}`, "#fecdd3"));
          this.ui?.onCoreHit?.(dmg);
        }
        e.leaked = false;
      }
    }

    const enemiesById = new Map(this.enemies.map((e) => [e.id, e]));
    for (const s of this.specialists) {
      if (s._bcDead || s.alive === false) continue;
      updateSpecialist(s, dt);
      if (this.bcMode && this.bc) {
        const canSiege =
          this.bc.siege || this.waveIndex >= this.stage.waves.length - 1;
        const moved = updateBcSpecialist(s, dt, this.enemies, this.bc);
        // 未進入 Boss 波前，在敵方門前停下、不拆塔
        if (!canSiege && s.x > this.bc.enemyBase.x - 120) {
          s.x = Math.min(s.x, this.bc.enemyBase.x - 120);
        } else if (canSiege && moved.castleHits > 0) {
          const down = damageEnemyCastle(this.bc, moved.castleHits);
          this.fx.push(
            createFloatText(
              this.bc.enemyBase.x,
              this.bc.enemyBase.y - 30,
              `-${moved.castleHits}`,
              "#fde68a"
            )
          );
          if (down) {
            this._winBcSiege();
            return;
          }
        }
      }
      if (s.cooldown > 0) continue;
      // Boss 暈眩／沉默：無法出手
      if (isSpecialistDisabled(s, this.now)) continue;
      const target = this._pickTarget(s);
      if (!target) continue;
      const shots = fireSpecialist(s, target);
      s.cooldown = s.def.interval / (syn.attackSpeedMult || 1);
      // 遠征近戰加速一點
      if (this.bcMode) s.cooldown = Math.min(s.cooldown, Math.max(0.35, s.def.interval * 0.75));
      this.projectiles.push(...shots);
      this.fx.push(...buildShootVfx(s));
      const skill = getJobSkill(s.typeId) || {};
      this.sfx.playShoot(s.def.family, {
        pierce: !!skill.pierce,
        multi: (skill.multiShot || 0) > 1,
        lockOn: !!skill.lockOn,
        fire: !!skill.burnStacks,
        ice: !!skill.slowChain,
        crit: !!skill.critChance,
      });
    }
    // 清掉遠征陣亡單位
    if (this.bcMode) {
      this.specialists = this.specialists.filter((s) => !s._bcDead && s.alive !== false);
    }

    for (const p of this.projectiles) {
      updateProjectile(p, dt, enemiesById);
      if (p.hit) {
        // 用 _hitTargetId（這一擊真正命中的怪），不是 targetId —— 穿透彈可能已改瞄準下一隻
        const target = enemiesById.get(p._hitTargetId || p.targetId);
        if (target) {
          const wasBoss = !!target.def.boss;
          const owner = this.specialists.find((s) => s.id === p.ownerId);
          const skill = p.skill || getJobSkill(owner?.typeId);
          const hitBuffs = {
            damageMult: (syn.damageMult || 1) * (1 + auraAtk),
            armorBreak:
              (syn.armorBreak || 0) + (owner?.def?.armorBreakBonus || 0),
          };
          const killed = applyHit(target, p, this.now, hitBuffs, {
            allies: this.specialists,
            owner,
          });
          this.sfx.playHit({
            heavy: wasBoss || p._wasCrit,
            crit: p._wasCrit,
            family: owner?.def?.family,
            effect: p.effect,
            fire: p.effect === "burn" || skill.burnStacks,
            ice: p.effect === "slow" || skill.slowChain,
            holy: p.effect === "analyzed" || skill.revealOnHit,
          });
          this.fx.push(...buildHitVfx(target, p, owner));
          // splash
          // ⚠️ 原本濺射直接 `e.hp -= …`，完全繞過 applyHit 的 boss 免疫、護甲、
          //    reviveOnce、splitOnDeath —— 會復活的怪被濺死就不復活、會分裂的不分裂、
          //    Boss 在物理無效期間照樣被濺射打死。改成走 applyHit（帶 splashMult）。
          if (p.splashR > 0) {
            const splashHitBuffs = { ...hitBuffs, splashMult: p.splashMult || 0.4 };
            for (const e of this.enemies) {
              if (!e.alive || e.id === target.id) continue;
              if (Math.hypot(e.x - target.x, e.y - target.y) <= p.splashR) {
                const splashKilled = applyHit(e, p, this.now, splashHitBuffs, {
                  allies: this.specialists,
                  owner,
                  splash: true,
                });
                e.hitFlash = 0.1;
                if (splashKilled) this.addMesos(mesosForKill(e.def), { x: e.x, y: e.y });
              }
            }
          }
          // slow chain same path
          if (skill.slowChain && target.pathKey) {
            const same = this.enemies
              .filter(
                (e) =>
                  e.alive &&
                  e.pathKey === target.pathKey &&
                  e.id !== target.id &&
                  e.distance < target.distance
              )
              .sort((a, b) => b.distance - a.distance)
              .slice(0, skill.slowChain);
            for (const e of same) {
              e.status.slowUntil = this.now + 1.2;
              e.status.slowPower = Math.min(
                e.status.slowPower || 1,
                skill.slowChainPower || 0.72
              );
            }
          }
          this.fx.push(
            ...createParticles(target.x, target.y, p.color, wasBoss ? 10 : 5, {
              speed: wasBoss ? 80 : 50,
              size: wasBoss ? 4 : 2.5,
            })
          );
          if (killed) {
            markEnemy(target.typeId, { killed: true }); // 圖鑑：擊殺
            if (owner) owner.kills += 1;
            this.sfx.play("kill", { boss: wasBoss, family: owner?.def?.family });
            if (wasBoss) {
              this.fx.push(createBossBanner(`${target.def.nameZh} 擊破！`, target.def.color));
              this.sfx.playBoss("kill", { bossId: target.def.id || target.typeId });
            }
            let mesoGain = mesosForKill(target.def);
            if (p._mesoBonus) {
              const cap = skill.mesoCapPerWave || 40;
              const bonus = Math.floor(mesoGain * p._mesoBonus);
              const used = this.waveMesoFromCrit || 0;
              if (used < cap) {
                mesoGain += Math.min(bonus, cap - used);
                this.waveMesoFromCrit = used + bonus;
              }
            }
            this.addMesos(mesoGain, { x: target.x, y: target.y, silent: false });
            // kill lifesteal visual
            if (p._lifesteal && owner) {
              this.fx.push(createFloatText(owner.x, owner.y - 24, "吸血", "#86efac"));
            }
            this.fx.push(...createParticles(target.x, target.y, target.def.color, 16, { speed: 110 }));
            this.fx.push(createRing(target.x, target.y, target.def.color, { maxR: 30 }));
            if (wasBoss) {
              this.fx.push(createFloatText(target.x, target.y - 16, "CLEARED", "#f9a8d4"));
              // BC：擊殺 Boss 重創敵方基地
              if (this.bcMode && this.bc) {
                const chunk = Math.round(this.bc.enemyCastleMax * 0.28);
                if (damageEnemyCastle(this.bc, chunk)) {
                  this._winBcSiege();
                  return;
                }
                this.fx.push(
                  createFloatText(
                    this.bc.enemyBase.x,
                    this.bc.enemyBase.y - 50,
                    `基地 -${chunk}`,
                    "#f9a8d4"
                  )
                );
              }
            }
            if (target.pendingSpawns?.length) this._flushPendingSpawns(target);
          }
        }
        p.hit = false;
        // 這一擊已結算完 → 現在才對「下一次穿透命中」套用衰減，並改瞄準下一個目標
        // （retarget 延到這裡是為了讓上面能用 _hitTargetId 拿到正確的命中目標）
        if (p._pierceContinue) {
          p._pierceContinue = false;
          if (p._applyFalloffAfterHit) {
            p._applyFalloffAfterHit = false;
            p.damage *= p.pierceFalloff || 0.7;
          }
          if (!retargetPierce(p, enemiesById)) p.alive = false;
        } else {
          p._applyFalloffAfterHit = false;
        }
      }
    }

    // keep dead enemies one frame if they still have pending spawns
    this.enemies = this.enemies.filter(
      (e) => e.alive || (e.pendingSpawns && e.pendingSpawns.length)
    );
    // clear fully processed corpses
    for (const e of this.enemies) {
      if (!e.alive && e.pendingSpawns) this._flushPendingSpawns(e);
    }
    this.enemies = this.enemies.filter((e) => e.alive);
    this.projectiles = this.projectiles.filter((p) => p.alive);

    if (this.waveActive && this.spawnQueue.length === 0 && this.enemies.length === 0) {
      this._onWaveCleared();
    }

    // BC 總攻：無怪且基地仍在 → 繼續拆塔（單位仍更新於上方）
    if (
      this.bcMode &&
      this.bc?.siege &&
      !this.waveActive &&
      this.enemies.length === 0 &&
      this.bc.enemyCastleHp <= 0
    ) {
      this._winBcSiege();
      return;
    }

    if (this.coreHp <= 0) {
      this.coreHp = 0;
      this.result = "lose";
      this.waveActive = false;
      this.sfx.stopBgm();
      this.status = this.bcMode ? "我方基地陷落…" : "神木倒下了…";
      this.sfx.play("lose");
      const consolation = failConsolationLeaves(
        this.waveIndex,
        this.stage.waves.length,
        this.stage.index ?? 0
      );
      if (consolation > 0) {
        addMapleLeaves(consolation, "fail");
        this.ui?.toast?.(`失敗安慰 🍁+${consolation}（再接再厲）`);
      }
      this.fx.push(...createParticles(corePos.x, corePos.y, "#fb7185", 30, { speed: 150, life: 0.9 }));
      this.ui?.onResult?.("lose");
    }

    if (!this._uiAcc) this._uiAcc = 0;
    this._uiAcc += dt;
    if (this._uiAcc > 0.1) {
      this._uiAcc = 0;
      this.ui?.onState?.(this.getPublicState());
    }
  }

  _pickTarget(specialist) {
    const skill = getJobSkill(specialist.typeId);
    // lock-on stickiness
    if (skill.lockOn && specialist.lockTargetId) {
      const locked = this.enemies.find((e) => e.id === specialist.lockTargetId);
      if (locked && isTargetable(locked, specialist, this.now)) return locked;
      specialist.lockTargetId = null;
    }
    let best = null;
    let bestScore = -Infinity;
    for (const e of this.enemies) {
      if (!isTargetable(e, specialist, this.now)) continue;
      const score = scoreTarget(e, specialist, this.now);
      if (score > bestScore) {
        bestScore = score;
        best = e;
      }
    }
    if (best && skill.lockOn) specialist.lockTargetId = best.id;
    return best;
  }

  _synergyBuffs() {
    const syn = computeSynergies(this.specialists);
    return {
      attackSpeedMult: (this.buffs.attackSpeedMult || 1) * (syn.attackSpeedMult || 1),
      damageMult: (this.buffs.damageMult || 1) * (syn.damageMult || 1),
      armorBreak: (this.buffs.armorBreak || 0) + (syn.armorBreak || 0),
      coreShield: this.buffs.coreShield || 0,
      coreSlowRadius: this.buffs.coreSlowRadius || 0,
      coreSlowPower: this.buffs.coreSlowPower || 0.55,
      synergyLabels: syn.labels || [],
    };
  }

  _stallZones() {
    const zones = [];
    for (const s of this.specialists) {
      const sk = getJobSkill(s.typeId);
      if (sk.stallRadius) {
        zones.push({ x: s.x, y: s.y, r: sk.stallRadius, mul: sk.stallMul || 0.85 });
      }
    }
    return zones;
  }

  _allyAuraAtk() {
    let bonus = 0;
    for (const s of this.specialists) {
      const sk = getJobSkill(s.typeId);
      if (sk.auraAtk) bonus = Math.max(bonus, sk.auraAtk);
    }
    return bonus;
  }

  render() {
    // draw core slow aura via buffs for render
    drawScene(this.ctx, {
      stage: this.stage,
      pathMap: this.pathMap,
      enemies: this.enemies,
      specialists: this.specialists,
      projectiles: this.projectiles,
      fx: this.fx,
      hoverPad: this.hoverPad,
      padsOccupied: this.padsOccupied,
      coreHp: this.coreHp,
      coreMax: this.coreMax,
      selectedSpecialistId: this.selectedSpecialistId,
      placingType: this.placingType,
      placingDef: this.placingType ? SPECIALISTS[this.placingType] : null,
      now: this.now,
      buffs: this.buffs,
      hazardState: this.bcMode ? null : this.hazardState,
      mapTheme: themeForStage(this.stage),
      bcMode: !!this.bcMode,
      bc: this.bc,
    });
  }

  /** Client (viewport) coords → canvas world coords. */
  clientToWorld(clientX, clientY) {
    const rect = this.canvas.getBoundingClientRect();
    const rw = Math.max(1, rect.width);
    const rh = Math.max(1, rect.height);
    return {
      x: (clientX - rect.left) * (this.canvas.width / rw),
      y: (clientY - rect.top) * (this.canvas.height / rh),
      inside:
        clientX >= rect.left &&
        clientX <= rect.right &&
        clientY >= rect.top &&
        clientY <= rect.bottom,
    };
  }

  /** Nearest free pad within maxDist, or any pad for hover. */
  findPadAt(x, y, { freeOnly = false, maxDist = 48 } = {}) {
    const pads = this.stage?.map?.pads || [];
    let best = null;
    let bestD = maxDist;
    for (let i = 0; i < pads.length; i++) {
      if (freeOnly && this.padsOccupied.has(i)) continue;
      const p = pads[i];
      const d = Math.hypot(p.x - x, p.y - y);
      if (d <= bestD) {
        bestD = d;
        best = i;
      }
    }
    return best;
  }

  /** Update hover pad from client pointer (used while dragging from UI cards). */
  updateHoverFromClient(clientX, clientY, { maxDist = 72 } = {}) {
    const { x, y, inside } = this.clientToWorld(clientX, clientY);
    if (!inside) {
      this.hoverPad = null;
      return null;
    }
    this.hoverPad = this.findPadAt(x, y, { freeOnly: false, maxDist });
    return this.hoverPad;
  }

  /**
   * Drop a job at client coordinates (drag-and-drop deploy).
   * @returns {boolean}
   */
  tryDeployAtClient(typeId, clientX, clientY) {
    if (this.result || this.pausedForReward) return false;
    if (!typeId || !this.loadout.includes(typeId)) {
      this.sfx.play("error");
      this.ui?.toast?.("此職業不在出戰名單");
      return false;
    }
    const prev = this.placingType;
    this.placingType = typeId;
    const { x, y, inside } = this.clientToWorld(clientX, clientY);
    if (!inside) {
      this.placingType = prev;
      this.sfx.play("error");
      this.ui?.toast?.("請拖到地圖上的綠色「+」格");
      return false;
    }
    let pad = this.findPadAt(x, y, { freeOnly: true, maxDist: 80 });
    if (pad == null) pad = this.findPadAt(x, y, { freeOnly: false, maxDist: 64 });
    if (pad == null) {
      this.placingType = prev;
      this.sfx.play("error");
      this.ui?.toast?.("請拖到綠色部署格附近鬆手");
      this.hoverPad = null;
      this.ui?.onState?.(this.getPublicState());
      return false;
    }
    const ok = this.tryDeployAtPad(pad);
    if (!ok) this.placingType = prev;
    return ok;
  }

  /** Deploy selected job on first free pad (mobile-friendly shortcut). */
  tryDeployAuto() {
    if (!this.placingType) {
      this.ui?.toast?.("先點右側職業卡，再點綠格或再點一次卡自動放");
      return false;
    }
    const pads = this.stage?.map?.pads || [];
    for (let i = 0; i < pads.length; i++) {
      if (!this.padsOccupied.has(i)) {
        return this.tryDeployAtPad(i);
      }
    }
    this.sfx.play("error");
    this.ui?.toast?.("沒有空的部署格了");
    return false;
  }

  _bindInput() {
    this.canvas.addEventListener("pointermove", (evt) => {
      if (this._externalDrag) return; // card-drag owns hover
      const { x, y } = this.clientToWorld(evt.clientX, evt.clientY);
      const maxDist = this.placingType ? 56 : 40;
      this.hoverPad = this.findPadAt(x, y, { freeOnly: false, maxDist });
    });

    this.canvas.addEventListener("pointerleave", () => {
      if (this._externalDrag) return;
      this.hoverPad = null;
    });

    this.canvas.addEventListener("pointerdown", (evt) => {
      void this.sfx.unlock();
      if (this.pausedForReward || this.result || this.paused) return;
      const { x, y } = this.clientToWorld(evt.clientX, evt.clientY);

      if (this.placingType) {
        // 手機／點選模式：加大吸附距離
        let pad = this.findPadAt(x, y, { freeOnly: true, maxDist: 96 });
        if (pad == null) pad = this.findPadAt(x, y, { freeOnly: false, maxDist: 72 });
        if (pad != null) {
          this.tryDeployAtPad(pad);
          return;
        }
        // 點空地 = 取消部署（比一直 error 更友善）
        this.setPlacing(null);
        this.ui?.toast?.("已取消部署");
        return;
      }

      if (!this.selectSpecialistAt(x, y)) {
        this.selectedSpecialistId = null;
        this.ui?.onState?.(this.getPublicState());
      }
    });
  }
}

export {
  SPECIALISTS,
  SPECIALIST_ORDER,
  DEFAULT_LOADOUT,
  LOADOUT_MAX,
};
