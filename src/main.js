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
import {
  getSpecialistPortrait,
  getSpecialistHero,
  preloadLpcPortraits,
} from "./game/sprites.js";
import { getJobIcon } from "./data/job-icons.js";
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
  seriesTabs: document.querySelector("#series-tabs"),
  familyTabs: document.querySelector("#family-tabs"),
  charDetail: document.querySelector("#char-detail"),
  rewardOverlay: document.querySelector("#reward-overlay"),
  rewardList: document.querySelector("#reward-list"),
};

/** Currently focused card for upgrade detail */
let focusCardId = null;
/** Filters for character picker */
let filterSeries = "all"; // all | adventurer | royal | hero
let filterFamily = "all"; // all | warrior | mage | archer | thief | pirate

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

function setOverlayOpen(el, open) {
  if (!el) return;
  el.classList.toggle("is-open", !!open);
  el.hidden = !open;
}

function hideAllOverlays() {
  setOverlayOpen(els.stageOverlay, false);
  setOverlayOpen(els.charOverlay, false);
  setOverlayOpen(els.rewardOverlay, false);
  setOverlayOpen(els.overlay, false);
}

/** Clear end-of-run flags so menus work after victory/defeat. */
function clearRunState() {
  if (!game) return;
  game.result = null;
  game.waveActive = false;
  game.pausedForReward = false;
  game.pendingRewardChoices = null;
}

