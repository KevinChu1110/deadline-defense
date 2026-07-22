/**
 * Boss 攻擊 — 每隻對齊台服／Discord bot（raid.js）原技能抽象
 *
 * 海怒斯 hainurs：物理無效、魔法無效、召喚、嘴炮、火柱、千斤墜、消除狀態
 * 拉圖斯 papulatus：揮掌、黑球、時空魔法/暫停、物/魔反射、吸取血魔、縮頭、次元崩壞
 * 殘暴炎魔 zakum：手臂揮擊、熔岩吐息、八臂封印、火柱、魔方回血、詛咒
 * 暗黑龍王 darkdragon：毒息、尾鞭、連鎖閃電、龍息、龍鱗反射、龍魂詛咒
 * 皮卡啾 pinkbean：落石、封印、羽刃、反盾、爆裂花瓣、狂暴、分身
 */

/** @typedef {string} BossAttackType */

/**
 * 五大 Boss 技能池（名稱盡量用原技中文）
 * type 見 applyBossCast
 */
export const BOSS_ATTACK_PRESETS = {
  // ── 水世界 · 海怒斯（深海巨怪 / pianus）──
  boss_hainurs: [
    {
      id: "phys_immune",
      name: "物理無效",
      type: "immune",
      interval: 16,
      cast: 0.6,
      duration: 3.2,
      color: "#64748b",
      toast: "海怒斯進入物理無效！",
    },
    {
      id: "summon",
      name: "召喚小怪",
      type: "summonPulse",
      interval: 11,
      cast: 0.75,
      units: [["bubbling", 5], ["octopus", 1]],
      color: "#0ea5e9",
    },
    {
      id: "mouth",
      name: "嘴炮",
      type: "silence",
      interval: 8.5,
      cast: 0.9,
      radius: 9999,
      silence: 1.6,
      color: "#38bdf8",
      toast: "嘴炮！全隊沉默（快躲！）",
    },
    {
      id: "fire_pillar",
      name: "海怒火柱",
      type: "coreStrike",
      interval: 10,
      cast: 1.0,
      coreDmg: 1,
      color: "#f97316",
    },
    {
      id: "crush",
      name: "千斤墜",
      type: "shockwave",
      interval: 9,
      cast: 1.05,
      radius: 150,
      stun: 2.0,
      color: "#0369a1",
    },
    {
      id: "dispel",
      name: "消除狀態",
      type: "dispel",
      interval: 14,
      cast: 0.55,
      color: "#94a3b8",
      toast: "消除狀態！Boss 異常與我方標記清除",
    },
  ],

  // ── 玩具城 · 拉圖斯 ──
  boss_papulatus: [
    {
      id: "slam",
      name: "揮掌重砸",
      type: "shockwave",
      interval: 8,
      cast: 0.85,
      radius: 120,
      stun: 1.5,
      color: "#a78bfa",
    },
    {
      id: "black_ball",
      name: "召喚黑球",
      type: "summonPulse",
      interval: 10,
      cast: 0.7,
      units: [["jr_wraith", 4], ["bat", 4]],
      color: "#6d28d9",
    },
    {
      id: "time_magic",
      name: "時空魔法",
      type: "curse",
      interval: 9,
      cast: 0.9,
      radius: 9999,
      duration: 4,
      dmgMul: 0.7,
      color: "#c084fc",
      toast: "時空魔法！全隊輸出下降",
    },
    {
      id: "time_stop",
      name: "時空暫停",
      type: "silence",
      interval: 12,
      cast: 1.1,
      radius: 9999,
      silence: 2.2,
      color: "#7c3aed",
      toast: "時空暫停！",
    },
    {
      id: "reflect",
      name: "物理反射",
      type: "reflect",
      interval: 13,
      cast: 0.65,
      duration: 3.5,
      reflectStun: 0.8,
      color: "#e9d5ff",
      toast: "拉圖斯開啟物理反射！",
    },
    {
      id: "drain",
      name: "吸取血魔",
      type: "drain",
      interval: 11,
      cast: 0.95,
      coreDmg: 1,
      healPct: 0.06,
      color: "#f0abfc",
    },
    {
      id: "turtleneck",
      name: "縮頭",
      type: "immune",
      interval: 18,
      cast: 0.5,
      duration: 2.5,
      color: "#ddd6fe",
      toast: "縮頭護盾！暫時免傷",
    },
  ],

  // ── 冰原 · 殘暴炎魔 ──
  boss_zakum: [
    {
      id: "arm",
      name: "手臂揮擊",
      type: "shockwave",
      interval: 7,
      cast: 0.8,
      radius: 115,
      stun: 1.7,
      color: "#ef4444",
    },
    {
      id: "lava",
      name: "熔岩吐息",
      type: "silence",
      interval: 9,
      cast: 0.9,
      radius: 140,
      silence: 1.8,
      color: "#f97316",
    },
    {
      id: "seal",
      name: "八臂封印",
      type: "silence",
      interval: 12,
      cast: 1.0,
      radius: 9999,
      silence: 2.0,
      color: "#b91c1c",
      toast: "八臂封印！",
    },
    {
      id: "pillar",
      name: "火柱",
      type: "coreStrike",
      interval: 9.5,
      cast: 1.0,
      coreDmg: 1,
      color: "#fb923c",
      toast: "火柱襲向神木！",
    },
    {
      id: "cube",
      name: "魔方",
      type: "healCube",
      interval: 16,
      cast: 0.7,
      healPct: 0.12,
      color: "#fbbf24",
      toast: "炎魔魔方！回血並清除弱化",
    },
    {
      id: "curse",
      name: "暗黑詛咒",
      type: "curse",
      interval: 11,
      cast: 0.75,
      radius: 9999,
      duration: 5,
      dmgMul: 0.75,
      color: "#7f1d1d",
    },
  ],

  // ── 神木村 · 暗黑龍王（三頭）──
  boss_dark_dragon: [
    {
      id: "poison",
      name: "劇毒吐息",
      type: "poisonBreath",
      interval: 8,
      cast: 0.95,
      radius: 150,
      silence: 1.2,
      stun: 0.6,
      color: "#22c55e",
      toast: "劇毒吐息！近距離職業中毒失控",
    },
    {
      id: "tail",
      name: "尾鞭纏繞",
      type: "shockwave",
      interval: 7.5,
      cast: 0.85,
      radius: 100,
      stun: 2.2,
      color: "#4ade80",
    },
    {
      id: "chain",
      name: "連鎖閃電",
      type: "chainLightning",
      interval: 9,
      cast: 0.9,
      count: 3,
      stun: 1.4,
      color: "#818cf8",
      toast: "連鎖閃電串擊前線！",
    },
    {
      id: "breath",
      name: "黑暗龍息",
      type: "coreStrike",
      interval: 11,
      cast: 1.15,
      coreDmg: 2,
      color: "#312e81",
    },
    {
      id: "scale",
      name: "龍鱗反射",
      type: "reflect",
      interval: 14,
      cast: 0.6,
      duration: 3.8,
      reflectStun: 1.0,
      color: "#6366f1",
      toast: "龍鱗反射！攻擊者會被反震",
    },
    {
      id: "curse",
      name: "龍魂詛咒",
      type: "curse",
      interval: 12,
      cast: 0.8,
      radius: 180,
      duration: 4.5,
      dmgMul: 0.65,
      color: "#1e1b4b",
    },
  ],

  // ── 時間神殿 · 皮卡啾（最終王）──
  boss_pink_bean: [
    {
      id: "rock",
      name: "落石",
      type: "shockwave",
      interval: 6.5,
      cast: 0.75,
      radius: 130,
      stun: 1.4,
      color: "#a8a29e",
    },
    {
      id: "seal",
      name: "封印",
      type: "silence",
      interval: 8,
      cast: 0.85,
      radius: 9999,
      silence: 1.8,
      color: "#c084fc",
      toast: "封印！",
    },
    {
      id: "feather",
      name: "羽刃風暴",
      type: "multiSilence",
      interval: 9,
      cast: 0.9,
      count: 3,
      silence: 2.0,
      color: "#f9a8d4",
      toast: "羽刃風暴鎖定數名職業！",
    },
    {
      id: "reflect",
      name: "反盾",
      type: "reflect",
      interval: 12,
      cast: 0.55,
      duration: 3.0,
      reflectStun: 0.9,
      color: "#fde68a",
      toast: "皮卡啾反盾！",
    },
    {
      id: "petal",
      name: "爆裂花瓣",
      type: "coreStrike",
      interval: 8.5,
      cast: 0.95,
      coreDmg: 1,
      color: "#fb7185",
    },
    {
      id: "statue",
      name: "石像甦醒",
      type: "summonPulse",
      interval: 13,
      cast: 0.8,
      units: [["slime", 6], ["jr_wraith", 3], ["pig", 2]],
      color: "#fda4af",
    },
    {
      id: "rage",
      name: "狂暴",
      type: "enrage",
      interval: 20,
      cast: 0.6,
      haste: 0.35,
      duration: 6,
      healPct: 0.04,
      color: "#f43f5e",
      toast: "皮卡啾狂暴！加速並小回血",
      once: true, // 一場只狂暴一次（用 queue flag）
    },
  ],
};

