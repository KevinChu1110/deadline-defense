/**
 * Boss 攻擊設計：預示 → 施放 → 對部署單位／神木造成壓力
 * 與純走路線 + 招兵互補，讓 Boss 戰有「要解讀機制」的感覺
 */

/** @typedef {'shockwave'|'coreStrike'|'silence'|'hastePulse'|'armorUp'|'summonPulse'} BossAttackType */

/**
 * 預設攻擊池（可被 boss def.bossAttacks 覆寫）
 */
export const BOSS_ATTACK_PRESETS = {
  boss_hainurs: [
    { id: "tentacle", name: "觸手拍擊", type: "shockwave", interval: 7.5, cast: 0.9, radius: 110, stun: 1.6, color: "#38bdf8" },
    { id: "tide", name: "潮湧", type: "coreStrike", interval: 11, cast: 1.1, coreDmg: 1, color: "#0ea5e9" },
    { id: "bubble", name: "深海氣泡", type: "silence", interval: 9, cast: 0.8, radius: 130, silence: 2.0, color: "#7dd3fc" },
  ],
  boss_papulatus: [
    { id: "timestop", name: "時空暫停", type: "silence", interval: 8, cast: 1.0, radius: 9999, silence: 1.8, color: "#c084fc" },
    { id: "clock", name: "時鐘重砸", type: "coreStrike", interval: 10, cast: 1.0, coreDmg: 1, color: "#a78bfa" },
    { id: "rift", name: "次元裂縫", type: "summonPulse", interval: 12, cast: 0.7, units: [["jr_wraith", 3], ["bat", 3]], color: "#ddd6fe" },
  ],
  boss_zakum: [
    { id: "arms", name: "手臂重擊", type: "shockwave", interval: 7, cast: 0.85, radius: 120, stun: 1.8, color: "#ef4444" },
    { id: "pillar", name: "煉獄火柱", type: "coreStrike", interval: 9.5, cast: 1.0, coreDmg: 1, color: "#f97316" },
    { id: "shell", name: "熔岩護甲", type: "armorUp", interval: 14, cast: 0.6, armorAdd: 0.18, duration: 5, color: "#fb923c" },
  ],
  boss_dark_dragon: [
    { id: "breath", name: "闇息", type: "shockwave", interval: 6.5, cast: 0.95, radius: 140, stun: 1.5, color: "#6366f1" },
    { id: "roar", name: "龍威", type: "silence", interval: 10, cast: 0.85, radius: 160, silence: 2.2, color: "#818cf8" },
    { id: "crash", name: "落地震擊", type: "coreStrike", interval: 12, cast: 1.15, coreDmg: 2, color: "#4c1d95" },
  ],
  boss_pink_bean: [
    { id: "prank", name: "惡作劇", type: "silence", interval: 6.5, cast: 0.7, radius: 9999, silence: 1.5, color: "#f9a8d4" },
    { id: "petal", name: "爆裂花瓣", type: "coreStrike", interval: 8.5, cast: 0.9, coreDmg: 1, color: "#fb7185" },
    { id: "rage", name: "分身秀", type: "summonPulse", interval: 11, cast: 0.75, units: [["slime", 6], ["pig", 2]], color: "#fda4af" },
    { id: "haste", name: "加速光環", type: "hastePulse", interval: 13, cast: 0.5, haste: 0.25, duration: 4, color: "#fbcfe8" },
  ],
};

export function getBossAttacks(def) {
  if (!def?.boss) return [];
  if (def.bossAttacks?.length) return def.bossAttacks;
  return BOSS_ATTACK_PRESETS[def.id] || defaultBossAttacks(def);
}

function defaultBossAttacks(def) {
  // 一般 mid/boss 也有簡易招式
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

/**
 * 初始化 boss 攻擊狀態（createEnemy 時呼叫）
 */
export function initBossAttackState(enemy) {
  const attacks = getBossAttacks(enemy.def);
  if (!attacks.length) {
    enemy.bossAtk = null;
    return;
  }
  enemy.bossAtk = {
    queue: attacks.map((a, i) => ({
      ...a,
      cd: 2.5 + i * 1.2 + Math.random() * 1.5, // 進場後錯開出手
    })),
    casting: null, // { skill, t, maxT }
    telegraph: null, // { x, y, r, color, life, maxLife, name }
  };
}

/**
 * @returns {object[]} events for Game to apply
 */
export function tickBossAttacks(enemy, dt, now) {
  const events = [];
  if (!enemy.alive || !enemy.bossAtk || !enemy.def.boss) return events;
  const st = enemy.bossAtk;

  // casting telegraph
  if (st.casting) {
    st.casting.t -= dt;
    if (st.telegraph) {
      st.telegraph.life = st.casting.t;
    }
    if (st.casting.t <= 0) {
      const skill = st.casting.skill;
      st.casting = null;
      st.telegraph = null;
      events.push({ kind: "bossCast", enemy, skill, x: enemy.x, y: enemy.y });
    }
    return events;
  }

  for (const slot of st.queue) {
    slot.cd -= dt;
    if (slot.cd > 0) continue;
    // start cast
    slot.cd = slot.interval * (0.9 + Math.random() * 0.2);
    const cast = slot.cast ?? 0.85;
    st.casting = { skill: slot, t: cast, maxT: cast };
    const r =
      slot.type === "coreStrike"
        ? 48
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
      global: slot.radius >= 500,
    };
    events.push({
      kind: "bossTelegraph",
      enemy,
      skill: slot,
      text: `${enemy.def.nameZh} · ${slot.name}`,
    });
    break; // one cast at a time
  }
  return events;
}

