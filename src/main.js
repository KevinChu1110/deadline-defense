import {
  Game,
  SPECIALISTS,
  SPECIALIST_ORDER,
  DEFAULT_LOADOUT,
  LOADOUT_MAX,
} from "./game/Game.js";
import { FAMILY_LABELS, SERIES_LABELS } from "./data/specialists.js";
import {
  CARD_MAX_LEVEL,
  getCardLevel,
  getUpgradeCost,
  getSkillTree,
  tryUpgradeCard,
  loadCardProgress,
  buildLeveledDef,
} from "./data/card-progress.js";
import { getSpecialistPortrait, getSpecialistHero } from "./game/sprites.js";
import { sfx } from "./audio/sfx.js";
import { STAGES, loadProgress, isStageUnlocked, getStageByIndex } from "./data/stages.js";
import { getItem } from "./data/items.js";

const canvas = document.querySelector("#game");
const els = {
  core: document.querySelector("#stat-core"),
  wave: document.querySelector("#stat-wave"),
  points: document.querySelector("#stat-points"),
  team: document.querySelector("#stat-team"),
  leavesHud: document.querySelector("#stat-leaves"),
  briefing: document.querySelector("#briefing-text"),
  waveIntel: document.querySelector("#wave-intel"),
  specialistList: document.querySelector("#specialist-list"),
  selectedInfo: document.querySelector("#selected-info"),
  status: document.querySelector("#status-line"),
  stageTitle: document.querySelector("#stage-title"),
  footerStage: document.querySelector("#footer-stage"),
  buffList: document.querySelector("#buff-list"),
  loadoutHint: document.querySelector("#loadout-hint"),
  btnStart: document.querySelector("#btn-start"),
  btnSpeed: document.querySelector("#btn-speed"),
  btnSell: document.querySelector("#btn-sell"),
  btnMute: document.querySelector("#btn-mute"),
  btnStages: document.querySelector("#btn-stages"),
  btnChars: document.querySelector("#btn-chars"),
  toast: document.querySelector("#toast"),
  overlay: document.querySelector("#overlay"),
  overlayKicker: document.querySelector("#overlay-kicker"),
  overlayTitle: document.querySelector("#overlay-title"),
  overlayCopy: document.querySelector("#overlay-copy"),
  btnRestart: document.querySelector("#btn-restart"),
  btnNextStage: document.querySelector("#btn-next-stage"),
  btnToStages: document.querySelector("#btn-to-stages"),
  btnRepickChars: document.querySelector("#btn-repick-chars"),
  stageOverlay: document.querySelector("#stage-overlay"),
  stageList: document.querySelector("#stage-list"),
  charOverlay: document.querySelector("#char-overlay"),
  charGrid: document.querySelector("#char-grid"),
  loadoutCount: document.querySelector("#loadout-count"),
  loadoutMaxLabel: document.querySelector("#loadout-max-label"),
  loadoutPreview: document.querySelector("#loadout-preview"),
  btnCharBack: document.querySelector("#btn-char-back"),
  btnCharConfirm: document.querySelector("#btn-char-confirm"),
  leavesBalance: document.querySelector("#leaves-balance"),
  upgradePanel: document.querySelector("#upgrade-panel"),
  upgradeDetail: document.querySelector("#upgrade-detail"),
  rewardOverlay: document.querySelector("#reward-overlay"),
  rewardList: document.querySelector("#reward-list"),
};

/** Currently focused card for upgrade detail */
let focusCardId = null;

let toastTimer = 0;
/** @type {'stage' | 'char' | 'play' | 'reward' | 'result'} */
let screen = "stage";
/** Pending stage after stage pick, before char confirm */
let pendingStageId = "s01-victoria";
/** Draft loadout while on character select */
let draftLoadout = [...DEFAULT_LOADOUT];

function showToast(msg) {
  els.toast.hidden = false;
  els.toast.textContent = msg;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    els.toast.hidden = true;
  }, 1800);
}