function showResult(kind) {
  try {
    screen = "result";
    hideAllOverlays();

    // Write copy first so UI never shows empty/default if something throws later
    if (kind === "win") {
      if (els.overlayKicker) els.overlayKicker.textContent = "任務完成";
      if (els.overlayTitle) els.overlayTitle.textContent = "勝利";
      const stage = game?.stage;
      const stageName = stage?.name || "本關";
      const nextIndex = (stage?.index ?? 0) + 1;
      const refreshed = loadProgress();
      const canNext = nextIndex < STAGES.length && isStageUnlocked(nextIndex, refreshed);
      if (els.overlayCopy) {
        els.overlayCopy.textContent =
          nextIndex < STAGES.length
            ? `${stageName} 守護成功！神木平安無事。${canNext ? " 下一關已解鎖。" : ""}`
            : `${stageName} 完成！你已通關全部關卡。`;
      }
      if (els.btnNextStage) {
        els.btnNextStage.hidden = nextIndex >= STAGES.length;
        els.btnNextStage.disabled = !canNext;
        els.btnNextStage.textContent = canNext
          ? `下一關：${getStageByIndex(nextIndex).name}`
          : "下一關（未解鎖）";
      }
    } else {
      if (els.overlayKicker) els.overlayKicker.textContent = "任務失敗";
      if (els.overlayTitle) els.overlayTitle.textContent = "失敗";
      if (els.overlayCopy) els.overlayCopy.textContent = "神木被攻陷…換個職業或佈陣再試一次！";
      if (els.btnNextStage) els.btnNextStage.hidden = true;
    }

    setOverlayOpen(els.overlay, true);
  } catch (err) {
    console.error("[showResult]", err);
    // Last resort: still show dialog
    setOverlayOpen(els.overlay, true);
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
  closeCharacterChrome();
  document.body.classList.remove("in-play");
  hideAllOverlays();
  renderStageList();
  setOverlayOpen(els.stageOverlay, true);
  // Sync unlock + BGM (no await)
  void sfx.unlock();
  if (!sfx.muted) sfx.startBgm("menu");
  if (game) ui.onState(game.getPublicState());
}

function openCharacterSelect() {
  if (!game) return;
  screen = "char";
  hideAllOverlays();
  draftLoadout = [...(game.loadout?.length ? game.loadout : DEFAULT_LOADOUT)];
  if (els.loadoutMaxLabel) els.loadoutMaxLabel.textContent = String(LOADOUT_MAX);
  focusCardId = draftLoadout[0] || SPECIALIST_ORDER[0];
  filterSeries = "all";
  filterFamily = "all";
  renderFilterTabs();
  renderCharacterGrid();
  setOverlayOpen(els.charOverlay, true);
  document.body.classList.add("char-select-open");
  void sfx.unlock();
  void sfx.preload();
  if (!sfx.muted) sfx.startBgm("menu");
  // LPC portraits: reload grid once images arrive
  void preloadLpcPortraits(SPECIALIST_ORDER).then(() => {
    if (screen === "char") renderCharacterGrid();
  });
  ui.onState(game.getPublicState());
}

function closeCharacterChrome() {
  document.body.classList.remove("char-select-open");
}

function starsText(level) {
  return "★".repeat(level) + "☆".repeat(Math.max(0, CARD_MAX_LEVEL - level));
}

function refreshLeavesUI() {
  if (els.leavesBalance) {
    els.leavesBalance.textContent = String(loadCardProgress().leaves);
  }
}

function renderFilterTabs() {
  if (els.seriesTabs) {
    const seriesOpts = [
      { id: "all", label: "全部", emoji: "📋" },
      { id: "adventurer", label: "冒險家", emoji: "🧭" },
      { id: "royal", label: "皇家", emoji: "👑" },
      { id: "hero", label: "英雄團", emoji: "🦸" },
    ];
    els.seriesTabs.innerHTML = "";
    for (const opt of seriesOpts) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "chip" + (filterSeries === opt.id ? " active" : "");
      b.textContent = `${opt.emoji} ${opt.label}`;
      b.addEventListener("click", () => {
        filterSeries = opt.id;
        renderFilterTabs();
        renderCharacterGrid();
        sfx.play("uiClick");
      });
      els.seriesTabs.appendChild(b);
    }
  }
  if (els.familyTabs) {
    const famOpts = [
      { id: "all", label: "全部", emoji: "✨" },
      { id: "warrior", label: "劍士", emoji: "⚔️" },
      { id: "mage", label: "法師", emoji: "🔮" },
      { id: "archer", label: "弓手", emoji: "🏹" },
      { id: "thief", label: "盜賊", emoji: "🥷" },
      { id: "pirate", label: "海盜", emoji: "⚓" },
    ];
    els.familyTabs.innerHTML = "";
    for (const opt of famOpts) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "chip" + (filterFamily === opt.id ? " active" : "");
      b.textContent = `${opt.emoji} ${opt.label}`;
      b.addEventListener("click", () => {
        filterFamily = opt.id;
        renderFilterTabs();
        renderCharacterGrid();
        sfx.play("uiClick");
      });
      els.familyTabs.appendChild(b);
    }
  }
}

function filteredJobIds() {
  return SPECIALIST_ORDER.filter((id) => {
    const d = SPECIALISTS[id];
    if (!d) return false;
    if (filterSeries !== "all" && (d.series || "adventurer") !== filterSeries) return false;
    if (filterFamily !== "all" && (d.family || "warrior") !== filterFamily) return false;
    return true;
  });
}

