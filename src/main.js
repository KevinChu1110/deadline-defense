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
import { LOADOUT_PRESETS, loadStars } from "./data/meta-progress.js";
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
import {
  listSaveSlots,
  switchToSlot,
  createOrOpenSlot,
  deleteSlot,
  flushActiveSlot,
  getActiveSlotIndex,
  formatSlotTime,
  ensureSaveSlotsMigrated,
  SLOT_COUNT,
} from "./data/save-slots.js";

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
  btnHelp: document.querySelector("#btn-help"),
  btnPause: document.querySelector("#btn-pause"),
  btnPauseSide: document.querySelector("#btn-pause-side"),
  btnHelpSide: document.querySelector("#btn-help-side"),
  pauseOverlay: document.querySelector("#pause-overlay"),
  helpOverlay: document.querySelector("#help-overlay"),
  btnResume: document.querySelector("#btn-resume"),
  btnPauseHelp: document.querySelector("#btn-pause-help"),
  btnPauseStages: document.querySelector("#btn-pause-stages"),
  btnHelpClose: document.querySelector("#btn-help-close"),
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
  btnContinue: document.querySelector("#btn-continue"),
  btnStartGame: document.querySelector("#btn-start-game"),
  btnCampaignBack: document.querySelector("#btn-campaign-back"),
  campaignPanel: document.querySelector("#campaign-panel"),
  titleScreen: document.querySelector("#title-screen"),
  campaignStepTitle: document.querySelector("#campaign-step-title"),
  campaignStepSub: document.querySelector("#campaign-step-sub"),
  btnWizardNextMode: document.querySelector("#btn-wizard-next-mode"),
  btnModeCampaign: document.querySelector("#btn-mode-campaign"),
  btnModeRaid: document.querySelector("#btn-mode-raid"),
  wizardStepSave: document.querySelector("#wizard-step-save"),
  wizardStepMode: document.querySelector("#wizard-step-mode"),
  wizardStepStages: document.querySelector("#wizard-step-stages"),
  wizardStepRaid: document.querySelector("#wizard-step-raid"),
  wizardDots: document.querySelectorAll(".wizard-dot"),
  btnHomeRank: document.querySelector("#btn-home-rank"),
  btnHomeGuide: document.querySelector("#btn-home-guide"),
  homeLeaves: document.querySelector("#home-leaves"),
  saveSlotList: document.querySelector("#save-slot-list"),
  guideOverlay: document.querySelector("#guide-overlay"),
  guideTabs: document.querySelector("#guide-tabs"),
  guideBody: document.querySelector("#guide-body"),
  btnGuideClose: document.querySelector("#btn-guide-close"),
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
  combatHud: document.querySelector("#combat-hud"),
  bossHudList: document.querySelector("#boss-hud-list"),
  placeHint: document.querySelector("#place-hint"),
  controlStrip: document.querySelector("#control-strip"),
  coreHitFlash: document.querySelector("#core-hit-flash"),
  dialogOverlay: document.querySelector("#dialog-overlay"),
  dialogKicker: document.querySelector("#dialog-kicker"),
  dialogTitle: document.querySelector("#dialog-title"),
  dialogMessage: document.querySelector("#dialog-message"),
  dialogInputWrap: document.querySelector("#dialog-input-wrap"),
  dialogInput: document.querySelector("#dialog-input"),
  dialogCancel: document.querySelector("#dialog-cancel"),
  dialogOk: document.querySelector("#dialog-ok"),
};

/** Campaign wizard: 1 save → 2 mode → 3 stages|raid */
let wizardStep = 1;
let wizardMode = "campaign"; // campaign | raid
let dialogResolver = null;

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
  setOverlayOpen(els.pauseOverlay, false);
  setOverlayOpen(els.helpOverlay, false);
  setOverlayOpen(els.guideOverlay, false);
  setOverlayOpen(els.dialogOverlay, false);
}

/**
 * Maple-styled in-game dialog (replaces window.prompt / confirm).
 * @param {{ title?: string, message?: string, kicker?: string, defaultValue?: string, showInput?: boolean, okText?: string, cancelText?: string, danger?: boolean }} opts
 * @returns {Promise<string|boolean|null>} input string | true/false for confirm | null if cancel on prompt
 */
function openDialog(opts = {}) {
  const {
    title = "提示",
    message = "",
    kicker = "提示",
    defaultValue = "",
    showInput = false,
    okText = "確定",
    cancelText = "取消",
    danger = false,
  } = opts;

  return new Promise((resolve) => {
    // close previous
    if (dialogResolver) {
      dialogResolver(showInput ? null : false);
      dialogResolver = null;
    }
    dialogResolver = resolve;
    if (els.dialogKicker) els.dialogKicker.textContent = kicker;
    if (els.dialogTitle) els.dialogTitle.textContent = title;
    if (els.dialogMessage) {
      els.dialogMessage.textContent = message;
      els.dialogMessage.hidden = !message;
    }
    if (els.dialogInputWrap) els.dialogInputWrap.hidden = !showInput;
    if (els.dialogInput) {
      els.dialogInput.value = defaultValue;
      els.dialogInput.hidden = !showInput;
    }
    if (els.dialogOk) {
      els.dialogOk.textContent = okText;
      els.dialogOk.classList.toggle("danger", !!danger);
      els.dialogOk.classList.toggle("primary", !danger);
      els.dialogOk.classList.toggle("maple-primary", !danger);
    }
    if (els.dialogCancel) els.dialogCancel.textContent = cancelText;
    setOverlayOpen(els.dialogOverlay, true);
    sfx.play("uiClick");
    if (showInput) {
      setTimeout(() => {
        els.dialogInput?.focus();
        els.dialogInput?.select();
      }, 40);
    } else {
      els.dialogOk?.focus();
    }
  });
}