function hideAllOverlays() {
  els.stageOverlay.hidden = true;
  els.charOverlay.hidden = true;
  els.rewardOverlay.hidden = true;
  els.overlay.hidden = true;
}

function showResult(kind) {
  screen = "result";
  hideAllOverlays();
  els.overlay.hidden = false;
  const stage = game.stage;
  const nextIndex = (stage.index ?? 0) + 1;

  if (kind === "win") {
    els.overlayKicker.textContent = "🎉 任務完成";
    els.overlayTitle.textContent = "神木平安！";
    const refreshed = loadProgress();
    const canNext = nextIndex < STAGES.length && isStageUnlocked(nextIndex, refreshed);
    els.overlayCopy.textContent =
      nextIndex < STAGES.length
        ? `${stage.name} 守護成功！${canNext ? "下一關已解鎖。" : ""}`
        : "目前全部關卡完成！你是真正的冒險家。";
    els.btnNextStage.hidden = nextIndex >= STAGES.length;
    els.btnNextStage.disabled = !canNext;
    els.btnNextStage.textContent = canNext
      ? `下一關：${getStageByIndex(nextIndex).name}`
      : "下一關（未解鎖）";
  } else {
    els.overlayKicker.textContent = "💀 任務失敗";
    els.overlayTitle.textContent = "神木被攻陷…";
    els.overlayCopy.textContent = "換個職業組合或佈陣再試一次吧！";
    els.btnNextStage.hidden = true;
  }
}

function updateMuteButton(muted) {
  if (!els.btnMute) return;
  els.btnMute.textContent = muted ? "🔇 靜音" : "🔊 音效";
  els.btnMute.setAttribute("aria-pressed", muted ? "true" : "false");
}

function renderBuffs(state) {
  const chips = [];
  const b = state.buffs || {};
  if (b.attackSpeedMult > 1.01) chips.push(`⚡ 攻速 ×${b.attackSpeedMult.toFixed(2)}`);
  if (b.damageMult > 1.01) chips.push(`💥 傷害 ×${b.damageMult.toFixed(2)}`);
  if (b.armorBreak > 0) chips.push(`📎 破甲 ${(b.armorBreak * 100).toFixed(0)}%`);
  if (b.coreShield > 0) chips.push(`🛡️ 護盾 ${b.coreShield}`);
  if (b.coreSlowRadius > 0) chips.push(`📝 神木緩速`);
  for (const id of state.pickedItems || []) {
    const item = getItem(id);
    if (item) chips.push(`${item.icon} ${item.nameZh}`);
  }
  if (!chips.length) {
    els.buffList.className = "buff-list muted";
    els.buffList.textContent = "尚未獲得道具";
    return;
  }
  els.buffList.className = "buff-list";
  const seen = new Set();
  els.buffList.innerHTML = chips
    .filter((c) => (seen.has(c) ? false : (seen.add(c), true)))
    .map((c) => `<div class="buff-chip"><span>${c}</span></div>`)
    .join("");
}

function refreshWaveIntel() {
  els.waveIntel.innerHTML = game.stage.waves
    .map((w, i) => `<li><strong>第${i + 1}波 ${w.name}</strong> — ${w.intel}</li>`)
    .join("");
  els.stageTitle.textContent = `${game.stage.name} · 神木防衛`;
  els.footerStage.textContent = `STAGE ${String((game.stage.index ?? 0) + 1).padStart(2, "0")} // ${game.stage.code}`;
  els.briefing.textContent = game.stage.briefing;
}