export function getBossAttacks(def) {
  if (!def?.boss) return [];
  if (def.bossAttacks?.length) return def.bossAttacks;
  return BOSS_ATTACK_PRESETS[def.id] || defaultBossAttacks(def);
}

function defaultBossAttacks(def) {
  if (!def.boss) return [];
  return [
    {
      id: "slam",
      name: "重擊",
      type: "shockwave",
      interval: 9,
      cast: 0.85,
      radius: 100,
      stun: 1.2,
      color: def.color || "#fca5a5",
    },
    {
      id: "core",
      name: "神木一擊",
      type: "coreStrike",
      interval: 14,
      cast: 1.0,
      coreDmg: 1,
      color: def.color || "#fca5a5",
    },
  ];
}

export function initBossAttackState(enemy) {
  const attacks = getBossAttacks(enemy.def);
  if (!attacks.length) {
    enemy.bossAtk = null;
    return;
  }
  enemy.bossAtk = {
    queue: attacks.map((a, i) => ({
      ...a,
      cd: 2.2 + i * 1.1 + Math.random() * 1.8,
      _usedOnce: false,
    })),
    casting: null,
    telegraph: null,
  };
}

export function tickBossAttacks(enemy, dt, now) {
  const events = [];
  if (!enemy.alive || !enemy.bossAtk || !enemy.def.boss) return events;
  const st = enemy.bossAtk;

  if (st.casting) {
    st.casting.t -= dt;
    if (st.telegraph) st.telegraph.life = st.casting.t;
    if (st.casting.t <= 0) {
      const skill = st.casting.skill;
      st.casting = null;
      st.telegraph = null;
      events.push({ kind: "bossCast", enemy, skill, x: enemy.x, y: enemy.y });
    }
    return events;
  }

  for (const slot of st.queue) {
    if (slot.once && slot._usedOnce) continue;
    slot.cd -= dt;
    if (slot.cd > 0) continue;
    slot.cd = slot.interval * (0.88 + Math.random() * 0.24);
    if (slot.once) slot._usedOnce = true;
    const cast = slot.cast ?? 0.85;
    st.casting = { skill: slot, t: cast, maxT: cast };
    const global = (slot.radius || 0) >= 500 || slot.type === "enrage" || slot.type === "healCube";
    const r =
      slot.type === "coreStrike" || slot.type === "drain"
        ? 52
        : global
          ? 100
          : slot.radius && slot.radius < 500
            ? slot.radius
            : 90;
    st.telegraph = {
      x: enemy.x,
      y: enemy.y,
      r,
      maxR: r,
      color: slot.color || enemy.def.color,
      life: cast,
      maxLife: cast,
      name: slot.name,
      global,
    };
    events.push({
      kind: "bossTelegraph",
      enemy,
      skill: slot,
      text: `${enemy.def.nameZh} · ${slot.name}`,
    });
    break;
  }
  return events;
}