/**
 * Apply resolved cast to game state
 */
export function applyBossCast(game, event) {
  const { enemy, skill } = event;
  if (!skill || !enemy) return;
  const fx = [];
  const sfxName = skill.type === "coreStrike" ? "leak" : "bossPhase";

  switch (skill.type) {
    case "shockwave": {
      const r = skill.radius || 100;
      let hit = 0;
      for (const sp of game.specialists) {
        if (Math.hypot(sp.x - enemy.x, sp.y - enemy.y) <= r) {
          sp.stunnedUntil = Math.max(sp.stunnedUntil || 0, game.now + (skill.stun || 1.2));
          hit++;
        }
      }
      fx.push({
        kind: "shockwave",
        x: enemy.x,
        y: enemy.y,
        r: 8,
        maxR: r,
        life: 0.4,
        maxLife: 0.4,
        color: skill.color || "#fca5a5",
        lineWidth: 3,
        id: Math.random().toString(36).slice(2),
      });
      if (hit) {
        game.ui?.toast?.(`${skill.name}！${hit} 名職業被暈 ${skill.stun || 1.2}s`);
      }
      break;
    }
    case "silence": {
      const r = skill.radius || 120;
      const global = r >= 500;
      let hit = 0;
      for (const sp of game.specialists) {
        if (global || Math.hypot(sp.x - enemy.x, sp.y - enemy.y) <= r) {
          sp.silencedUntil = Math.max(sp.silencedUntil || 0, game.now + (skill.silence || 1.5));
          hit++;
        }
      }
      fx.push({
        kind: "ring",
        x: enemy.x,
        y: enemy.y,
        r: 6,
        maxR: global ? 200 : r,
        life: 0.45,
        maxLife: 0.45,
        color: skill.color || "#c4b5fd",
        lineWidth: 2.5,
        id: Math.random().toString(36).slice(2),
      });
      if (hit) {
        game.ui?.toast?.(`${skill.name}！${hit} 名職業沉默 ${skill.silence || 1.5}s`);
      }
      break;
    }
    case "coreStrike": {
      const dmg = skill.coreDmg || 1;
      if (game.buffs.coreShield > 0) {
        game.buffs.coreShield -= 1;
        game.ui?.toast?.(`${skill.name} 被護盾擋住！`);
      } else {
        game.coreHp = Math.max(0, game.coreHp - dmg);
        game.ui?.toast?.(`${skill.name} 命中神木 −${dmg}！`);
      }
      const core = game.stage.map.core;
      fx.push({
        kind: "hitFlash",
        x: core.x,
        y: core.y,
        color: skill.color || "#fb7185",
        life: 0.25,
        maxLife: 0.25,
        r: 40,
        id: Math.random().toString(36).slice(2),
      });
      break;
    }
    case "armorUp": {
      enemy.status.bossArmorUntil = game.now + (skill.duration || 4);
      enemy.status.bossArmorAdd = skill.armorAdd || 0.15;
      game.ui?.toast?.(`${enemy.def.nameZh} 護甲上升！`);
      fx.push({
        kind: "ring",
        x: enemy.x,
        y: enemy.y,
        r: 10,
        maxR: 50,
        life: 0.5,
        maxLife: 0.5,
        color: skill.color || "#fbbf24",
        lineWidth: 3,
        id: Math.random().toString(36).slice(2),
      });
      break;
    }
    case "hastePulse": {
      enemy.status.bossHasteUntil = game.now + (skill.duration || 4);
      enemy.status.bossHasteAdd = skill.haste || 0.2;
      // also buff nearby enemies
      for (const e of game.enemies) {
        if (!e.alive || e.id === enemy.id) continue;
        if (Math.hypot(e.x - enemy.x, e.y - enemy.y) < 140) {
          e.status.hastePower = Math.max(e.status.hastePower || 1, 1 + (skill.haste || 0.2));
          e.status._hasteExpire = game.now + (skill.duration || 4);
        }
      }
      game.ui?.toast?.(`${skill.name}！敵方加速`);
      break;
    }
    case "summonPulse": {
      if (skill.units?.length) {
        enemy.pendingSpawns.push({
          units: skill.units,
          pathMode: "both",
          distanceRatio: Math.min(0.85, enemy.distance / (enemy.pathMetrics.total || 1)),
        });
        game.ui?.toast?.(`${skill.name} · 召喚！`);
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

/** draw cast telegraphs */
export function drawBossTelegraphs(ctx, enemies) {
  for (const e of enemies) {
    const t = e.bossAtk?.telegraph;
    if (!t || !e.alive) continue;
    const a = Math.max(0.15, t.life / t.maxLife);
    ctx.save();
    ctx.globalAlpha = 0.35 + a * 0.45;
    if (t.global) {
      // full-screen warning bar
      ctx.fillStyle = t.color || "#fca5a5";
      ctx.globalAlpha = 0.12 + a * 0.15;
      ctx.fillRect(0, 0, 960, 540);
      ctx.globalAlpha = 0.9;
      ctx.fillStyle = t.color || "#fecdd3";
      ctx.font = "800 15px 'PingFang TC', system-ui";
      ctx.textAlign = "center";
      ctx.fillText(`⚠ ${t.name}`, 480, 36);
    } else {
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
    ctx.restore();
  }
}