function renderStageList() {
  if (!els.stageList) return;
  const progress = loadProgress();
  els.stageList.innerHTML = "";
  STAGES.forEach((stage, i) => {
    const unlocked = isStageUnlocked(i, progress);
    const cleared = !!progress.cleared[stage.id];
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "stage-btn";
    btn.disabled = !unlocked;
    btn.innerHTML = `
      <span class="idx">${String(i + 1).padStart(2, "0")}</span>
      <span>
        <strong>${stage.name}</strong>
        <small>${stage.briefing}</small>
      </span>
      <span class="badge ${!unlocked ? "locked" : cleared ? "cleared" : ""}">
        ${!unlocked ? "未解鎖" : cleared ? "已通關" : "可挑戰"}
      </span>
    `;
    btn.addEventListener("click", () => {
      void sfx.unlock();
      sfx.play("uiClick");
      pendingStageId = stage.id;
      openCharacterSelect();
    });
    els.stageList.appendChild(btn);
  });
}

function openStageSelect() {
  screen = "stage";
  hideAllOverlays();
  renderStageList();
  if (els.stageOverlay) els.stageOverlay.hidden = false;
  if (game) ui.onState(game.getPublicState());
}

function openCharacterSelect() {
  if (!game) return;
  screen = "char";
  hideAllOverlays();
  draftLoadout = [...(game.loadout?.length ? game.loadout : DEFAULT_LOADOUT)];
  if (els.loadoutMaxLabel) els.loadoutMaxLabel.textContent = String(LOADOUT_MAX);
  focusCardId = draftLoadout[0] || SPECIALIST_ORDER[0];
  renderCharacterGrid();
  if (els.charOverlay) els.charOverlay.hidden = false;
  ui.onState(game.getPublicState());
}

function starsText(level) {
  return "★".repeat(level) + "☆".repeat(CARD_MAX_LEVEL - level);
}

function refreshLeavesUI() {
  if (els.leavesBalance) {
    els.leavesBalance.textContent = String(loadCardProgress().leaves);
  }
}

function renderUpgradePanel(typeId) {
  if (!els.upgradePanel || !els.upgradeDetail) return;
  if (!typeId || !SPECIALISTS[typeId]) {
    els.upgradePanel.hidden = true;
    return;
  }
  focusCardId = typeId;
  const d = SPECIALISTS[typeId];
  const lv = getCardLevel(typeId);
  const tree = getSkillTree(typeId, lv);
  const cost = getUpgradeCost(typeId, lv);
  const leaves = loadCardProgress().leaves;
  const leveled = buildLeveledDef(typeId, lv);

  els.upgradePanel.hidden = false;
  const rows = tree
    .map(
      (s) => `
      <div class="skill-row ${s.unlocked ? "" : "locked"}">
        <span class="lv">★${s.level}</span>
        <span>
          <strong>${s.unlocked ? "✅" : "🔒"} ${s.name}</strong>
          <small>${s.desc}</small>
        </span>
      </div>`
    )
    .join("");

  const nextLine =
    lv >= CARD_MAX_LEVEL
      ? `<p class="muted">已滿級 ★${CARD_MAX_LEVEL}</p>`
      : `<p>下一級 ★${lv + 1} 費用：<strong>🍁 ${cost}</strong>（持有 ${leaves}）${
          leaves < cost ? " · 楓葉不足" : ""
        }</p>`;

  els.upgradeDetail.innerHTML = `
    <h3>${d.emoji || ""} ${d.nameZh} ${starsText(lv)}</h3>
    <p class="muted">部署費 ${leveled.cost}（基礎 ${d.cost}）· 傷 ${leveled.damage} · 射程 ${leveled.range} · 間隔 ${leveled.interval}s</p>
    ${nextLine}
    ${rows}
  `;
}

function toggleDraftJob(id) {
  const idx = draftLoadout.indexOf(id);
  if (idx >= 0) {
    draftLoadout.splice(idx, 1);
    sfx.play("uiClick");
  } else {
    if (draftLoadout.length >= LOADOUT_MAX) {
      sfx.play("error");
      showToast(`最多選 ${LOADOUT_MAX} 個職業`);
      return;
    }
    draftLoadout.push(id);
    sfx.play("deploy");
  }
  renderCharacterGrid();
}

