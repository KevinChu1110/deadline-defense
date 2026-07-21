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
  isTargetable,
  applyHit,
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

  loadStage(stageId) {
    this.stageId = stageId;
    this.stage = structuredClone(getStageById(stageId));
    const built = buildPathMap(this.stage);
    this.pathMap = built.paths;
    this.pathMetricsMap = built.metrics;
    this.reset();
  }

  setLoadout(ids) {
    const clean = [];
    for (const id of ids || []) {
      if (
        SPECIALISTS[id] &&
        !clean.includes(id) &&
        clean.length < LOADOUT_MAX &&
        canDeployJob(id)
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
    this.pausedForReward = false;
    this.pendingRewardChoices = null;
    this.buffs = defaultBuffs();
    this.pickedItems = [];
    this.status = "Ready — 部署初心者、清怪賺楓幣，再場上轉職";
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
      // freeze combat while reward modal open, still allow tiny fx
      const dt = this.pausedForReward ? 0 : rawDt * this.speed;
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
      canStartWave:
        !this.waveActive &&
        !this.pausedForReward &&
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
      jobChangeOptions: this.selectedSpecialistId
        ? this.getJobChangeOptions(this.selectedSpecialistId)
        : [],
    };
  }

  /** Deploy cost for current card level */
  getDeployCost(typeId) {
    const def = buildLeveledDef(typeId, getCardLevel(typeId));
    return def?.cost ?? SPECIALISTS[typeId]?.cost ?? 99;
  }

  setPlacing(typeId) {
    if (this.result || this.pausedForReward) return;
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
    this.speed = this.speed === 1 ? 2 : this.speed === 2 ? 3 : 1;
    this.sfx.play("uiClick");
    this.ui?.onState?.(this.getPublicState());
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
    const next = this.waveIndex + 1;
    if (next >= this.stage.waves.length) return;

    this.waveIndex = next;
    const wave = this.stage.waves[next];
    this.waveActive = true;
    this.spawnQueue = [];
    this.elapsed = 0;

    const isBossWave = next === 4 || next === 9 || /Boss|BOSS|boss/.test(wave.name);
    for (const group of wave.groups) {
      let t = group.at;
      const pathKey = group.path || "workflow";
      for (const [typeId, count] of group.units) {
        for (let i = 0; i < count; i++) {
          this.spawnQueue.push({
            at: t,
            typeId,
            pathKey,
            distanceRatio: group.distanceRatio,
          });
          t += group.interval ?? 0.9;
        }
      }
    }
    this.spawnQueue.sort((a, b) => a.at - b.at);
    this.status = `第 ${next + 1} 波：${wave.name}`;
    this.sfx.play("waveStart");
    this.sfx.startBgm("battle");
    this.ui?.onState?.(this.getPublicState());
    this.ui?.toast?.(
      isBossWave ? `⚠ ${wave.name}` : `第 ${next + 1} 波 — ${wave.name}`
    );
  }

  _spawnEnemy(typeId, pathKey, opts = {}) {
    const keys = Object.keys(this.pathMetricsMap);
    let pk = pathKey || "workflow";
    if (!this.pathMetricsMap[pk]) pk = keys[0];
    const metrics = this.pathMetricsMap[pk];
    if (!metrics) return null;
    const enemy = createEnemy(typeId, pk, metrics, {
      hpScale: this.stage.hpScale ?? 1,
      speedScale: this.stage.speedScale ?? 1,
      leakScale: this.stage.leakScale ?? 1,
      distanceRatio: opts.distanceRatio,
    });
    this.enemies.push(enemy);
    if (enemy.def.boss) {
      this.fx.push(createRing(enemy.x, enemy.y, enemy.def.color, { maxR: 70, life: 0.55 }));
      this.fx.push(createFloatText(enemy.x, enemy.y - 24, "BOSS", "#f9a8d4"));
      this.sfx.play("waveStart");
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
    markJobLearned(toJobId);
    this.sfx.play("waveClear");
    this.fx.push(...createParticles(unit.x, unit.y, def.color, 18, { speed: 100, life: 0.5 }));
    this.fx.push(createRing(unit.x, unit.y, def.color, { maxR: 50, life: 0.4 }));
    this.fx.push(createFloatText(unit.x, unit.y - 28, `轉職 ${def.nameZh}`, "#fde68a"));
    this.status = `${SPECIALISTS[fromId]?.nameZh || fromId} → ${def.nameZh}！（🪙−${cost}）`;
    this.ui?.toast?.(`轉職成功！${def.nameZh}（🪙−${cost} 楓幣）`);
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
        `波次完成 · 🪙+${mesoWave} 楓幣 · +${bonus} 部署 · 🍁+${leafGain}`
      );
    } else {
      this.ui?.toast?.(`波次完成 · 🪙+${mesoWave} 楓幣 · 🍁+${leafGain}`);
    }

    if (this.waveIndex >= this.stage.waves.length - 1) {
      this.result = "win";
      this.status = "神木平安！關卡完成。";
      this.sfx.play("win");
      const prev = loadStageProgress();
      const firstClear = !prev.cleared?.[this.stage.id];
      markStageCleared(this.stage.id);
      const winLeaves = rewardForStageWin(stageIndex, firstClear);
      addMapleLeaves(winLeaves, "stage");
      this.ui?.toast?.(`通關獎勵 🍁+${winLeaves}${firstClear ? "（首通）" : ""}`);
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

    // Freeze combat on result/reward — do NOT thrash full UI re-renders (breaks clicks).
    if (this.result) return;
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

    const corePos = this.stage.map.core;
    const auras = this.enemies
      .filter((e) => e.alive && e.def.hasteAura)
      .map((e) => ({
        id: e.id,
        x: e.x,
        y: e.y,
        r: e.def.hasteRadius || 90,
        power: e.def.hasteAura || 0,
      }));
    const enemyBuffCtx = {
      buffs: {
        coreSlowRadius: this.buffs.coreSlowRadius,
        coreSlowPower: this.buffs.coreSlowPower,
        corePos,
      },
      pathMetricsMap: this.pathMetricsMap,
      auras,
    };

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
    const list = this.enemies.slice();
    for (const e of list) {
      if (!e.alive && !e.pendingSpawns?.length) continue;
      if (e.alive) {
        updateEnemy(e, dt, this.now, enemyBuffCtx);
      }
      if (e.pendingSpawns?.length) {
        this._flushPendingSpawns(e);
      }
      if (e.leaked) {
        let dmg = e.def.leakDamage || 1;
        if (this.buffs.coreShield > 0) {
          this.buffs.coreShield -= 1;
          dmg = 0;
          this.fx.push(createFloatText(corePos.x, corePos.y - 36, "BLOCK", "#67e8f9"));
          this.sfx.play("hit");
        } else {
          this.coreHp = Math.max(0, this.coreHp - dmg);
          this.sfx.play("leak");
          this.fx.push(
            ...createParticles(corePos.x, corePos.y, "#fb7185", 14, { speed: 100, life: 0.5 })
          );
          this.fx.push(createFloatText(corePos.x, corePos.y - 30, `-${dmg}`, "#fecdd3"));
        }
        e.leaked = false;
      }
    }

    const enemiesById = new Map(this.enemies.map((e) => [e.id, e]));
    for (const s of this.specialists) {
      updateSpecialist(s, dt);
      // scale cooldown recovery already applied in fire; re-apply attack speed on interval
      if (s.cooldown > 0) continue;
      const target = this._pickTarget(s);
      if (!target) continue;
      const shots = fireSpecialist(s, target);
      // attack-speed buff shortens next cooldown
      s.cooldown = s.def.interval / (this.buffs.attackSpeedMult || 1);
      this.projectiles.push(...shots);
      this.fx.push(createMuzzle(s.x + (s.facing || 1) * 8, s.y - 6, s.def.color));
      // small slash VFX at attacker
      this.fx.push(
        createRing(s.x + (s.facing || 1) * 12, s.y - 4, s.def.color, {
          maxR: 22,
          life: 0.18,
        })
      );
      const pitch =
        s.typeId === "archer"
          ? 1.25
          : s.typeId === "mage" || s.typeId === "pirate"
            ? 0.85
            : s.typeId === "thief"
              ? 1.4
              : 1;
      this.sfx.play("shoot", { pitch });
    }

    for (const p of this.projectiles) {
      updateProjectile(p, dt, enemiesById);
      if (p.hit) {
        const target = enemiesById.get(p.targetId);
        if (target) {
          const wasBoss = !!target.def.boss;
          const owner = this.specialists.find((s) => s.id === p.ownerId);
          const hitBuffs = {
            ...this.buffs,
            armorBreak:
              (this.buffs.armorBreak || 0) + (owner?.def?.armorBreakBonus || 0),
          };
          const killed = applyHit(target, p, this.now, hitBuffs);
          this.sfx.play("hit", { heavy: wasBoss });
          this.fx.push(
            ...createParticles(target.x, target.y, p.color, wasBoss ? 10 : 5, {
              speed: wasBoss ? 80 : 50,
              size: wasBoss ? 4 : 2.5,
            })
          );
          if (killed) {
            if (owner) owner.kills += 1;
            this.sfx.play("kill");
            const mesoGain = mesosForKill(target.def);
            this.addMesos(mesoGain, {
              x: target.x,
              y: target.y,
              // 小怪也顯示，但 Boss 一定顯示
              silent: false,
            });
            this.fx.push(...createParticles(target.x, target.y, target.def.color, 16, { speed: 110 }));
            this.fx.push(createRing(target.x, target.y, target.def.color, { maxR: 30 }));
            if (wasBoss) {
              this.fx.push(createFloatText(target.x, target.y - 16, "CLEARED", "#f9a8d4"));
            }
            // split / death summons
            if (target.pendingSpawns?.length) this._flushPendingSpawns(target);
          }
        }
        p.hit = false;
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

    if (this.coreHp <= 0) {
      this.coreHp = 0;
      this.result = "lose";
      this.waveActive = false;
      this.sfx.stopBgm();
      this.status = "Delivery Core offline. Deadline missed.";
      this.sfx.play("lose");
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
    let best = null;
    let bestScore = -Infinity;
    for (const e of this.enemies) {
      if (!isTargetable(e, specialist, this.now)) continue;
      const score = e.distance * 2 - e.hp * 0.05 + (e.def.boss ? 80 : 0);
      if (score > bestScore) {
        bestScore = score;
        best = e;
      }
    }
    return best;
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
      this.ui?.toast?.("先拖職業卡到地圖，或點選後再部署");
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
      if (this.pausedForReward || this.result) return;
      const { x, y } = this.clientToWorld(evt.clientX, evt.clientY);

      if (this.placingType) {
        let pad = this.findPadAt(x, y, { freeOnly: true, maxDist: 64 });
        if (pad == null) pad = this.findPadAt(x, y, { freeOnly: false, maxDist: 48 });
        if (pad != null) {
          this.tryDeployAtPad(pad);
          return;
        }
        this.sfx.play("error");
        this.ui?.toast?.("請點綠色「+」格，或從右側拖曳職業卡到地圖");
        this.ui?.onState?.(this.getPublicState());
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