function closeDialog(result) {
  const r = dialogResolver;
  dialogResolver = null;
  setOverlayOpen(els.dialogOverlay, false);
  if (r) r(result);
}

function promptNick(defaultName = "冒險者") {
  return openDialog({
    kicker: "新存檔",
    title: "冒險者暱稱",
    message: "幫這筆存檔取個名字吧",
    showInput: true,
    defaultValue: defaultName,
    okText: "開新局",
    cancelText: "取消",
  }).then((v) => {
    if (v == null) return null;
    const name = String(v).trim().slice(0, 12);
    return name || defaultName;
  });
}

function confirmDialog(title, message, { okText = "確定", danger = false } = {}) {
  return openDialog({
    kicker: "確認",
    title,
    message,
    showInput: false,
    okText,
    cancelText: "取消",
    danger,
  });
}

const HELP_SEEN_KEY = "deadline-defense-help-seen-v1";

function hasSeenHelp() {
  try {
    return localStorage.getItem(HELP_SEEN_KEY) === "1";
  } catch {
    return false;
  }
}

function markHelpSeen() {
  try {
    localStorage.setItem(HELP_SEEN_KEY, "1");
  } catch {
    /* ignore */
  }
}

function openHelpOverlay({ fromPause = false } = {}) {
  // 從暫停開啟時不要關 pause 底下的凍結，只疊 help
  setOverlayOpen(els.helpOverlay, true);
  if (!fromPause) {
    // 戰鬥中開說明 → 自動暫停
    if (game && screen === "play" && !game.result && !game.pausedForReward) {
      game.setPaused(true);
      setOverlayOpen(els.pauseOverlay, true);
    }
  }
  sfx.play("uiClick");
}

function closeHelpOverlay() {
  markHelpSeen();
  setOverlayOpen(els.helpOverlay, false);
  sfx.play("uiClick");
}

function openPauseOverlay() {
  if (!game || screen !== "play" || game.result) return;
  game.setPaused(true);
  setOverlayOpen(els.pauseOverlay, true);
}

function closePauseOverlay({ resume = true } = {}) {
  setOverlayOpen(els.pauseOverlay, false);
  setOverlayOpen(els.helpOverlay, false);
  if (resume && game) game.setPaused(false);
}

let rankTab = "all";

/** Clear end-of-run flags so menus work after victory/defeat. */
function clearRunState() {
  if (!game) return;
  game.result = null;
  game.waveActive = false;
  game.paused = false;
  game.pausedForReward = false;
  game.pendingRewardChoices = null;
}