function renderCharacterGrid() {
  els.charGrid.innerHTML = "";
  els.loadoutCount.textContent = String(draftLoadout.length);

  // group by series → family
  const groups = {};
  for (const id of SPECIALIST_ORDER) {
    const d = SPECIALISTS[id];
    if (!d) continue;
    const sk = d.series || "adventurer";
    const fk = d.family || "warrior";
    if (!groups[sk]) groups[sk] = {};
    if (!groups[sk][fk]) groups[sk][fk] = [];
    groups[sk][fk].push(id);
  }

  for (const seriesKey of ["adventurer", "royal", "hero"]) {
    const families = groups[seriesKey];
    if (!families) continue;
    const seriesMeta = SERIES_LABELS[seriesKey] || { label: seriesKey, emoji: "" };
    const seriesHead = document.createElement("div");
    seriesHead.className = "char-series-head";
    seriesHead.textContent = `${seriesMeta.emoji} ${seriesMeta.label}`;
    els.charGrid.appendChild(seriesHead);

    for (const famKey of ["warrior", "mage", "archer", "thief", "pirate"]) {
      const ids = families[famKey];
      if (!ids?.length) continue;
      const famMeta = FAMILY_LABELS[famKey] || { label: famKey, emoji: "" };
      const famHead = document.createElement("div");
      famHead.className = "char-family-head";
      famHead.textContent = `${famMeta.emoji} ${famMeta.label}`;
      els.charGrid.appendChild(famHead);

      const row = document.createElement("div");
      row.className = "char-row";
      for (const id of ids) {
        row.appendChild(buildCharPickButton(id));
      }
      els.charGrid.appendChild(row);
    }
  }

  refreshLeavesUI();
  els.loadoutPreview.innerHTML = draftLoadout.length
    ? draftLoadout
        .map((id) => {
          const d = SPECIALISTS[id];
          const lv = getCardLevel(id);
          return `<span class="loadout-chip"><span class="dot" style="background:${d.color}"></span>${d.emoji || ""} ${d.nameZh} ★${lv}</span>`;
        })
        .join("")
    : `<span class="muted">尚未選擇 — 請點上方職業卡（最多 ${LOADOUT_MAX} 名）</span>`;

  els.btnCharConfirm.disabled = draftLoadout.length === 0;
  renderUpgradePanel(focusCardId);
}

function buildCharPickButton(id) {
  const d = SPECIALISTS[id];
  const selected = draftLoadout.includes(id);
  const lv = getCardLevel(id);
  const leveled = buildLeveledDef(id, lv);
  const nextCost = getUpgradeCost(id, lv);
  const leaves = loadCardProgress().leaves;

  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "char-pick" + (selected ? " selected" : "");
  btn.setAttribute("aria-pressed", selected ? "true" : "false");

  const hero = getSpecialistHero(id, d);
  const c = document.createElement("canvas");
  c.width = hero.width;
  c.height = hero.height;
  const ctx = c.getContext("2d");
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(hero, 0, 0);

  btn.appendChild(c);
  const name = document.createElement("div");
  name.className = "job-name";
  name.textContent = `${d.emoji || ""} ${d.nameZh}`;
  const stars = document.createElement("div");
  stars.className = "stars";
  stars.textContent = starsText(lv);
  const role = document.createElement("div");
  role.className = "job-role";
  role.textContent = `${d.role} · ${d.weapon || ""}`;
  const skill = document.createElement("div");
  skill.className = "job-skill";
  const unlockedNames = (leveled.skillNames || [d.skill]).slice(-2);
  skill.textContent = `技能：${unlockedNames.join(" / ")}`;
  const traits = document.createElement("div");
  traits.className = "job-traits";
  traits.innerHTML = (d.traits || [])
    .map((t) => `<span class="trait-tag">${t}</span>`)
    .join("");
  const cost = document.createElement("div");
  cost.className = "job-cost";
  cost.textContent = `部署 ${leveled.cost} · 傷 ${leveled.damage} · 射程 ${leveled.range}`;

  const upBtn = document.createElement("button");
  upBtn.type = "button";
  upBtn.className = "upgrade-btn" + (lv >= CARD_MAX_LEVEL ? " maxed" : "");
  if (lv >= CARD_MAX_LEVEL) {
    upBtn.textContent = "MAX ★5";
    upBtn.disabled = true;
  } else {
    upBtn.textContent = `升級 🍁${nextCost}`;
    upBtn.disabled = leaves < nextCost;
  }
  upBtn.addEventListener("click", (ev) => {
    ev.stopPropagation();
    void sfx.unlock();
    focusCardId = id;
    const result = tryUpgradeCard(id);
    if (!result.ok) {
      sfx.play("error");
      showToast(result.reason || "無法升級");
      renderUpgradePanel(id);
      refreshLeavesUI();
      return;
    }
    sfx.play("waveClear");
    showToast(
      `${d.nameZh} → ★${result.level}！解鎖「${result.skill?.name || "新技能"}」`
    );
    renderCharacterGrid();
  });

  btn.append(name, stars, role, skill, traits, cost, upBtn);

  btn.addEventListener("click", () => {
    void sfx.unlock();
    focusCardId = id;
    renderUpgradePanel(id);
    toggleDraftJob(id);
  });
  return btn;
}