function renderUpgradePanel(typeId) {
  if (!els.upgradePanel || !els.upgradeDetail) return;
  if (!typeId || !SPECIALISTS[typeId]) {
    els.upgradePanel.classList.add("empty-detail");
    els.upgradeDetail.innerHTML = `<p class="muted center-hint">點選職業卡查看詳情與升級</p>`;
    return;
  }
  focusCardId = typeId;
  const d = SPECIALISTS[typeId];
  const lv = getCardLevel(typeId);
  const tree = getSkillTree(typeId, lv);
  const cost = getUpgradeCost(typeId, lv);
  const leaves = loadCardProgress().leaves;
  const leveled = buildLeveledDef(typeId, lv);
  const inLoadout = draftLoadout.includes(typeId);

  els.upgradePanel.classList.remove("empty-detail");
  const rows = tree
    .map(
      (s) => `
      <div class="skill-row ${s.unlocked ? "" : "locked"}">
        <span class="lv">★${s.level}</span>
        <span>
          <strong>${s.unlocked ? "✓" : "🔒"} ${s.name}</strong>
          <small>${s.desc}</small>
        </span>
      </div>`
    )
    .join("");

  const canUpgrade = lv < CARD_MAX_LEVEL && leaves >= cost;
  const upLabel =
    lv >= CARD_MAX_LEVEL ? "已滿級 ★5" : `升級 ★${lv + 1} · 🍁${cost}`;

  els.upgradeDetail.innerHTML = `
    <div class="detail-hero">
      <div class="detail-title-row">
        <img class="detail-job-icon" src="${getJobIcon(typeId, d.family)}" alt="" draggable="false" />
        <div class="detail-title">${d.nameZh}</div>
      </div>
      <div class="stars">${starsText(lv)}</div>
      <div class="detail-role">${d.role}</div>
      <div class="detail-stats">
        <span>部署 <b>${leveled.cost}</b></span>
        <span>傷害 <b>${leveled.damage}</b></span>
        <span>射程 <b>${leveled.range}</b></span>
        <span>間隔 <b>${leveled.interval}s</b></span>
      </div>
      <p class="detail-blurb">${d.blurb || ""}</p>
      <div class="detail-actions">
        <button type="button" class="btn ${inLoadout ? "danger" : "primary maple-primary"}" id="btn-detail-toggle">
          ${inLoadout ? "移出隊伍" : "加入隊伍"}
        </button>
        <button type="button" class="btn" id="btn-detail-upgrade" ${canUpgrade || lv >= CARD_MAX_LEVEL ? "" : "disabled"}>
          ${upLabel}
        </button>
      </div>
    </div>
    <div class="skill-list">${rows}</div>
  `;

  els.upgradeDetail.querySelector("#btn-detail-toggle")?.addEventListener("click", (ev) => {
    ev.preventDefault();
    void sfx.unlock();
    toggleDraftJob(typeId);
  });
  els.upgradeDetail.querySelector("#btn-detail-upgrade")?.addEventListener("click", (ev) => {
    ev.preventDefault();
    void sfx.unlock();
    if (lv >= CARD_MAX_LEVEL) return;
    const result = tryUpgradeCard(typeId);
    if (!result.ok) {
      sfx.play("error");
      showToast(result.reason || "無法升級");
      renderUpgradePanel(typeId);
      refreshLeavesUI();
      return;
    }
    sfx.play("waveClear");
    showToast(`${d.nameZh} → ★${result.level}！解鎖「${result.skill?.name || "新技能"}」`);
    renderCharacterGrid();
  });
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
  focusCardId = id;
  renderCharacterGrid();
}

function renderLoadoutSlots() {
  if (!els.loadoutPreview) return;
  els.loadoutPreview.innerHTML = "";
  for (let i = 0; i < LOADOUT_MAX; i++) {
    const id = draftLoadout[i];
    const slot = document.createElement("button");
    slot.type = "button";
    slot.className = "loadout-slot" + (id ? " filled" : "");
    if (!id) {
      slot.innerHTML = `<span class="slot-empty">+</span><small>${i + 1}</small>`;
      slot.disabled = true;
    } else {
      const d = SPECIALISTS[id];
      const lv = getCardLevel(id);
      const hero = getSpecialistPortrait(id, d);
      const c = document.createElement("canvas");
      c.width = hero.width;
      c.height = hero.height;
      const ctx = c.getContext("2d");
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(hero, 0, 0);
      slot.appendChild(c);
      const cap = document.createElement("span");
      cap.className = "slot-cap";
      cap.textContent = `${d.nameZh} ★${lv}`;
      slot.appendChild(cap);
      slot.title = "點擊移出";
      slot.addEventListener("click", () => {
        void sfx.unlock();
        toggleDraftJob(id);
      });
    }
    els.loadoutPreview.appendChild(slot);
  }
}

