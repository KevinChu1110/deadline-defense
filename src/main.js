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
import {
  canDeployJob,
  isJobUnlocked,
  getUnlockHint,
  isSeriesUnlocked,
  markJobLearned,
} from "./data/job-tree.js";
import { LOADOUT_PRESETS } from "./data/meta-progress.js";
import { sfx } from "./audio/sfx.js";
import { STAGES, loadProgress, isStageUnlocked, getStageByIndex } from "./data/stages.js";
import { getItem } from "./data/items.js";
import {
  getNickname,
  setNickname,
  getGlobalLeaderboard,
  getArenaLeaderboard,
  getStageLeaderboard,
  exportRankingJson,
} from "./data/ranking.js";
import {
  ARENA_BOSS_ROTATION,
  ARENA_BOSS_META,
  BOSSES,
  getArenaBossId,
} from "./data/bosses.js";

const canvas = document.querySelector("#game");
const els = {
  core: document.querySelector("#stat-core"),
  wave: document.querySelector("#stat-wave"),
  points: document.querySelector("#stat-points"),
  mesosHud: document.querySelector("#stat-mesos"),
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
  btnRank: document.querySelector("#btn-rank"),
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
  arenaList: document.querySelector("#arena-list"),
  nickInput: document.querySelector("#nick-input"),
  btnSaveNick: document.querySelector("#btn-save-nick"),
  rankOverlay: document.querySelector("#rank-overlay"),
  rankList: document.querySelector("#rank-list"),
  rankTabs: document.querySelector("#rank-tabs"),
  btnRankClose: document.querySelector("#btn-rank-close"),
  btnRankExport: document.querySelector("#btn-rank-export"),
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
  setOverlayOpen(els.rankOverlay, false);
}

let rankTab = "all";

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
      const starInfo = game?.lastStars;
      const starLine = starInfo
        ? `評價 ${"★".repeat(starInfo.count)}${"☆".repeat(3 - starInfo.count)}（${starInfo.stars
            .filter((s) => s.ok)
            .map((s) => s.label)
            .join(" · ")}）`
        : "";
      const scoreLine = game?.lastScore ? `分數 ${game.lastScore}` : "";
      const isArena = !!game?.stage?.arena;
      if (els.overlayCopy) {
        if (isArena) {
          els.overlayCopy.textContent = `${stageName} 勝利！${scoreLine} 已寫入競賽排行。`;
        } else {
          els.overlayCopy.textContent =
            nextIndex < STAGES.length
              ? `${stageName} 守護成功！${starLine} ${scoreLine} ${canNext ? "下一關已解鎖。" : ""}`
              : `${stageName} 完成！${starLine} ${scoreLine} 你已通關全部關卡。`;
        }
      }
      if (els.btnNextStage) {
        if (isArena) {
          els.btnNextStage.hidden = false;
          els.btnNextStage.disabled = false;
          els.btnNextStage.textContent = "再挑戰今日 Boss";
        } else {
          els.btnNextStage.hidden = nextIndex >= STAGES.length;
          els.btnNextStage.disabled = !canNext;
          els.btnNextStage.textContent = canNext
            ? `下一關：${getStageByIndex(nextIndex).name}`
            : "下一關（未解鎖）";
        }
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
  // Clearer when muted — user often thinks audio is broken
  els.btnMute.textContent = muted ? "🔇 點我開音樂" : "🔊 音樂";
  els.btnMute.setAttribute("aria-pressed", muted ? "true" : "false");
  els.btnMute.title = muted ? "目前靜音，點擊開啟背景音樂" : "點擊靜音";
}