function confirmLoadoutAndStart() {
  if (!draftLoadout.length) {
    sfx.play("error");
    showToast("至少選 1 個職業");
    return;
  }
  game.loadStage(pendingStageId);
  game.setLoadout(draftLoadout);
  hideAllOverlays();
  screen = "play";
  refreshWaveIntel();
  renderSpecialistCards(game.getPublicState());
  ui.onState(game.getPublicState());
  const names = draftLoadout.map((id) => SPECIALISTS[id].nameZh).join("、");
  showToast(`出戰：${names}`);
  sfx.play("waveStart");
}

function showRewards(items) {
  screen = "reward";
  els.rewardList.innerHTML = "";
  for (const item of items) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "reward-btn";
    btn.innerHTML = `
      <span class="icon">${item.icon}</span>
      <span>
        <strong>${item.nameZh}</strong>
        <small>${item.desc}</small>
      </span>
      <span class="cost">選擇</span>
    `;
    btn.addEventListener("click", () => {
      void sfx.unlock();
      game.pickReward(item.id);
    });
    els.rewardList.appendChild(btn);
  }
  els.rewardOverlay.hidden = false;
}

function hideRewards() {
  els.rewardOverlay.hidden = true;
  if (screen === "reward") screen = "play";
}

/** Assigned after Game is constructed — onState may run during constructor (reset). */
let game = null;