function renderCharacterGrid() {
  if (!els.charGrid) return;
  els.charGrid.innerHTML = "";
  if (els.loadoutCount) els.loadoutCount.textContent = String(draftLoadout.length);

  const ids = filteredJobIds();
  if (!ids.length) {
    const empty = document.createElement("p");
    empty.className = "muted center-hint";
    empty.textContent = "此篩選沒有職業，試試「全部」";
    els.charGrid.appendChild(empty);
  } else {
    for (const id of ids) {
      els.charGrid.appendChild(buildCharPickButton(id));
    }
  }

  // Keep focus valid
  if (focusCardId && !SPECIALISTS[focusCardId]) focusCardId = ids[0] || null;
  if (focusCardId && filterSeries !== "all") {
    const d = SPECIALISTS[focusCardId];
    if (d && (d.series || "adventurer") !== filterSeries && !ids.includes(focusCardId)) {
      focusCardId = ids[0] || focusCardId;
    }
  }

  refreshLeavesUI();
  renderLoadoutSlots();
  if (els.btnCharConfirm) els.btnCharConfirm.disabled = draftLoadout.length === 0;
  renderUpgradePanel(focusCardId || ids[0] || null);
}

function buildCharPickButton(id) {
  const d = SPECIALISTS[id];
  const selected = draftLoadout.includes(id);
  const focused = focusCardId === id;
  const lv = getCardLevel(id);
  const leveled = buildLeveledDef(id, lv);

  const btn = document.createElement("button");
  btn.type = "button";
  btn.className =
    "char-pick" + (selected ? " selected" : "") + (focused ? " focused" : "");
  btn.setAttribute("aria-pressed", selected ? "true" : "false");
  btn.setAttribute("role", "listitem");

  const hero = getSpecialistPortrait(id, d);
  const avatarWrap = document.createElement("div");
  avatarWrap.className = "char-avatar-wrap";
  let avatarEl;
  if (hero instanceof HTMLImageElement) {
    avatarEl = document.createElement("img");
    avatarEl.src = hero.src;
    avatarEl.alt = d.nameZh || id;
    avatarEl.draggable = false;
  } else {
    avatarEl = document.createElement("canvas");
    avatarEl.width = hero.width;
    avatarEl.height = hero.height;
    const ctx = avatarEl.getContext("2d");
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(hero, 0, 0);
  }
  avatarEl.className = "char-avatar";
  const icon = document.createElement("img");
  icon.className = "job-weapon-icon";
  icon.src = getJobIcon(id, d.family);
  icon.alt = "";
  icon.draggable = false;
  icon.loading = "lazy";
  avatarWrap.append(avatarEl, icon);

  const body = document.createElement("div");
  body.className = "char-pick-body";
  body.innerHTML = `
    <div class="job-name">${d.nameZh}</div>
    <div class="stars">${starsText(lv)}</div>
    <div class="job-meta">
      <span class="pill-cost">${leveled.cost} 點</span>
      <span class="pill-fam">${FAMILY_LABELS[d.family]?.label || ""}</span>
    </div>
    <div class="job-skill-one">${d.skill}</div>
  `;

  if (selected) {
    const badge = document.createElement("span");
    badge.className = "pick-badge";
    badge.textContent = "出戰";
    btn.appendChild(badge);
  }

  btn.append(avatarWrap, body);
  btn.addEventListener("click", () => {
    void sfx.unlock();
    // First tap focuses detail; if already focused, toggle loadout
    if (focusCardId === id) {
      toggleDraftJob(id);
    } else {
      focusCardId = id;
      sfx.play("uiClick");
      renderCharacterGrid();
    }
  });
  return btn;
}

function confirmLoadoutAndStart() {
  if (!draftLoadout.length) {
    sfx.play("error");
    showToast("至少選 1 個職業");
    return;
  }
  clearRunState();
  closeCharacterChrome();
  game.loadStage(pendingStageId);
  game.setLoadout(draftLoadout);
  hideAllOverlays();
  screen = "play";
  document.body.classList.add("in-play");
  refreshWaveIntel();
  renderSpecialistCards(game.getPublicState());
  ui.onState(game.getPublicState());
  const names = draftLoadout.map((id) => SPECIALISTS[id].nameZh).join("、");
  showToast(`出戰：${names} — 點右側職業再點地圖綠格`);
  sfx.play("waveStart");
}