function fxRing(x, y, color, maxR = 50) {
  return {
    id: Math.random().toString(36).slice(2),
    kind: "ring",
    x,
    y,
    r: 8,
    maxR,
    life: 0.4,
    maxLife: 0.4,
    color,
    lineWidth: 2.5,
  };
}

function fxWave(x, y, color, maxR) {
  return {
    id: Math.random().toString(36).slice(2),
    kind: "shockwave",
    x,
    y,
    r: 8,
    maxR,
    life: 0.4,
    maxLife: 0.4,
    color,
    lineWidth: 3,
  };
}

export function applyBossCast(game, event) {
  const { enemy, skill } = event;
  if (!skill || !enemy) return;
  const fx = [];
  const now = game.now;
  let sfxName = "bossPhase";

  const toast = (msg) => {
    if (msg) game.ui?.toast?.(msg);
  };

  switch (skill.type) {
    case "shockwave": {
      const r = skill.radius || 100;
      let hit = 0;
      for (const sp of game.specialists) {
        if (Math.hypot(sp.x - enemy.x, sp.y - enemy.y) <= r) {
          sp.stunnedUntil = Math.max(sp.stunnedUntil || 0, now + (skill.stun || 1.2));
          hit++;
        }
      }
      fx.push(fxWave(enemy.x, enemy.y, skill.color || "#fca5a5", r));
      toast(skill.toast || (hit ? `${skill.name}！暈眩 ${hit} 名` : `${skill.name}`));
      break;
    }
    case "silence": {
      const r = skill.radius || 120;
      const global = r >= 500;
      let hit = 0;
      for (const sp of game.specialists) {
        if (global || Math.hypot(sp.x - enemy.x, sp.y - enemy.y) <= r) {
          sp.silencedUntil = Math.max(sp.silencedUntil || 0, now + (skill.silence || 1.5));
          hit++;
        }
      }
      fx.push(fxRing(enemy.x, enemy.y, skill.color || "#c4b5fd", global ? 180 : r));
      toast(skill.toast || `${skill.name}！沉默 ${hit}`);
      break;
    }
    case "multiSilence": {
      const list = [...game.specialists]
        .sort(() => Math.random() - 0.5)
        .slice(0, skill.count || 2);
      for (const sp of list) {
        sp.silencedUntil = Math.max(sp.silencedUntil || 0, now + (skill.silence || 1.8));
        fx.push(fxRing(sp.x, sp.y, skill.color || "#f9a8d4", 40));
      }
      toast(skill.toast || `${skill.name} 命中 ${list.length} 人`);
      break;
    }
    case "chainLightning": {
      const list = [...game.specialists]
        .map((sp) => ({ sp, d: Math.hypot(sp.x - enemy.x, sp.y - enemy.y) }))
        .sort((a, b) => a.d - b.d)
        .slice(0, skill.count || 3)
        .map((x) => x.sp);
      for (const sp of list) {
        sp.stunnedUntil = Math.max(sp.stunnedUntil || 0, now + (skill.stun || 1.2));
        fx.push(fxRing(sp.x, sp.y, skill.color || "#818cf8", 36));
      }
      toast(skill.toast || `${skill.name} ×${list.length}`);
      break;
    }
    case "poisonBreath": {
      const r = skill.radius || 140;
      let hit = 0;
      for (const sp of game.specialists) {
        if (Math.hypot(sp.x - enemy.x, sp.y - enemy.y) <= r) {
          sp.silencedUntil = Math.max(sp.silencedUntil || 0, now + (skill.silence || 1));
          sp.stunnedUntil = Math.max(sp.stunnedUntil || 0, now + (skill.stun || 0.5));
          sp.cursedUntil = Math.max(sp.cursedUntil || 0, now + 3);
          sp.curseDmgMul = Math.min(sp.curseDmgMul || 1, 0.8);
          hit++;
        }
      }
      fx.push(fxWave(enemy.x, enemy.y, skill.color || "#22c55e", r));
      toast(skill.toast || `劇毒吐息命中 ${hit}`);
      break;
    }
    case "coreStrike": {
      sfxName = "leak";
      const dmg = skill.coreDmg || 1;
      if (game.buffs.coreShield > 0) {
        game.buffs.coreShield -= 1;
        toast(`${skill.name} 被護盾擋住！`);
      } else {
        game.coreHp = Math.max(0, game.coreHp - dmg);
        toast(skill.toast || `${skill.name} 命中神木 −${dmg}`);
      }
      const core = game.stage.map.core;
      fx.push({
        id: Math.random().toString(36).slice(2),
        kind: "hitFlash",
        x: core.x,
        y: core.y,
        color: skill.color || "#fb7185",
        life: 0.28,
        maxLife: 0.28,
        r: 44,
      });
      break;
    }
    case "drain": {
      sfxName = "leak";
      const dmg = skill.coreDmg || 1;
      if (game.buffs.coreShield > 0) game.buffs.coreShield -= 1;
      else game.coreHp = Math.max(0, game.coreHp - dmg);
      const heal = Math.round(enemy.maxHp * (skill.healPct || 0.05));
      enemy.hp = Math.min(enemy.maxHp, enemy.hp + heal);
      toast(skill.toast || `${skill.name}：神木 −${dmg}，Boss +${heal} HP`);
      fx.push(fxRing(enemy.x, enemy.y, skill.color || "#f0abfc", 60));
      break;
    }
    case "armorUp": {
      enemy.status.bossArmorUntil = now + (skill.duration || 4);
      enemy.status.bossArmorAdd = skill.armorAdd || 0.15;
      toast(skill.toast || `${enemy.def.nameZh} 護甲上升`);
      fx.push(fxRing(enemy.x, enemy.y, skill.color || "#fbbf24", 55));
      break;
    }
    case "immune": {
      enemy.status.bossImmuneUntil = now + (skill.duration || 3);
      toast(skill.toast || `${skill.name}！暫時免傷`);
      fx.push(fxRing(enemy.x, enemy.y, skill.color || "#94a3b8", 70));
      break;
    }
    case "reflect": {
      enemy.status.bossReflectUntil = now + (skill.duration || 3);
      enemy.status.bossReflectStun = skill.reflectStun || 0.8;
      toast(skill.toast || `${skill.name}！`);
      fx.push(fxRing(enemy.x, enemy.y, skill.color || "#e9d5ff", 65));
      break;
    }
    case "curse": {
      const r = skill.radius || 9999;
      const global = r >= 500;
      let hit = 0;
      for (const sp of game.specialists) {
        if (global || Math.hypot(sp.x - enemy.x, sp.y - enemy.y) <= r) {
          sp.cursedUntil = Math.max(sp.cursedUntil || 0, now + (skill.duration || 4));
          sp.curseDmgMul = Math.min(sp.curseDmgMul || 1, skill.dmgMul || 0.7);
          hit++;
        }
      }
      toast(skill.toast || `${skill.name}！${hit} 名輸出下降`);
      fx.push(fxRing(enemy.x, enemy.y, skill.color || "#7f1d1d", global ? 160 : r));
      break;
    }
    case "dispel": {
      // 清 Boss 身上的 slow/burn/analyze，並清我方 curse 以外的…簡化：清 boss 異常 + 我方 analyzed 無
      enemy.status.slowUntil = 0;
      enemy.status.burnUntil = 0;
      enemy.status.analyzedUntil = 0;
      enemy.status.armorBreakUntil = 0;
      enemy.burnStacks = 0;
      toast(skill.toast || "消除狀態！");
      fx.push(fxRing(enemy.x, enemy.y, skill.color || "#94a3b8", 80));
      break;
    }
    case "healCube": {
      const heal = Math.round(enemy.maxHp * (skill.healPct || 0.1));
      enemy.hp = Math.min(enemy.maxHp, enemy.hp + heal);
      enemy.status.slowUntil = 0;
      enemy.status.burnUntil = 0;
      enemy.status.analyzedUntil = 0;
      enemy.status.armorBreakUntil = 0;
      toast(skill.toast || `魔方回血 +${heal}`);
      fx.push(fxRing(enemy.x, enemy.y, skill.color || "#fbbf24", 70));
      break;
    }
    case "hastePulse":
    case "enrage": {
      enemy.status.bossHasteUntil = now + (skill.duration || 5);
      enemy.status.bossHasteAdd = skill.haste || 0.25;
      if (skill.healPct) {
        enemy.hp = Math.min(enemy.maxHp, enemy.hp + Math.round(enemy.maxHp * skill.healPct));
      }
      for (const e of game.enemies) {
        if (!e.alive) continue;
        if (Math.hypot(e.x - enemy.x, e.y - enemy.y) < 160) {
          e.status.hastePower = Math.max(e.status.hastePower || 1, 1 + (skill.haste || 0.2));
          e.status._hasteExpire = now + (skill.duration || 5);
        }
      }
      toast(skill.toast || `${skill.name}！`);
      fx.push(fxWave(enemy.x, enemy.y, skill.color || "#f43f5e", 120));
      break;
    }
    case "summonPulse": {
      if (skill.units?.length) {
        enemy.pendingSpawns.push({
          units: skill.units,
          pathMode: "both",
          distanceRatio: Math.min(0.85, enemy.distance / (enemy.pathMetrics.total || 1)),
        });
        toast(skill.toast || `${skill.name}！`);
      }
      break;
    }
    default:
      break;
  }

  game.fx.push(...fx);
  game.sfx?.play?.(sfxName);
}