const ui = {
  toast: showToast,
  onResult: showResult,
  onRewardOffer: showRewards,
  onRewardClosed: hideRewards,
  onState(state) {
    // Guard: Game constructor calls reset → onState before `game = new Game(...)` returns.
    if (!game) {
      if (els.core) els.core.textContent = `${state.coreHp ?? 0}`;
      if (els.wave)
        els.wave.textContent =
          state.waveIndex < 0 ? `0 / ${state.waveTotal}` : `${state.waveIndex + 1} / ${state.waveTotal}`;
      if (els.points) els.points.textContent = `${state.points ?? 0}`;
      if (els.status) els.status.textContent = state.status || "";
      refreshLeavesUI();
      return;
    }

    els.core.textContent = `${state.coreHp}`;
    els.wave.textContent =
      state.waveIndex < 0 ? `0 / ${state.waveTotal}` : `${state.waveIndex + 1} / ${state.waveTotal}`;
    els.points.textContent = `${state.points}`;
    els.team.textContent = `${state.teamCount} / ${state.teamLimit}`;
    if (els.leavesHud) {
      els.leavesHud.textContent = String(state.leaves ?? loadCardProgress().leaves);
    }
    refreshLeavesUI();
    els.status.textContent = state.status;
    els.btnSpeed.textContent = `速度 ×${state.speed}`;

    const blocked = screen !== "play";
    els.btnStart.disabled = !state.canStartWave || blocked;
    els.btnStart.textContent =
      state.waveIndex < 0
        ? "開始第 1 波"
        : state.canStartWave
          ? `開始第 ${state.waveIndex + 2} 波`
          : state.waveActive
            ? `第 ${state.waveIndex + 1} 波進行中`
            : state.pausedForReward
              ? "請選擇道具…"
              : "波次結束";

    els.btnSell.disabled =
      !state.selectedSpecialistId || state.result != null || state.pausedForReward || blocked;
    updateMuteButton(state.muted);
    renderBuffs(state);

    if (state.waveIndex < 0) {
      els.briefing.textContent = game.stage.briefing;
    } else {
      els.briefing.textContent = state.waveIntel;
    }

    // loadout hint
    const names = (state.loadout || []).map((id) => SPECIALISTS[id]?.nameZh).filter(Boolean);
    els.loadoutHint.textContent = names.length
      ? `出戰名單：${names.join("、")}（點卡片再點地圖部署）`
      : "請先完成角色選擇";

    const selected = game.specialists.find((s) => s.id === state.selectedSpecialistId);
    if (selected) {
      els.selectedInfo.innerHTML = `<strong style="color:${selected.def.color}">${selected.def.nameZh}</strong> · ${selected.def.skill}<br/><span class="muted">${selected.def.blurb}<br/>擊殺 ${selected.kills} · 賣出 +${selected.def.sellRefund}</span>`;
    } else if (state.placingType) {
      const d = SPECIALISTS[state.placingType];
      els.selectedInfo.innerHTML = `準備部署：<strong style="color:${d.color}">${d.nameZh}</strong><br/><span class="muted">【${d.skill}】${d.blurb}<br/>「${d.quote}」</span>`;
    } else {
      els.selectedInfo.textContent = "點右側職業卡開始部署";
    }

    renderSpecialistCards(state);
  },
};

game = new Game(canvas, ui, STAGES[0]?.id || "s01-victoria");

function renderSpecialistCards(state) {
  if (!els.specialistList || !game) return;
  els.specialistList.innerHTML = "";
  const loadout = state?.loadout?.length ? state.loadout : game.loadout;
  const blocked = screen !== "play" || state?.result || state?.pausedForReward;

  if (!loadout?.length) {
    els.specialistList.innerHTML = `<p class="muted">尚未選擇職業 — 按上方「職業」</p>`;
    return;
  }

  for (const id of loadout) {
    const d = SPECIALISTS[id];
    if (!d) continue;
    const lv = getCardLevel(id);
    const leveled = buildLeveledDef(id, lv);
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "specialist-card";
    if (state?.placingType === id) btn.classList.add("active");
    const cantAfford = (state?.points ?? game.points) < leveled.cost;
    const teamFull = (state?.teamCount ?? 0) >= (state?.teamLimit ?? 6);
    if (cantAfford || teamFull || blocked) btn.classList.add("disabled");

    const portrait = getSpecialistPortrait(id, d);
    const img = document.createElement("canvas");
    img.width = portrait.width;
    img.height = portrait.height;
    img.className = "portrait";
    const ictx = img.getContext("2d");
    ictx.imageSmoothingEnabled = false;
    ictx.drawImage(portrait, 0, 0);

    const text = document.createElement("span");
    const lastSkill = (leveled.skillNames || [d.skill]).slice(-1)[0];
    text.innerHTML = `<strong>${d.nameZh} ★${lv}</strong><small>${lastSkill} · 傷${leveled.damage}</small>`;

    const cost = document.createElement("span");
    cost.className = "cost";
    cost.textContent = String(leveled.cost);

    btn.append(img, text, cost);
    btn.addEventListener("click", () => {
      void sfx.unlock();
      if (blocked) return;
      if ((state?.points ?? game.points) < leveled.cost) {
        sfx.play("error");
        showToast("部署點數不足");
        return;
      }
      if ((state?.teamCount ?? 0) >= (state?.teamLimit ?? 6)) {
        sfx.play("error");
        showToast("場上人數已滿");
        return;
      }
      game.setPlacing(state?.placingType === id ? null : id);
    });
    els.specialistList.appendChild(btn);
  }
}