function showRewards(items) {
  screen = "reward";
  if (!els.rewardList) return;
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
    btn.addEventListener("click", (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      void sfx.unlock();
      game.pickReward(item.id);
    });
    els.rewardList.appendChild(btn);
  }
  setOverlayOpen(els.rewardOverlay, true);
}

function hideRewards() {
  setOverlayOpen(els.rewardOverlay, false);
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

    // During result dialog, skip heavy DOM rebuilds (keeps victory buttons clickable).
    if (screen === "result") {
      if (els.status) els.status.textContent = state.status || "";
      if (els.leavesHud) {
        els.leavesHud.textContent = String(state.leaves ?? loadCardProgress().leaves);
      }
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
els.btnRestart?.addEventListener("click", (ev) => {
  ev.preventDefault();
  ev.stopPropagation();
  withAudio(() => {
    clearRunState();
    hideAllOverlays();
    screen = "play";
    game.reset();
    refreshWaveIntel();
    renderSpecialistCards(game.getPublicState());
    ui.onState(game.getPublicState());
    showToast("關卡重置 — 可重新部署後開始波次");
    sfx.play("uiClick");
  });
});
els.btnNextStage?.addEventListener("click", (ev) => {
  ev.preventDefault();
  ev.stopPropagation();
  withAudio(() => {
    const next = (game.stage.index ?? 0) + 1;
    if (next >= STAGES.length || !isStageUnlocked(next)) {
      showToast("尚未解鎖");
      sfx.play("error");
      return;
    }
    sfx.play("uiClick");
    clearRunState();
    pendingStageId = STAGES[next].id;
    openCharacterSelect();
  });
});
els.btnToStages?.addEventListener("click", (ev) => {
  ev.preventDefault();
  ev.stopPropagation();
  withAudio(() => {
    sfx.play("uiClick");
    clearRunState();
    // Soft reset so menu isn't stuck in win/lose flags
    if (game) {
      game.result = null;
      game.waveActive = false;
      game.pausedForReward = false;
    }
    openStageSelect();
  });
});
els.btnRepickChars?.addEventListener("click", (ev) => {
  ev.preventDefault();
  ev.stopPropagation();
  withAudio(() => {
    sfx.play("uiClick");
    clearRunState();
    pendingStageId = game.stageId || STAGES[0]?.id || "s01-victoria";
    openCharacterSelect();
  });
});

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

/** First gesture: unlock audio + start menu BGM (must stay sync for autoplay). */
const unlockOnce = () => {
  // Do NOT await before startBgm — awaiting breaks the browser gesture chain.
  void sfx.unlock();
  void sfx.preload();
  if (!sfx.muted) {
    if (screen === "play" && game?.waveActive) {
      sfx.startBgm("battle");
    } else {
      sfx.startBgm("menu");
    }
    showToast("♪ 背景音樂已開啟");
  }
  window.removeEventListener("pointerdown", unlockOnce);
  window.removeEventListener("keydown", unlockOnce);
};
window.addEventListener("pointerdown", unlockOnce, { capture: true });
window.addEventListener("keydown", unlockOnce, { capture: true });

// Preload LPC chibi portraits early
void preloadLpcPortraits(SPECIALIST_ORDER);

// If previously muted in localStorage, show it clearly
updateMuteButton(sfx.muted);
if (sfx.muted) {
  setTimeout(() => showToast("目前為靜音，點 🔊 開啟音樂"), 600);
} else {
  setTimeout(() => showToast("點一下畫面開啟背景音樂 ♪"), 500);
}
refreshWaveIntel();
renderSpecialistCards(game.getPublicState());
ui.onState(game.getPublicState());
game.start();
openStageSelect();