export function getBossArmorBonus(enemy, now) {
  if (enemy.status?.bossArmorUntil > now) return enemy.status.bossArmorAdd || 0;
  return 0;
}

export function getBossHasteBonus(enemy, now) {
  if (enemy.status?.bossHasteUntil > now) return enemy.status.bossHasteAdd || 0;
  return 0;
}

export function isBossImmune(enemy, now) {
  return (enemy.status?.bossImmuneUntil || 0) > now;
}

export function getBossReflectStun(enemy, now) {
  if ((enemy.status?.bossReflectUntil || 0) > now) {
    return enemy.status.bossReflectStun || 0.8;
  }
  return 0;
}

export function drawBossTelegraphs(ctx, enemies) {
  for (const e of enemies) {
    const t = e.bossAtk?.telegraph;
    if (!t || !e.alive) continue;
    const a = Math.max(0.15, t.life / t.maxLife);
    ctx.save();
    if (t.global) {
      ctx.globalAlpha = 0.1 + a * 0.18;
      ctx.fillStyle = t.color || "#fca5a5";
      ctx.fillRect(0, 0, 960, 540);
      ctx.globalAlpha = 0.95;
      ctx.fillStyle = t.color || "#fecdd3";
      ctx.font = "800 15px 'PingFang TC', system-ui";
      ctx.textAlign = "center";
      ctx.fillText(`⚠ ${e.def.nameZh} · ${t.name}`, 480, 36);
    } else {
      ctx.globalAlpha = 0.35 + a * 0.5;
      ctx.strokeStyle = t.color || "#fca5a5";
      ctx.lineWidth = 3;
      ctx.setLineDash([8, 6]);
      ctx.beginPath();
      const pulse = t.r * (0.85 + 0.15 * Math.sin(performance.now() / 80));
      ctx.arc(e.x, e.y, pulse, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = t.color || "#fecdd3";
      ctx.font = "800 11px 'PingFang TC', system-ui";
      ctx.textAlign = "center";
      ctx.fillText(t.name, e.x, e.y - (e.def.radius || 20) - 28);
    }
    // immune / reflect aura
    if ((e.status?.bossImmuneUntil || 0) > 0 || (e.status?.bossReflectUntil || 0) > 0) {
      /* drawn per-frame via status — need now; skip here */
    }
    ctx.restore();
  }
  // status rings
  for (const e of enemies) {
    if (!e.alive || !e.def.boss) continue;
    ctx.save();
    if ((e.status?.bossImmuneUntil || 0) > performance.now() / 1000) {
      /* now is game time not perf — use existence */
    }
    if (e.status?.bossImmuneUntil) {
      // approximate: if field set show ring (cleared after expire in logic by comparison with game.now in draw path)
    }
    ctx.restore();
  }
}

/** call from render with game now */
export function drawBossStatusAuras(ctx, enemies, now) {
  for (const e of enemies) {
    if (!e.alive || !e.def.boss) continue;
    ctx.save();
    if ((e.status?.bossImmuneUntil || 0) > now) {
      ctx.strokeStyle = "rgba(148, 163, 184, 0.9)";
      ctx.lineWidth = 3;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.arc(e.x, e.y, e.def.radius + 18, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = "#e2e8f0";
      ctx.font = "800 10px system-ui";
      ctx.textAlign = "center";
      ctx.fillText("無效", e.x, e.y - e.def.radius - 32);
    }
    if ((e.status?.bossReflectUntil || 0) > now) {
      ctx.strokeStyle = "rgba(233, 213, 255, 0.95)";
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(e.x, e.y, e.def.radius + 16, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = "#e9d5ff";
      ctx.font = "800 10px system-ui";
      ctx.textAlign = "center";
      ctx.fillText("反射", e.x, e.y - e.def.radius - 22);
    }
    ctx.restore();
  }
}