function showResult(kind) {
  try {
    screen = "result";
    flushActiveSlot();
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
  els.stageTitle.textContent = `${game.stage.name} · 楓之谷防衛戰`;
  els.footerStage.textContent = `STAGE ${String((game.stage.index ?? 0) + 1).padStart(2, "0")} // ${game.stage.code}`;
  els.briefing.textContent = game.stage.briefing;
}

/** 地區卡片主色（台服地名感） */
const STAGE_ACCENTS = {
  VICTORIA: ["#7eb8e8", "#4a8a40"],
  PERION: ["#c4a574", "#a84a3c"],
  ELLINIA: ["#5b8c5a", "#2d5a3d"],
  ORBIS: ["#a5b4fc", "#6366f1"],
  SKY: ["#c7d2fe", "#818cf8"],
  ELNATH: ["#bae6fd", "#38bdf8"],
  AQUA: ["#22d3ee", "#0369a1"],
  LUDI: ["#f9a8d4", "#fb923c"],
  LEAFRE: ["#a3e635", "#3f6212"],
  TEMPLE: ["#c084fc", "#4c1d95"],
  ALTAR: ["#fca5a5", "#7f1d1d"],
};

function getStarsForStage(stageId) {
  const data = loadStars();
  return Math.min(3, Number(data?.[stageId] || 0));
}

function renderStageList() {
  if (!els.stageList) return;
  flushActiveSlot();
  const progress = loadProgress();
  els.stageList.innerHTML = "";
  // 下一個可挑戰
  let nextIdx = STAGES.findIndex((_, i) => isStageUnlocked(i, progress) && !progress.cleared[STAGES[i].id]);
  if (nextIdx < 0) nextIdx = Math.min(STAGES.length - 1, (progress.unlocked || 1) - 1);

  STAGES.forEach((stage, i) => {
    const unlocked = isStageUnlocked(i, progress);
    const cleared = !!progress.cleared[stage.id];
    const stars = getStarsForStage(stage.id);
    const isNext = i === nextIdx && unlocked;
    const colors = STAGE_ACCENTS[stage.code] || STAGE_ACCENTS.VICTORIA;
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = `stage-card-btn${isNext ? " is-next" : ""}`;
    btn.disabled = !unlocked;
    btn.style.setProperty("--sc-a", colors[0]);
    btn.style.setProperty("--sc-b", colors[1]);
    const starStr = cleared || stars ? "★".repeat(stars) + "☆".repeat(Math.max(0, 3 - stars)) : "";
    btn.innerHTML = `
      <span class="stage-card-accent">${String(i + 1).padStart(2, "0")}</span>
      <span class="stage-card-body">
        <strong>${stage.name}</strong>
        <small>${stage.briefing}</small>
        <span class="stage-card-meta">
          <span class="badge ${!unlocked ? "locked" : cleared ? "cleared" : ""}">
            ${!unlocked ? "🔒 未解鎖" : cleared ? "✓ 已通關" : isNext ? "▶ 下一關" : "可挑戰"}
          </span>
          ${starStr ? `<span class="stars">${starStr}</span>` : ""}
        </span>
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
  syncNickInput();
  refreshHomeMeta(progress, nextIdx);
}

function getNextStageId(progress = loadProgress()) {
  let nextIdx = STAGES.findIndex((_, i) => isStageUnlocked(i, progress) && !progress.cleared[STAGES[i].id]);
  if (nextIdx < 0) nextIdx = Math.min(STAGES.length - 1, (progress.unlocked || 1) - 1);
  return STAGES[Math.max(0, nextIdx)]?.id || STAGES[0]?.id;
}

function hasAnyProgress(progress = loadProgress()) {
  return (progress.unlocked || 1) > 1 || Object.keys(progress.cleared || {}).length > 0;
}

function refreshHomeMeta(progress = loadProgress(), nextIdx = 0) {
  if (els.homeLeaves) {
    els.homeLeaves.textContent = String(loadCardProgress().leaves || 0);
  }
  if (els.btnContinue) {
    const stage = STAGES[Math.max(0, nextIdx)] || STAGES[0];
    const show = hasAnyProgress(progress) && !!stage;
    els.btnContinue.hidden = !show;
    if (show) {
      els.btnContinue.textContent = `↻ 繼續遊戲 · ${stage.name}`;
      els.btnContinue.dataset.stageId = stage.id;
    }
  }
}

/** 遠征 Boss — 橫向關卡卡（接近貓咪大戰爭選關感） */
function renderArenaList() {
  if (!els.arenaList) return;
  const today = getArenaBossId();
  els.arenaList.innerHTML = "";
  ARENA_BOSS_ROTATION.forEach((bossId, i) => {
    const boss = BOSSES[bossId];
    if (!boss) return;
    const meta = ARENA_BOSS_META[bossId] || {};
    const isToday = bossId === today;
    const tier = meta.tier || "?";
    const stars =
      tier === "SSS" ? "★★★★★" : tier === "SS" ? "★★★★☆" : tier === "S+" ? "★★★☆☆" : "★★☆☆☆";
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = `raid-stage-card${isToday ? " is-today" : ""}${tier === "SSS" ? " is-sss" : ""}`;
    btn.innerHTML = `
      <span class="raid-stage-no">${String(i + 1).padStart(2, "0")}</span>
      <span class="raid-stage-emoji">${meta.emoji || "🐉"}</span>
      <span class="raid-stage-body">
        <strong>${escapeHtml(boss.nameZh)}</strong>
        <small>${escapeHtml(meta.regionZh || boss.regionZh || "")} · ${stars}</small>
        <em class="raid-stage-blurb">${escapeHtml(meta.blurb || "3 波速決 · 寫入排行")}</em>
      </span>
      <span class="raid-stage-go">
        <span class="raid-tier${tier === "SSS" ? " sss" : ""}">${escapeHtml(tier)}${isToday ? " · 今日" : ""}</span>
        <span class="raid-go-label">出戰 ▶</span>
      </span>
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
  flushActiveSlot();
  renderSaveSlots();
  showToast(`暱稱：${n}`);
  sfx.play("uiOk");
}

async function openOrCreateSlot(i, slot) {
  if (slot.empty) {
    const name = await promptNick(`冒險者 ${i + 1}`);
    if (name == null) return false;
    createOrOpenSlot(i, name);
  } else {
    switchToSlot(i);
  }
  syncNickInput();
  refreshHomeMeta();
  if (wizardStep >= 3 && wizardMode === "campaign") renderStageList();
  else if (wizardStep >= 3 && wizardMode === "raid") renderArenaList();
  showToast(`存檔 ${i + 1}`);
  sfx.play("uiOk");
  return true;
}

function renderSaveSlots() {
  if (!els.saveSlotList) return;
  ensureSaveSlotsMigrated();
  const slots = listSaveSlots();
  const active = getActiveSlotIndex();
  els.saveSlotList.innerHTML = "";
  slots.forEach((slot, i) => {
    const row = document.createElement("div");
    row.className = `save-slot${i === active ? " is-active" : ""}${slot.empty ? " is-empty" : ""}`;
    const title = slot.empty ? `空存檔 ${i + 1}` : slot.name || `存檔 ${i + 1}`;
    const detail = slot.empty
      ? "點「開新局」開始冒險"
      : `通關 ${slot.clearedCount} · 解鎖至第 ${slot.unlocked} 關 · 🍁${slot.leaves} · ★${slot.starsTotal} · ${formatSlotTime(slot.updatedAt)}`;
    row.innerHTML = `
      <span class="save-slot-idx">${i + 1}</span>
      <span class="save-slot-body">
        <strong>${escapeHtml(title)}${i === active ? " · 使用中" : ""}</strong>
        <small>${escapeHtml(detail)}</small>
      </span>
      <span class="save-slot-actions">
        <button type="button" class="btn primary maple-primary" data-act="open" data-i="${i}">
          ${slot.empty ? "開新局" : i === active ? "使用中" : "讀取"}
        </button>
        ${
          slot.empty
            ? ""
            : `<button type="button" class="btn danger" data-act="del" data-i="${i}">刪除</button>`
        }
      </span>
    `;
    row.querySelectorAll("button").forEach((btn) => {
      btn.addEventListener("click", (ev) => {
        ev.stopPropagation();
        const act = btn.getAttribute("data-act");
        const idx = Number(btn.getAttribute("data-i"));
        withAudio(async () => {
          if (act === "open") {
            await openOrCreateSlot(idx, slot);
          } else if (act === "del") {
            const ok = await confirmDialog(
              `刪除存檔 ${idx + 1}？`,
              "此操作無法復原，進度與楓葉都會消失。",
              { okText: "刪除", danger: true }
            );
            if (!ok) return;
            deleteSlot(idx);
            syncNickInput();
            refreshHomeMeta();
            renderSaveSlots();
            showToast(`已刪除存檔 ${idx + 1}`);
            sfx.play("uiClick");
          }
        });
      });
    });
    row.addEventListener("click", (ev) => {
      if (ev.target.closest("button")) return;
      withAudio(async () => {
        await openOrCreateSlot(i, slot);
      });
    });
    els.saveSlotList.appendChild(row);
  });
}

const WIZARD_META = {
  1: { title: "選擇存檔", sub: "第 1／3 步 · 冒險者資料" },
  2: { title: "選擇模式", sub: "第 2／3 步 · 戰役或遠征" },
  3: {
    campaign: { title: "選擇關卡", sub: "第 3／3 步 · 地區戰役" },
    raid: { title: "選擇 Boss", sub: "第 3／3 步 · 遠征出戰" },
  },
};

function setWizardStep(step, mode = wizardMode) {
  wizardStep = step;
  if (mode) wizardMode = mode;

  const meta =
    step === 3
      ? WIZARD_META[3][wizardMode] || WIZARD_META[3].campaign
      : WIZARD_META[step] || WIZARD_META[1];
  if (els.campaignStepTitle) els.campaignStepTitle.textContent = meta.title;
  if (els.campaignStepSub) els.campaignStepSub.textContent = meta.sub;

  els.wizardDots?.forEach((d) => {
    const n = Number(d.dataset.step);
    d.classList.toggle("is-active", n === step);
    d.classList.toggle("is-done", n < step);
  });

  if (els.wizardStepSave) els.wizardStepSave.hidden = step !== 1;
  if (els.wizardStepMode) els.wizardStepMode.hidden = step !== 2;
  if (els.wizardStepStages) els.wizardStepStages.hidden = !(step === 3 && wizardMode === "campaign");
  if (els.wizardStepRaid) els.wizardStepRaid.hidden = !(step === 3 && wizardMode === "raid");

  if (step === 1) renderSaveSlots();
  if (step === 3 && wizardMode === "campaign") renderStageList();
  if (step === 3 && wizardMode === "raid") renderArenaList();
}

const GUIDE_PAGES = {
  play: `
    <h3>🎯 玩法目標</h3>
    <p>怪物會沿路徑攻向<strong>神木</strong>。部署職業清怪，別讓神木血量歸零。</p>
    <ul>
      <li>每關 10 波；第 5／10 波通常有 Boss</li>
      <li>擊殺與清波賺<strong>局內楓幣</strong>，用來場上轉職</li>
      <li>帳號<strong>楓葉</strong>用來升級職業卡（編隊畫面）</li>
      <li>通關解鎖下一地區；三星評價有額外楓葉</li>
    </ul>
    <div class="guide-tip">💡 漏怪會扣神木；Boss 還會遠程攻擊神木，注意上方血條的「下一招」。</div>
  `,
  job: `
    <h3>⚔️ 轉職路線（台服）</h3>
    <p>場上點角色，用楓幣轉下一階。路線對齊冒險家一～四轉。</p>
    <ul>
      <li><strong>劍士</strong>：狂戰士→十字軍→英雄／見習騎士→騎士→聖騎士／槍騎兵→龍騎士→黑騎士</li>
      <li><strong>法師</strong>：僧侶→祭司→主教；火毒／冰雷大魔導</li>
      <li><strong>弓箭手</strong>：獵人→遊俠→箭神；弩弓手→狙擊手→神射手</li>
      <li><strong>盜賊</strong>：刺客→暗殺者→夜使者；俠盜→神偷→暗影神偷</li>
      <li><strong>海盜</strong>：打手→格鬥家→拳霸；槍手→神槍手→槍神</li>
    </ul>
    <div class="guide-tip">💡 破隱靠神射／主教線；破甲靠黑騎／槍神／狂狼等。</div>
  `,
  boss: `
    <h3>🐉 五大遠征 Boss</h3>
    <ul>
      <li><strong>海怒斯</strong>（水世界）物理無效、嘴炮、火柱、千斤墜</li>
      <li><strong>拉圖斯</strong>（玩具城）時空暫停、反射、吸取血魔</li>
      <li><strong>殘暴炎魔</strong>（冰原）八臂封印、火柱、魔方回血</li>
      <li><strong>暗黑龍王</strong>（神木村）劇毒、連鎖閃電、龍息</li>
      <li><strong>皮卡啾</strong>（時間神殿 · 最難）封印、反盾、花瓣、狂暴</li>
    </ul>
    <div class="guide-tip">💡 蓄力時畫面會有圈／警告；被暈／沉默的職業頭上會顯示秒數。</div>
  `,
  control: `
    <h3>👆 操作手勢</h3>
    <ul>
      <li>點職業卡 → 點綠格部署；拖曳亦可</li>
      <li>再點同一張卡 = 自動放到空格</li>
      <li>點空地或 Esc = 取消部署</li>
      <li>點場上角色 = 轉職選單</li>
      <li><strong>Space</strong> 暫停 · <strong>Enter</strong> 開始波次 · <strong>H / ?</strong> 說明</li>
      <li>1–4 選出戰卡 · M 靜音</li>
    </ul>
    <div class="guide-tip">💡 「開始遊戲」為三步：存檔 → 模式（地區／遠征）→ 選關出戰。</div>
  `,
};

let guideTab = "play";

function openGuideOverlay(tab = "play") {
  guideTab = tab;
  if (els.guideTabs) {
    els.guideTabs.querySelectorAll(".guide-tab").forEach((b) => {
      b.classList.toggle("is-active", b.dataset.guide === guideTab);
    });
  }
  if (els.guideBody) {
    els.guideBody.innerHTML = GUIDE_PAGES[guideTab] || GUIDE_PAGES.play;
  }
  setOverlayOpen(els.guideOverlay, true);
  sfx.play("uiClick");
}

function closeGuideOverlay() {
  setOverlayOpen(els.guideOverlay, false);
  sfx.play("uiClick");
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

function setCampaignPanelOpen(open) {
  if (!els.campaignPanel) return;
  els.campaignPanel.hidden = !open;
  if (els.titleScreen) {
    els.titleScreen.style.visibility = open ? "hidden" : "visible";
  }
}

/** 主選單（大背景 + 四顆按鈕） */
function openTitleScreen() {
  screen = "stage";
  closeCharacterChrome();
  document.body.classList.remove("in-play");
  document.body.classList.add("home-open");
  hideAllOverlays();
  flushActiveSlot();
  setCampaignPanelOpen(false);
  // 只刷新繼續按鈕／楓葉，不把關卡列表塞進主畫面
  const progress = loadProgress();
  let nextIdx = STAGES.findIndex((_, i) => isStageUnlocked(i, progress) && !progress.cleared[STAGES[i].id]);
  if (nextIdx < 0) nextIdx = Math.min(STAGES.length - 1, (progress.unlocked || 1) - 1);
  refreshHomeMeta(progress, nextIdx);
  setOverlayOpen(els.stageOverlay, true);
  void sfx.unlock();
  if (!sfx.muted) sfx.startBgm("menu");
  if (game) ui.onState(game.getPublicState());
}

/** 開始遊戲 → 三階段精靈（存檔 → 模式 → 關卡/Boss） */
function openCampaignPanel(startStep = 1) {
  screen = "stage";
  closeCharacterChrome();
  document.body.classList.remove("in-play");
  document.body.classList.add("home-open");
  hideAllOverlays();
  flushActiveSlot();
  setCampaignPanelOpen(true);
  setOverlayOpen(els.stageOverlay, true);
  setWizardStep(startStep);
  void sfx.unlock();
  if (!sfx.muted) sfx.startBgm("menu");
  sfx.play("uiClick");
  if (game) ui.onState(game.getPublicState());
}

function handleCampaignBack() {
  if (wizardStep === 3) {
    setWizardStep(2);
    sfx.play("uiClick");
    return;
  }
  if (wizardStep === 2) {
    setWizardStep(1);
    sfx.play("uiClick");
    return;
  }
  openTitleScreen();
}

/** 相容舊呼叫：回主選單 */
function openStageSelect() {
  openTitleScreen();
}

function openCharacterSelect() {
  if (!game) return;
  screen = "char";
  document.body.classList.remove("home-open");
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
  const portrait = getSpecialistPortrait(typeId, d);
  let portraitSrc = "";
  if (portrait instanceof HTMLImageElement && portrait.src) {
    portraitSrc = portrait.currentSrc || portrait.src;
  }
  const portraitHtml = portraitSrc
    ? `<div class="detail-portrait-stage">
        <div class="detail-portrait-wrap">
          <img class="detail-portrait" src="${portraitSrc}" alt="${d.nameZh}" draggable="false" />
          <span class="detail-portrait-shadow" aria-hidden="true"></span>
        </div>
        <div class="detail-portrait-base" aria-hidden="true"></div>
      </div>`
    : `<div class="detail-portrait-stage">
        <div class="detail-portrait-wrap" style="display:grid;place-items:center;font-size:2.4rem">${d.emoji || "？"}</div>
        <div class="detail-portrait-base" aria-hidden="true"></div>
      </div>`;

  els.upgradeDetail.innerHTML = `
    <div class="detail-hero">
      ${portraitHtml}
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
    ids.forEach((id, i) => {
      els.charGrid.appendChild(buildCharPickButton(id, i));
    });
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

function buildCharPickButton(id, index = 0) {
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
  btn.style.setProperty("--bob-delay", `${(index % 8) * 0.12}s`);
  btn.setAttribute("aria-pressed", selected ? "true" : "false");
  btn.setAttribute("role", "listitem");
  if (!deployable) btn.title = lockHint;

  const hero = getSpecialistPortrait(id, d);

  // 站台 + 人物（像角色視窗）
  const stage = document.createElement("div");
  stage.className = "char-stage";

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

  const footShadow = document.createElement("span");
  footShadow.className = "char-foot-shadow";
  footShadow.setAttribute("aria-hidden", "true");

  avatarWrap.append(avatarEl, footShadow);
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

  const stageBase = document.createElement("div");
  stageBase.className = "char-stage-base";
  stageBase.setAttribute("aria-hidden", "true");
  stage.append(avatarWrap, stageBase);

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

  // hover 星光
  for (const cls of ["s1", "s2", "s3"]) {
    const spark = document.createElement("span");
    spark.className = `char-spark ${cls}`;
    spark.setAttribute("aria-hidden", "true");
    btn.appendChild(spark);
  }

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

  btn.append(stage, body);

  // hover 微音效 + 輕微 3D tilt（節流）
  let hoverArmed = true;
  btn.addEventListener("pointerenter", () => {
    if (!hoverArmed || !deployable) return;
    hoverArmed = false;
    sfx.play("uiHover");
    setTimeout(() => {
      hoverArmed = true;
    }, 180);
  });
  btn.addEventListener("pointermove", (ev) => {
    if (!deployable) return;
    const r = btn.getBoundingClientRect();
    const px = (ev.clientX - r.left) / r.width - 0.5;
    const py = (ev.clientY - r.top) / r.height - 0.5;
    btn.style.setProperty("--tilt-y", `${px * 10}deg`);
    btn.style.setProperty("--tilt-x", `${-py * 8}deg`);
  });
  btn.addEventListener("pointerleave", () => {
    btn.style.setProperty("--tilt-x", "0deg");
    btn.style.setProperty("--tilt-y", "0deg");
  });
  btn.addEventListener("click", () => {
    void sfx.unlock();
    if (focusCardId === id) {
      toggleDraftJob(id);
    } else {
      focusCardId = id;
      sfx.play("uiSelect");
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
  document.body.classList.remove("home-open");
  refreshWaveIntel();
  renderSpecialistCards(game.getPublicState());
  ui.onState(game.getPublicState());
  const names = draftLoadout.map((id) => SPECIALISTS[id].nameZh).join("、");
  showToast(`出戰：${names} — 打怪賺楓幣，點角色付幣轉職`);
  sfx.play("waveStart");
  // 首次進戰鬥：自動開說明
  if (!hasSeenHelp()) {
    setTimeout(() => {
      if (screen === "play" && game && !game.result) openHelpOverlay();
    }, 400);
  }
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

function renderCombatHud(state) {
  const show = screen === "play" && !state.result;
  if (els.combatHud) {
    els.combatHud.hidden = !show;
  }
  if (!show) return;

  // Boss bars
  if (els.bossHudList) {
    const bosses = state.bossHud || [];
    if (!bosses.length) {
      els.bossHudList.innerHTML = "";
    } else {
      els.bossHudList.innerHTML = bosses
        .map((b) => {
          const pct = Math.max(0, Math.min(100, (b.ratio || 0) * 100));
          const next = b.next;
          let nextHtml = `<span class="boss-next muted">—</span>`;
          if (next) {
            const nt = next.casting
              ? `施放中 ${next.t.toFixed(1)}s`
              : `${next.t.toFixed(1)}s 後`;
            nextHtml = `<span class="boss-next${next.casting ? " is-casting" : ""}" style="--nc:${next.color || b.color}">
              <strong>${escapeHtml(next.name)}</strong>
              <em>${nt}</em>
            </span>`;
          }
          const flags = [
            b.immune ? `<span class="boss-flag immune">無效</span>` : "",
            b.reflect ? `<span class="boss-flag reflect">反射</span>` : "",
          ].join("");
          return `<div class="boss-hud-card" style="--bc:${b.color || "#fca5a5"}">
            <div class="boss-hud-top">
              <strong class="boss-hud-name">${escapeHtml(b.name)}</strong>
              <span class="boss-hud-hp">${Math.ceil(b.hp)} / ${Math.ceil(b.maxHp)}</span>
              ${flags}
            </div>
            <div class="boss-hp-track"><div class="boss-hp-fill" style="width:${pct}%"></div></div>
            <div class="boss-hud-skill">${nextHtml}</div>
          </div>`;
        })
        .join("");
    }
  }

  // Place hint
  if (els.placeHint) {
    if (state.placingHint) {
      els.placeHint.hidden = false;
      els.placeHint.textContent = state.placingHint;
    } else {
      els.placeHint.hidden = true;
    }
  }

  // Control strip
  if (els.controlStrip) {
    const ctrls = state.controlHud || [];
    if (!ctrls.length) {
      els.controlStrip.hidden = true;
      els.controlStrip.innerHTML = "";
    } else {
      els.controlStrip.hidden = false;
      els.controlStrip.innerHTML = ctrls
        .map((c) => {
          const parts = [];
          if (c.stun > 0) parts.push(`暈 ${c.stun.toFixed(1)}s`);
          if (c.silence > 0) parts.push(`默 ${c.silence.toFixed(1)}s`);
          if (c.curse > 0) parts.push(`咒 ${c.curse.toFixed(1)}s`);
          return `<span class="ctrl-chip"><b>${escapeHtml(c.name)}</b> ${parts.join(" · ")}</span>`;
        })
        .join("");
    }
  }
}

function flashCoreHit() {
  if (!els.coreHitFlash) return;
  els.coreHitFlash.hidden = false;
  els.coreHitFlash.classList.remove("is-on");
  // reflow
  void els.coreHitFlash.offsetWidth;
  els.coreHitFlash.classList.add("is-on");
  clearTimeout(flashCoreHit._t);
  flashCoreHit._t = setTimeout(() => {
    els.coreHitFlash.classList.remove("is-on");
    els.coreHitFlash.hidden = true;
  }, 420);
}

const ui = {
  toast: showToast,
  onResult: showResult,
  onRewardOffer: showRewards,
  onRewardClosed: hideRewards,
  onCoreHit: flashCoreHit,
  onPauseChange(paused) {
    if (els.btnPause) {
      els.btnPause.textContent = paused ? "▶" : "⏸";
      els.btnPause.title = paused ? "繼續 (Space)" : "暫停 (Space)";
    }
    if (els.btnPauseSide) {
      els.btnPauseSide.textContent = paused ? "▶ 繼續" : "⏸ 暫停";
    }
    if (!paused) {
      setOverlayOpen(els.pauseOverlay, false);
      // help 可手動關
    } else if (screen === "play") {
      setOverlayOpen(els.pauseOverlay, true);
    }
  },
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
    const paused = !!state.paused;
    els.btnStart.disabled = !state.canStartWave || blocked || paused;
    els.btnStart.textContent =
      state.waveIndex < 0
        ? "開始第 1 波"
        : state.canStartWave
          ? `開始第 ${state.waveIndex + 2} 波`
          : state.waveActive
            ? paused
              ? "⏸ 暫停中"
              : `第 ${state.waveIndex + 1} 波進行中`
            : state.pausedForReward
              ? "請選擇道具…"
              : "波次結束";

    els.btnSell.disabled =
      !state.selectedSpecialistId ||
      state.result != null ||
      state.pausedForReward ||
      paused ||
      blocked;
    if (els.btnSpeed) els.btnSpeed.disabled = blocked || paused;
    if (els.btnPause) {
      els.btnPause.hidden = blocked || !!state.result;
      els.btnPause.textContent = paused ? "▶" : "⏸";
    }
    if (els.btnPauseSide) {
      els.btnPauseSide.disabled = blocked || !!state.result;
      els.btnPauseSide.textContent = paused ? "▶ 繼續" : "⏸ 暫停";
    }
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
      ? `出戰：${names.join("、")} · 點選或拖到綠格`
      : "請先完成角色選擇";

    renderCombatHud(state);
    // 神木數字閃紅
    if (els.core && (state.coreHitFlash || 0) > 0.35) {
      els.core.classList.add("is-hurt");
    } else if (els.core) {
      els.core.classList.remove("is-hurt");
    }

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
    // 再點同一張 = 自動放到第一個空格（手機友善）
    game.tryDeployAuto();
    return;
  }
  game.setPlacing(id);
  showToast(`${d.nameZh}：點地圖綠格 · 再點卡自動放 · 點空地取消`);
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
els.btnPause?.addEventListener("click", () =>
  withAudio(() => {
    if (game?.paused) closePauseOverlay({ resume: true });
    else openPauseOverlay();
  })
);
els.btnPauseSide?.addEventListener("click", () =>
  withAudio(() => {
    if (game?.paused) closePauseOverlay({ resume: true });
    else openPauseOverlay();
  })
);
els.btnHelp?.addEventListener("click", () => withAudio(() => openHelpOverlay()));
els.btnHelpSide?.addEventListener("click", () => withAudio(() => openHelpOverlay()));
els.btnResume?.addEventListener("click", () =>
  withAudio(() => {
    closePauseOverlay({ resume: true });
  })
);
els.btnPauseHelp?.addEventListener("click", () =>
  withAudio(() => {
    openHelpOverlay({ fromPause: true });
  })
);
els.btnPauseStages?.addEventListener("click", () =>
  withAudio(() => {
    sfx.play("uiClick");
    if (game) {
      game.setPaused(false);
      game.result = null;
    }
    clearRunState();
    closePauseOverlay({ resume: false });
    openTitleScreen();
  })
);
els.btnHelpClose?.addEventListener("click", () =>
  withAudio(() => {
    closeHelpOverlay();
  })
);
els.btnStages?.addEventListener("click", () =>
  withAudio(() => {
    sfx.play("uiClick");
    openCampaignPanel();
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
    // 回第 3 步（關卡或 Boss 列表）
    const backMode = String(pendingStageId || "").startsWith("arena-") ? "raid" : "campaign";
    openCampaignPanel(3);
    setWizardStep(3, backMode);
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
els.btnStartGame?.addEventListener("click", () =>
  withAudio(() => {
    openCampaignPanel(1);
  })
);
els.btnCampaignBack?.addEventListener("click", () =>
  withAudio(() => {
    handleCampaignBack();
  })
);
els.btnWizardNextMode?.addEventListener("click", () =>
  withAudio(() => {
    flushActiveSlot();
    setWizardStep(2);
    sfx.play("uiClick");
  })
);
els.btnModeCampaign?.addEventListener("click", () =>
  withAudio(() => {
    wizardMode = "campaign";
    setWizardStep(3, "campaign");
    sfx.play("uiSelect");
  })
);
els.btnModeRaid?.addEventListener("click", () =>
  withAudio(() => {
    wizardMode = "raid";
    setWizardStep(3, "raid");
    sfx.play("uiSelect");
  })
);
els.dialogOk?.addEventListener("click", () =>
  withAudio(() => {
    const showInput = els.dialogInputWrap && !els.dialogInputWrap.hidden;
    if (showInput) {
      closeDialog(els.dialogInput?.value ?? "");
    } else {
      closeDialog(true);
    }
    sfx.play("uiOk");
  })
);
els.dialogCancel?.addEventListener("click", () =>
  withAudio(() => {
    const showInput = els.dialogInputWrap && !els.dialogInputWrap.hidden;
    closeDialog(showInput ? null : false);
    sfx.play("uiClick");
  })
);
els.dialogInput?.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    els.dialogOk?.click();
  } else if (e.key === "Escape") {
    e.preventDefault();
    els.dialogCancel?.click();
  }
});
els.dialogOverlay?.addEventListener("click", (e) => {
  if (e.target === els.dialogOverlay) {
    const showInput = els.dialogInputWrap && !els.dialogInputWrap.hidden;
    closeDialog(showInput ? null : false);
  }
});
els.btnContinue?.addEventListener("click", () =>
  withAudio(() => {
    sfx.play("uiClick");
    const id = els.btnContinue.dataset.stageId || getNextStageId();
    pendingStageId = id;
    openCharacterSelect();
  })
);
els.btnHomeRank?.addEventListener("click", () =>
  withAudio(() => {
    openRankOverlay(rankTab || "all");
  })
);
els.btnHomeGuide?.addEventListener("click", () =>
  withAudio(() => {
    openGuideOverlay("play");
  })
);
els.btnGuideClose?.addEventListener("click", () =>
  withAudio(() => {
    closeGuideOverlay();
  })
);
els.guideTabs?.addEventListener("click", (ev) => {
  const t = ev.target.closest(".guide-tab");
  if (!t) return;
  withAudio(() => {
    openGuideOverlay(t.dataset.guide || "play");
  });
});
els.btnRankClose?.addEventListener("click", () =>
  withAudio(() => {
    sfx.play("uiClick");
    setOverlayOpen(els.rankOverlay, false);
    if (screen === "stage" || !game || game.result) openTitleScreen();
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
    openTitleScreen();
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
  // 自訂對話框
  if (els.dialogOverlay?.classList.contains("is-open")) {
    if (e.key === "Escape") {
      e.preventDefault();
      els.dialogCancel?.click();
    }
    return;
  }
  // 說明浮層開著：Esc / Enter 關閉
  if (els.helpOverlay?.classList.contains("is-open")) {
    if (e.key === "Escape" || e.key === "Enter") {
      e.preventDefault();
      closeHelpOverlay();
    }
    return;
  }
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
  if (screen !== "play" || !game) return;

  // Space = 暫停／繼續
  if (e.key === " " || e.code === "Space") {
    e.preventDefault();
    if (game.pausedForReward || game.result) return;
    if (game.paused) closePauseOverlay({ resume: true });
    else openPauseOverlay();
    return;
  }
  // Enter = 開始波次
  if (e.key === "Enter") {
    e.preventDefault();
    if (!game.paused && !game.pausedForReward) game.startNextWave();
    return;
  }
  if (game.paused || game.pausedForReward) {
    if (e.key === "Escape") {
      e.preventDefault();
      closePauseOverlay({ resume: true });
    }
    return;
  }

  const loadout = game.loadout || [];
  if (e.key >= "1" && e.key <= "4") {
    const i = Number(e.key) - 1;
    if (loadout[i]) game.setPlacing(loadout[i]);
  }
  if (e.key === "Escape") game.setPlacing(null);
  if (e.key === "Delete" || e.key === "Backspace") game.sellSelected();
  if (e.key === "m" || e.key === "M") game.toggleMute();
  if (e.key === "?" || e.key === "h" || e.key === "H") openHelpOverlay();
});

// 啟動時遷移／載入存檔
ensureSaveSlotsMigrated();
flushActiveSlot();

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
openTitleScreen();