/** Run UI immediately; unlock audio in background so clicks never hang. */
function withAudio(fn) {
  void sfx.unlock();
  fn();
}

els.btnStart?.addEventListener("click", () => withAudio(() => game.startNextWave()));
els.btnSpeed?.addEventListener("click", () => withAudio(() => game.toggleSpeed()));
els.btnSell?.addEventListener("click", () => withAudio(() => game.sellSelected()));
els.btnMute?.addEventListener("click", () => withAudio(() => game.toggleMute()));
els.btnStages?.addEventListener("click", () =>
  withAudio(() => {
    sfx.play("uiClick");
    openStageSelect();
  })
);
els.btnChars?.addEventListener("click", () =>
  withAudio(() => {
    sfx.play("uiClick");
    pendingStageId = game.stageId || STAGES[0]?.id || "s01-victoria";
    openCharacterSelect();
  })
);
els.btnCharBack?.addEventListener("click", () =>
  withAudio(() => {
    sfx.play("uiClick");
    openStageSelect();
  })
);
els.btnCharConfirm?.addEventListener("click", () =>
  withAudio(() => {
    confirmLoadoutAndStart();
  })
);
els.btnRestart?.addEventListener("click", () =>
  withAudio(() => {
    hideAllOverlays();
    screen = "play";
    game.reset();
    refreshWaveIntel();
    renderSpecialistCards(game.getPublicState());
    showToast("關卡重置");
    sfx.play("uiClick");
  })
);
els.btnNextStage?.addEventListener("click", () =>
  withAudio(() => {
    const next = (game.stage.index ?? 0) + 1;
    if (next >= STAGES.length || !isStageUnlocked(next)) {
      showToast("尚未解鎖");
      sfx.play("error");
      return;
    }
    sfx.play("uiClick");
    pendingStageId = STAGES[next].id;
    openCharacterSelect();
  })
);
els.btnToStages?.addEventListener("click", () =>
  withAudio(() => {
    sfx.play("uiClick");
    openStageSelect();
  })
);
els.btnRepickChars?.addEventListener("click", () =>
  withAudio(() => {
    sfx.play("uiClick");
    pendingStageId = game.stageId || STAGES[0]?.id || "s01-victoria";
    openCharacterSelect();
  })
);

window.addEventListener("keydown", (e) => {
  sfx.unlock();
  if (screen === "char") {
    // 1-9 對應目前 draft 可快速切換預設前幾個職業
    if (e.key >= "1" && e.key <= "9") {
      const i = Number(e.key) - 1;
      if (SPECIALIST_ORDER[i]) toggleDraftJob(SPECIALIST_ORDER[i]);
      return;
    }
    if (e.key === "Enter") {
      confirmLoadoutAndStart();
      return;
    }
  }
  if (screen !== "play") return;
  const loadout = game.loadout || [];
  if (e.key >= "1" && e.key <= "9") {
    const i = Number(e.key) - 1;
    if (loadout[i]) game.setPlacing(loadout[i]);
  }
  if (e.key === " ") {
    e.preventDefault();
    game.startNextWave();
  }
  if (e.key === "Escape") game.setPlacing(null);
  if (e.key === "Delete" || e.key === "Backspace") game.sellSelected();
  if (e.key === "m" || e.key === "M") game.toggleMute();
});

const unlockOnce = () => {
  sfx.unlock();
  window.removeEventListener("pointerdown", unlockOnce);
  window.removeEventListener("keydown", unlockOnce);
};
window.addEventListener("pointerdown", unlockOnce);
window.addEventListener("keydown", unlockOnce);

updateMuteButton(sfx.muted);
refreshWaveIntel();
renderSpecialistCards(game.getPublicState());
ui.onState(game.getPublicState());
game.start();
openStageSelect();