function renderBuffs(state) {
  const chips = [];
  const b = state.buffs || {};
  if (b.attackSpeedMult > 1.01) chips.push(`⚡ 攻速 ×${b.attackSpeedMult.toFixed(2)}`);
  if (b.damageMult > 1.01) chips.push(`💥 傷害 ×${b.damageMult.toFixed(2)}`);
  if (b.armorBreak > 0) chips.push(`📎 破甲 ${(b.armorBreak * 100).toFixed(0)}%`);
  if (b.coreShield > 0) chips.push(`🛡️ 護盾 ${b.coreShield}`);
  if (b.coreSlowRadius > 0) chips.push(`📝 神木緩速`);
  for (const lab of state.synergyLabels || []) chips.push(`🔗 ${lab}`);
  if ((state.mesos || 0) > 0) chips.push(`🪙 楓幣 ${state.mesos}`);
  for (const id of state.pickedItems || []) {
    const item = getItem(id);
    if (item) chips.push(`${item.icon} ${item.nameZh}`);
  }
  if (!chips.length) {
    els.buffList.className = "buff-list muted";
    els.buffList.textContent = "打怪賺楓幣 · 場上轉職 · 職業共鳴";
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
  renderArenaList();
  syncNickInput();
}

function renderArenaList() {
  if (!els.arenaList) return;
  const today = getArenaBossId();
  els.arenaList.innerHTML = "";
  ARENA_BOSS_ROTATION.forEach((bossId) => {
    const boss = BOSSES[bossId];
    const meta = ARENA_BOSS_META[bossId] || {};
    const isToday = bossId === today;
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = `stage-btn arena-btn${isToday ? " is-today" : ""}`;
    btn.innerHTML = `
      <span class="idx arena-emoji">${meta.emoji || "⚔️"}</span>
      <span>
        <strong>${boss.nameZh}${isToday ? " · 今日推薦" : ""}</strong>
        <small>${meta.blurb || "競賽 Boss"}</small>
      </span>
      <span class="badge">${isToday ? "推薦" : "挑戰"}</span>
    `;
    btn.addEventListener("click", () => {
      void sfx.unlock();
      sfx.play("uiClick");
      pendingStageId = `arena-${bossId}`;
      openCharacterSelect();
    });
    els.arenaList.appendChild(btn);
  });
}

function syncNickInput() {
  if (els.nickInput) {
    els.nickInput.value = getNickname() || "";
    els.nickInput.placeholder = "冒險者";
  }
}

function saveNickFromInput() {
  const n = setNickname(els.nickInput?.value || "冒險者");
  if (els.nickInput) els.nickInput.value = n;
  showToast(`暱稱：${n}`);
  sfx.play("uiOk");
}

function openRankOverlay(tab = "all") {
  rankTab = tab;
  hideAllOverlays();
  renderRankList();
  setOverlayOpen(els.rankOverlay, true);
  if (els.rankTabs) {
    els.rankTabs.querySelectorAll(".rank-tab").forEach((b) => {
      b.classList.toggle("is-active", b.dataset.tab === rankTab);
    });
  }
  void sfx.unlock();
  sfx.play("uiClick");
}

function renderRankList() {
  if (!els.rankList) return;
  let rows = [];
  if (rankTab === "arena") {
    rows = getArenaLeaderboard(15).map((r) => ({
      nick: r.nick,
      score: r.score,
      detail: r.bossName || r.bossId || "競賽",
      at: r.at,
    }));
  } else if (rankTab === "stage") {
    // flatten best per stage top
    const seen = [];
    for (const st of STAGES) {
      const top = getStageLeaderboard(st.id, 3);
      for (const r of top) {
        seen.push({
          nick: r.nick,
          score: r.score,
          detail: `${st.name} ★${r.stars || 0}`,
          at: r.at,
        });
      }
    }
    rows = seen.sort((a, b) => b.score - a.score).slice(0, 15);
  } else {
    rows = getGlobalLeaderboard(15).map((r) => ({
      nick: r.nick,
      score: r.score,
      detail: r.mode === "arena" ? r.bossName || "競賽" : r.stageId || "關卡",
      at: r.at,
    }));
  }
  if (!rows.length) {
    els.rankList.innerHTML = `<p class="muted center-hint">尚無紀錄 — 通關或打競賽後寫入</p>`;
    return;
  }
  els.rankList.innerHTML = rows
    .map(
      (r, i) => `
    <div class="rank-row">
      <span class="rank-pos">${i + 1}</span>
      <span class="rank-nick">${escapeHtml(r.nick)}</span>
      <span class="rank-detail">${escapeHtml(String(r.detail || ""))}</span>
      <span class="rank-score">${r.score}</span>
    </div>`
    )
    .join("");
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
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
  // Only keep deployable jobs in draft
  const prev = game.loadout?.length ? game.loadout : DEFAULT_LOADOUT;
  draftLoadout = prev.filter((id) => canDeployJob(id));
  if (!draftLoadout.length) draftLoadout = ["beginner"];
  markJobLearned("beginner");
  if (els.loadoutMaxLabel) els.loadoutMaxLabel.textContent = String(LOADOUT_MAX);
  focusCardId = draftLoadout[0] || "beginner";
  filterSeries = "all";
  filterFamily = "all";
  renderFilterTabs();
  renderCharacterGrid();
  setOverlayOpen(els.charOverlay, true);
  document.body.classList.add("char-select-open");
  void sfx.unlock();
  void sfx.preload();
  if (!sfx.muted) sfx.startBgm("menu");
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
      const locked =
        (opt.id === "royal" && !isSeriesUnlocked("royal")) ||
        (opt.id === "hero" && !isSeriesUnlocked("hero"));
      b.textContent = locked
        ? `${opt.emoji} ${opt.label}🔒`
        : `${opt.emoji} ${opt.label}`;
      b.addEventListener("click", () => {
        filterSeries = opt.id;
        renderFilterTabs();
        renderCharacterGrid();
        sfx.play("uiClick");
      });
      els.seriesTabs.appendChild(b);
    }
    // presets row
    let presetRow = document.getElementById("preset-tabs");
    if (!presetRow && els.seriesTabs.parentElement) {
      presetRow = document.createElement("div");
      presetRow.id = "preset-tabs";
      presetRow.className = "filter-row";
      els.seriesTabs.parentElement.appendChild(presetRow);
    }
    if (presetRow) {
      presetRow.innerHTML = "";
      for (const p of LOADOUT_PRESETS) {
        const b = document.createElement("button");
        b.type = "button";
        b.className = "chip chip-preset";
        b.textContent = `💡 ${p.nameZh}`;
        b.title = p.desc;
        b.addEventListener("click", () => {
          void sfx.unlock();
          const ok = p.jobs.filter((id) => canDeployJob(id));
          if (!ok.length) {
            sfx.play("error");
            showToast("此推薦需先場上轉職學會職業：" + p.desc);
            return;
          }
          draftLoadout = ok.slice(0, LOADOUT_MAX);
          sfx.play("deploy");
          showToast(`已套用「${p.nameZh}」：${ok.map((id) => SPECIALISTS[id]?.nameZh).join("、")}`);
          renderCharacterGrid();
        });
        presetRow.appendChild(b);
      }
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

  const deployable = canDeployJob(typeId);
  const lockHint = getUnlockHint(typeId);
  const tier = d.jobTier ?? 4;
  els.upgradeDetail.innerHTML = `
    <div class="detail-hero">
      <div class="detail-title-row">
        <img class="detail-job-icon" src="${getJobIcon(typeId, d.family)}" alt="" draggable="false" />
        <div class="detail-title">${d.nameZh}</div>
      </div>
      <div class="stars">${deployable ? starsText(lv) : "🔒 " + lockHint}</div>
      <div class="detail-role">${tier === 0 ? "初心者" : `${tier} 轉`} · ${d.role}</div>
      <div class="detail-stats">
        <span>部署 <b>${leveled.cost}</b></span>
        <span>傷害 <b>${leveled.damage}</b></span>
        <span>射程 <b>${leveled.range}</b></span>
        <span>間隔 <b>${leveled.interval}s</b></span>
      </div>
      <p class="detail-blurb">${d.blurb || ""}</p>
      <div class="detail-actions">
        <button type="button" class="btn ${inLoadout ? "danger" : "primary maple-primary"}" id="btn-detail-toggle"
          ${!deployable && !inLoadout ? "disabled" : ""}>
          ${inLoadout ? "移出隊伍" : deployable ? "加入隊伍" : "未解鎖"}
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
  if (!canDeployJob(id) && !draftLoadout.includes(id)) {
    sfx.play("error");
    showToast(getUnlockHint(id));
    return;
  }
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
  const deployable = canDeployJob(id);
  const unlocked = isJobUnlocked(id);
  const lockHint = getUnlockHint(id);

  const btn = document.createElement("button");
  btn.type = "button";
  btn.className =
    "char-pick" +
    (selected ? " selected" : "") +
    (focused ? " focused" : "") +
    (!deployable ? " locked" : "");
  btn.setAttribute("aria-pressed", selected ? "true" : "false");
  btn.setAttribute("role", "listitem");
  if (!deployable) btn.title = lockHint;

  const hero = getSpecialistPortrait(id, d);
  const avatarWrap = document.createElement("div");
  avatarWrap.className = "char-avatar-wrap";
  let avatarEl;
  // Prefer <img> for AI portraits (smooth); canvas only for procedural pixels
  if (hero instanceof HTMLImageElement && hero.src) {
    avatarEl = document.createElement("img");
    avatarEl.src = hero.currentSrc || hero.src;
    avatarEl.alt = d.nameZh || id;
    avatarEl.draggable = false;
    avatarEl.loading = "lazy";
    avatarEl.decoding = "async";
  } else if (hero && (hero.width || hero.naturalWidth)) {
    avatarEl = document.createElement("canvas");
    const w = hero.naturalWidth || hero.width || 64;
    const h = hero.naturalHeight || hero.height || 64;
    avatarEl.width = w;
    avatarEl.height = h;
    const ctx = avatarEl.getContext("2d");
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(hero, 0, 0);
  } else {
    avatarEl = document.createElement("div");
    avatarEl.textContent = d.emoji || "？";
    avatarEl.style.cssText =
      "display:grid;place-items:center;width:100%;height:100%;font-size:1.6rem;background:#e8e0d0";
  }
  avatarEl.className = "char-avatar";
  avatarWrap.append(avatarEl);
  if (deployable) {
    const icon = document.createElement("img");
    icon.className = "job-weapon-icon";
    icon.src = getJobIcon(id, d.family);
    icon.alt = "";
    icon.draggable = false;
    icon.loading = "lazy";
    icon.onerror = () => {
      icon.style.display = "none";
    };
    avatarWrap.append(icon);
  }

  const body = document.createElement("div");
  body.className = "char-pick-body";
  const tier = d.jobTier ?? 4;
  const tierLabel = tier === 0 ? "初" : `${tier}轉`;
  // Keep card text short — long lock hints go in title only (prevents layout smash)
  const shortStatus = deployable
    ? d.skill
    : unlocked
      ? "場上轉職後可選"
      : tier >= 4 && (d.series === "royal" || d.series === "hero")
        ? d.series === "royal"
          ? "通關第7關"
          : "通關第9關"
        : `通關第${[0, 0, 1, 2, 4][tier] ?? 4}關`;
  body.innerHTML = `
    <div class="job-name">${d.nameZh}</div>
    <div class="stars">${deployable ? starsText(lv) : "☆☆☆☆☆"}</div>
    <div class="job-meta">
      <span class="pill-cost">${leveled.cost}點</span>
      <span class="pill-fam">${tierLabel}</span>
    </div>
    <div class="job-skill-one">${shortStatus}</div>
  `;

  if (selected) {
    const badge = document.createElement("span");
    badge.className = "pick-badge";
    badge.textContent = "出戰";
    btn.appendChild(badge);
  } else if (!deployable) {
    const badge = document.createElement("span");
    badge.className = "pick-badge lock-badge";
    badge.textContent = unlocked ? "未學會" : "鎖定";
    btn.appendChild(badge);
  }

  btn.append(avatarWrap, body);
  btn.addEventListener("click", () => {
    void sfx.unlock();
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
  showToast(`出戰：${names} — 打怪賺楓幣，點角色付幣轉職`);
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
    if (els.mesosHud) {
      els.mesosHud.textContent = String(state.mesos ?? 0);
    }
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
      ? `出戰名單：${names.join("、")}（拖到地圖綠格部署）`
      : "請先完成角色選擇";

    const selected = game.specialists.find((s) => s.id === state.selectedSpecialistId);
    if (selected) {
      renderSelectedUnitPanel(selected, state);
    } else if (state.placingType) {
      const d = SPECIALISTS[state.placingType];
      els.selectedInfo.innerHTML = `準備部署：<strong style="color:${d.color}">${d.nameZh}</strong><br/><span class="muted">拖到綠格鬆手 · 【${d.skill}】${d.blurb}</span>`;
    } else {
      els.selectedInfo.innerHTML =
        `拖職業卡到地圖部署<br/><span class="muted">點場上角色可<strong>轉職</strong>（花楓葉）</span>`;
    }

    renderSpecialistCards(state);
  },
};

function renderSelectedUnitPanel(selected, state) {
  if (!els.selectedInfo) return;
  const tier = selected.def.jobTier ?? 4;
  const opts = state.jobChangeOptions || [];
  const mesos = state.mesos ?? 0;
  let html = `<strong style="color:${selected.def.color}">${selected.def.nameZh}</strong>`;
  html += ` · ${tier === 0 ? "初心者" : `${tier} 轉`} · ${selected.def.skill}<br/>`;
  html += `<span class="muted">${selected.def.blurb}<br/>擊殺 ${selected.kills} · 賣出 +${selected.def.sellRefund}</span>`;

  if (opts.length) {
    html += `<div class="job-change-box"><div class="job-change-title">場上轉職 · 楓幣 🪙${mesos}</div>`;
    html += `<p class="muted jc-hint">打怪、清波賺楓幣（本關累積，重開關卡會重置）</p>`;
    html += `<div class="job-change-list">`;
    for (const o of opts) {
      const disabled = !o.ok ? "disabled" : "";
      const tip = o.reason || `🪙${o.cost}`;
      html += `<button type="button" class="job-change-btn" data-to="${o.id}" ${disabled}
        style="--jc:${o.color}" title="${tip}">
        <span class="jc-name">${o.nameZh}</span>
        <span class="jc-meta">${o.ok ? `🪙${o.cost}` : o.reason || "鎖定"}</span>
      </button>`;
    }
    html += `</div></div>`;
  } else {
    html += `<p class="muted job-change-max">已達轉職終點（或暫無分支）</p>`;
  }
  els.selectedInfo.innerHTML = html;
  els.selectedInfo.querySelectorAll(".job-change-btn:not([disabled])").forEach((btn) => {
    btn.addEventListener("click", (ev) => {
      ev.preventDefault();
      void sfx.unlock();
      const toId = btn.getAttribute("data-to");
      game.tryJobChange(selected.id, toId);
    });
  });
}

game = new Game(canvas, ui, STAGES[0]?.id || "s01-victoria");

/** Active drag from specialist card → map */
let cardDrag = null; // { typeId, ghost, pointerId, moved, startX, startY }

function endCardDrag(clientX, clientY, { cancel = false } = {}) {
  if (!cardDrag) return;
  const { typeId, ghost } = cardDrag;
  if (game) game._externalDrag = false;

  document.removeEventListener("pointermove", onCardDragMove);
  document.removeEventListener("pointerup", onCardDragUp);
  document.removeEventListener("pointercancel", onCardDragCancel);

  ghost?.remove();
  document.body.classList.remove("is-dragging-job");

  const moved = cardDrag.moved;
  cardDrag = null;

  if (cancel || !game || !moved) {
    // Rebuild cards if we skipped mid-drag
    if (game) renderSpecialistCards(game.getPublicState());
    return;
  }

  void sfx.unlock();
  game.setPlacing(typeId);
  const ok = game.tryDeployAtClient(typeId, clientX, clientY);
  if (!ok) {
    game.hoverPad = null;
    ui.onState(game.getPublicState());
  }
  renderSpecialistCards(game.getPublicState());
}

function onCardDragMove(e) {
  if (!cardDrag || e.pointerId !== cardDrag.pointerId) return;
  const dx = e.clientX - cardDrag.startX;
  const dy = e.clientY - cardDrag.startY;
  if (!cardDrag.moved && Math.hypot(dx, dy) > 8) {
    cardDrag.moved = true;
    document.body.classList.add("is-dragging-job");
    if (game) {
      game._externalDrag = true;
      game.setPlacing(cardDrag.typeId);
    }
  }
  if (!cardDrag.moved) return;
  e.preventDefault();
  const g = cardDrag.ghost;
  g.style.left = `${e.clientX}px`;
  g.style.top = `${e.clientY}px`;
  if (game) {
    game.updateHoverFromClient(e.clientX, e.clientY, { maxDist: 80 });
  }
}

function onCardDragUp(e) {
  if (!cardDrag || e.pointerId !== cardDrag.pointerId) return;
  const moved = cardDrag.moved;
  const typeId = cardDrag.typeId;
  if (!moved) {
    // Treat as simple click: select for place / auto-deploy toggle
    endCardDrag(e.clientX, e.clientY, { cancel: true });
    handleSpecialistCardTap(typeId);
    return;
  }
  endCardDrag(e.clientX, e.clientY);
}

function onCardDragCancel(e) {
  if (!cardDrag || e.pointerId !== cardDrag.pointerId) return;
  endCardDrag(e.clientX, e.clientY, { cancel: true });
  if (game) {
    game.setPlacing(null);
    game.hoverPad = null;
    ui.onState(game.getPublicState());
  }
}

function handleSpecialistCardTap(id) {
  if (!game || screen !== "play") return;
  const state = game.getPublicState();
  if (state.result || state.pausedForReward) return;
  const lv = getCardLevel(id);
  const leveled = buildLeveledDef(id, lv);
  const d = SPECIALISTS[id];
  if (state.points < leveled.cost) {
    sfx.play("error");
    showToast("部署點數不足");
    return;
  }
  if (state.teamCount >= (state.teamLimit ?? 6)) {
    sfx.play("error");
    showToast("場上人數已滿");
    return;
  }
  if (state.placingType === id) {
    game.tryDeployAuto();
    return;
  }
  game.setPlacing(id);
  showToast(`${d.nameZh}：拖到地圖綠格，或再點一次自動部署`);
}

function beginSpecialistDrag(e, id, d) {
  if (e.button != null && e.button !== 0) return;
  if (!game || screen !== "play") return;
  const state = game.getPublicState();
  if (state.result || state.pausedForReward) return;
  const lv = getCardLevel(id);
  const leveled = buildLeveledDef(id, lv);
  if (state.points < leveled.cost) {
    sfx.play("error");
    showToast("部署點數不足");
    return;
  }
  if (state.teamCount >= (state.teamLimit ?? 6)) {
    sfx.play("error");
    showToast("場上人數已滿");
    return;
  }

  void sfx.unlock();
  e.preventDefault();

  const ghost = document.createElement("div");
  ghost.className = "drag-ghost";
  ghost.setAttribute("aria-hidden", "true");
  const portrait = getSpecialistPortrait(id, d);
  const gCanvas = document.createElement("canvas");
  gCanvas.width = portrait.width || 64;
  gCanvas.height = portrait.height || 64;
  const gctx = gCanvas.getContext("2d");
  gctx.imageSmoothingEnabled = true;
  try {
    gctx.drawImage(portrait, 0, 0, gCanvas.width, gCanvas.height);
  } catch {
    /* ignore */
  }
  const label = document.createElement("span");
  label.textContent = d.nameZh;
  ghost.append(gCanvas, label);
  ghost.style.left = `${e.clientX}px`;
  ghost.style.top = `${e.clientY}px`;
  document.body.appendChild(ghost);

  cardDrag = {
    typeId: id,
    ghost,
    pointerId: e.pointerId,
    moved: false,
    startX: e.clientX,
    startY: e.clientY,
  };

  document.addEventListener("pointermove", onCardDragMove, { passive: false });
  document.addEventListener("pointerup", onCardDragUp);
  document.addEventListener("pointercancel", onCardDragCancel);
}

function renderSpecialistCards(state) {
  if (!els.specialistList || !game) return;
  // Don't rebuild cards mid-drag (would kill the pointer target)
  if (cardDrag) return;

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
    btn.title = "按住拖到地圖綠格部署";

    const portrait = getSpecialistPortrait(id, d);
    const img = document.createElement("canvas");
    img.width = portrait.width;
    img.height = portrait.height;
    img.className = "portrait";
    const ictx = img.getContext("2d");
    ictx.imageSmoothingEnabled = true;
    ictx.drawImage(portrait, 0, 0);

    const text = document.createElement("span");
    const lastSkill = (leveled.skillNames || [d.skill]).slice(-1)[0];
    text.innerHTML = `<strong>${d.nameZh} ★${lv}</strong><small>${lastSkill} · 傷${leveled.damage} · 拖曳部署</small>`;

    const cost = document.createElement("span");
    cost.className = "cost";
    cost.textContent = String(leveled.cost);

    btn.append(img, text, cost);

    if (!cantAfford && !teamFull && !blocked) {
      btn.addEventListener("pointerdown", (e) => beginSpecialistDrag(e, id, d));
    } else {
      btn.addEventListener("click", () => {
        if (cantAfford) showToast("部署點數不足");
        else if (teamFull) showToast("場上人數已滿");
      });
    }
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
    // 競賽：再打今日推薦 Boss
    if (game?.stage?.arena) {
      sfx.play("uiClick");
      clearRunState();
      pendingStageId = `arena-${getArenaBossId()}`;
      openCharacterSelect();
      return;
    }
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
els.btnRank?.addEventListener("click", () =>
  withAudio(() => {
    openRankOverlay(rankTab || "all");
  })
);
els.btnRankClose?.addEventListener("click", () =>
  withAudio(() => {
    sfx.play("uiClick");
    setOverlayOpen(els.rankOverlay, false);
    if (screen === "stage" || !game || game.result) openStageSelect();
  })
);
els.btnRankExport?.addEventListener("click", () =>
  withAudio(() => {
    sfx.play("uiClick");
    try {
      const json = exportRankingJson();
      const blob = new Blob([json], { type: "application/json" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `maple-defense-rank-${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(a.href);
      showToast("已匯出排行 JSON");
    } catch {
      showToast("匯出失敗");
      sfx.play("error");
    }
  })
);
els.rankTabs?.addEventListener("click", (ev) => {
  const t = ev.target.closest(".rank-tab");
  if (!t) return;
  withAudio(() => {
    rankTab = t.dataset.tab || "all";
    els.rankTabs.querySelectorAll(".rank-tab").forEach((b) => {
      b.classList.toggle("is-active", b.dataset.tab === rankTab);
    });
    renderRankList();
    sfx.play("uiClick");
  });
});
els.btnSaveNick?.addEventListener("click", () => withAudio(saveNickFromInput));
els.nickInput?.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    withAudio(saveNickFromInput);
  }
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
