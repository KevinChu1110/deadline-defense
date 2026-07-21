/**
 * 地圖危害 / 機制（Canvas 2D）
 * stage.map.hazards: [{ type, ...params }]
 */

export function createHazardState(map) {
  const list = map?.hazards || [];
  return {
    defs: list,
    windFlipT: 0,
    windSign: 1,
    iceSlipT: 0,
    conveyorSign: 1,
    conveyorT: 0,
    portalCd: {},
    cloudDisabled: null,
    cloudT: 0,
  };
}

/**
 * @returns {{ speedMul: number, noSlow: boolean, extraDist: number }}
 */
export function sampleHazardOnEnemy(hazardState, enemy, dt, map) {
  let speedMul = 1;
  let noSlow = false;
  let extraDist = 0;
  if (!hazardState?.defs?.length) return { speedMul, noSlow, extraDist };

  for (const h of hazardState.defs) {
    if (h.type === "windBelt") {
      // flip every period
      // handled in tickHazards
      if (pointInRect(enemy.x, enemy.y, h)) {
        speedMul *= h.speedMul != null ? h.speedMul * (hazardState.windSign > 0 ? 1 : 0.75 / 1.25) : hazardState.windSign > 0 ? 1.25 : 0.75;
      }
    }
    if (h.type === "iceSlip" && pointInRect(enemy.x, enemy.y, h)) {
      speedMul *= h.speedMul || 1.35;
      noSlow = !!h.blockSlow;
    }
    if (h.type === "conveyor" && pointInRect(enemy.x, enemy.y, h)) {
      const s = (h.push || 28) * hazardState.conveyorSign * dt;
      extraDist += s;
    }
  }
  return { speedMul, noSlow, extraDist };
}

export function tickHazards(hazardState, dt) {
  if (!hazardState?.defs?.length) return;
  for (const h of hazardState.defs) {
    if (h.type === "windBelt") {
      hazardState.windFlipT = (hazardState.windFlipT || 0) + dt;
      if (hazardState.windFlipT >= (h.period || 12)) {
        hazardState.windFlipT = 0;
        hazardState.windSign *= -1;
      }
    }
    if (h.type === "conveyor") {
      hazardState.conveyorT = (hazardState.conveyorT || 0) + dt;
      if (hazardState.conveyorT >= (h.period || 15)) {
        hazardState.conveyorT = 0;
        hazardState.conveyorSign *= -1;
      }
    }
    if (h.type === "cloudCollapse") {
      hazardState.cloudT = (hazardState.cloudT || 0) + dt;
      if (hazardState.cloudT >= (h.period || 20)) {
        hazardState.cloudT = 0;
        const paths = h.paths || ["workflow", "event", "pathC"];
        hazardState.cloudDisabled = paths[Math.floor(Math.random() * paths.length)];
        hazardState.cloudDisableUntil = (hazardState.cloudDisableUntil || 0) + (h.duration || 8);
      }
      if (hazardState.cloudDisableUntil > 0) {
        hazardState.cloudDisableUntil -= dt;
        if (hazardState.cloudDisableUntil <= 0) hazardState.cloudDisabled = null;
      }
    }
  }
}

export function tryPortalJump(hazardState, enemy) {
  if (!hazardState?.defs) return false;
  for (const h of hazardState.defs) {
    if (h.type !== "portalPair") continue;
    const key = h.id || "p0";
    const cd = hazardState.portalCd[key] || 0;
    if (cd > 0) continue;
    if (pointInCircle(enemy.x, enemy.y, h.a.x, h.a.y, h.r || 28)) {
      // jump path progress
      if (enemy.pathMetrics?.total) {
        const ratio = Math.min(0.92, enemy.distance / enemy.pathMetrics.total + (h.jumpRatio || 0.15));
        enemy.distance = enemy.pathMetrics.total * ratio;
      }
      hazardState.portalCd[key] = h.cooldown || 8;
      return true;
    }
    if (pointInCircle(enemy.x, enemy.y, h.b.x, h.b.y, h.r || 28)) {
      if (enemy.pathMetrics?.total) {
        const ratio = Math.min(0.92, enemy.distance / enemy.pathMetrics.total + (h.jumpRatio || 0.12));
        enemy.distance = enemy.pathMetrics.total * ratio;
      }
      hazardState.portalCd[key] = h.cooldown || 8;
      return true;
    }
  }
  return false;
}

export function tickPortalCd(hazardState, dt) {
  if (!hazardState?.portalCd) return;
  for (const k of Object.keys(hazardState.portalCd)) {
    hazardState.portalCd[k] = Math.max(0, hazardState.portalCd[k] - dt);
  }
}

export function drawHazards(ctx, hazardState, map, now = 0) {
  if (!hazardState?.defs?.length) return;
  ctx.save();
  for (const h of hazardState.defs) {
    if (h.type === "windBelt" && h.x != null) {
      ctx.fillStyle =
        hazardState.windSign > 0 ? "rgba(147, 197, 253, 0.18)" : "rgba(251, 191, 36, 0.15)";
      ctx.fillRect(h.x, h.y, h.w, h.h);
      ctx.strokeStyle = "rgba(255,255,255,0.35)";
      ctx.strokeRect(h.x, h.y, h.w, h.h);
      ctx.fillStyle = "#e0f2fe";
      ctx.font = "700 11px system-ui";
      ctx.fillText(hazardState.windSign > 0 ? "風→" : "←風", h.x + 8, h.y + 16);
    }
    if (h.type === "iceSlip" && h.x != null) {
      ctx.fillStyle = "rgba(186, 230, 253, 0.22)";
      ctx.fillRect(h.x, h.y, h.w, h.h);
      ctx.fillStyle = "#bae6fd";
      ctx.font = "700 11px system-ui";
      ctx.fillText("冰面", h.x + 8, h.y + 16);
    }
    if (h.type === "conveyor" && h.x != null) {
      ctx.fillStyle = "rgba(56, 189, 248, 0.12)";
      ctx.fillRect(h.x, h.y, h.w, h.h);
      ctx.fillStyle = "#7dd3fc";
      ctx.font = "700 11px system-ui";
      ctx.fillText(hazardState.conveyorSign > 0 ? "洋流→" : "←洋流", h.x + 6, h.y + 16);
    }
    if (h.type === "portalPair") {
      drawPortal(ctx, h.a.x, h.a.y, now, "#a78bfa");
      drawPortal(ctx, h.b.x, h.b.y, now, "#c4b5fd");
    }
    if (h.type === "poisonFog" && h.x != null) {
      ctx.fillStyle = "rgba(74, 222, 128, 0.1)";
      ctx.fillRect(h.x, h.y, h.w, h.h);
    }
  }
  ctx.restore();
}

function drawPortal(ctx, x, y, now, color) {
  ctx.beginPath();
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.arc(x, y, 16 + Math.sin(now * 4) * 2, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = "rgba(167, 139, 250, 0.25)";
  ctx.beginPath();
  ctx.arc(x, y, 12, 0, Math.PI * 2);
  ctx.fill();
}

function pointInRect(px, py, r) {
  if (r.x == null) return false;
  return px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h;
}

function pointInCircle(px, py, cx, cy, rad) {
  return Math.hypot(px - cx, py - cy) <= rad;
}
