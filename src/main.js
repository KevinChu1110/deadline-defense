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
  loadLearnedJobs,
} from "./data/job-tree.js";
import { LOADOUT_PRESETS, loadStars } from "./data/meta-progress.js";
import { sfx } from "./audio/sfx.js";
import { STAGES, loadProgress, isStageUnlocked, getStageByIndex } from "./data/stages.js";
import { getWorldChapters, continentUnlockReq } from "./data/world-stages.js";
import { getItem } from "./data/items.js";
import {
  getNickname,
  setNickname,
  getGlobalLeaderboard,
  getArenaLeaderboard,
  getStageLeaderboard,
  getWeeklyLeaderboard,
  exportRankingJson,
} from "./data/ranking.js";
import { getJobDex, getEnemyDex, getDexSummary } from "./data/dex.js";
import {
  getWeeklyChallenge,
  isJobAllowedThisWeek,
  hasJobRestriction,
} from "./data/weekly-challenge.js";
import {
  ARENA_BOSS_ROTATION,
  ARENA_BOSS_META,
  BOSSES,
  getArenaBossId,
  buildActionBoss,
} from "./data/bosses.js";
import { resolveBossKey } from "./data/boss-anims.js";
import {
  parseBridgePayload,
  importBridgeToSlots,
  exportSlotsAsBridge,
  encodeBridgeCode,
  previewImport,
  payloadFromAccountSummary,
} from "./data/discord-bridge.js";
import * as artaleHub from "./artale-hub.js";
import { createActionRaid } from "./game/action-raid.js";
import { createHunt, keyLabel, DEFAULT_KEYBINDS } from "./game/hunt.js";
import { createTown } from "./game/town.js";
import { createAvatar as _mkAvatar, drawAvatar as _drawAvatar } from "./game/avatar.js";
import { loadAppearance, saveAppearance, defaultAppearance, AVATAR_CATALOG, appearanceItems } from "./data/avatar-items.js";
import { equipToAppearance } from "./data/avatar-map.js";
import { getStageById } from "./data/stages.js";
import { themeForStage } from "./data/map-themes.js";
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
  lblCore: document.querySelector("#lbl-core"),
  lblPoints: document.querySelector("#lbl-points"),
  lblMesos: document.querySelector("#lbl-mesos"),
  lblTeam: document.querySelector("#lbl-team"),
  fillCore: document.querySelector("#fill-core"),
  fillWave: document.querySelector("#fill-wave"),
  modeBadge: document.querySelector("#mode-badge"),
  mesosHud: document.querySelector("#stat-mesos"),
  team: document.querySelector("#stat-team"),
  leavesHud: document.querySelector("#stat-leaves"),
  briefing: document.querySelector("#briefing-text"),
  briefingHeading: document.querySelector("#briefing-heading"),
  waveIntel: document.querySelector("#wave-intel"),
  specialistList: document.querySelector("#specialist-list"),
  selectedInfo: document.querySelector("#selected-info"),
  selectedHeading: document.querySelector("#selected-heading"),
  deployHeading: document.querySelector("#deploy-heading"),
  status: document.querySelector("#status-line"),
  stageTitle: document.querySelector("#stage-title"),
  footerStage: document.querySelector("#footer-stage"),
  buffList: document.querySelector("#buff-list"),
  loadoutHint: document.querySelector("#loadout-hint"),
  btnStart: document.querySelector("#btn-start"),
  waveCta: document.querySelector("#wave-cta"),
  btnWaveCta: document.querySelector("#btn-wave-cta"),
  waveCtaHint: document.querySelector("#wave-cta-hint"),
  btnSpeed: document.querySelector("#btn-speed"),
  btnSell: document.querySelector("#btn-sell"),
  btnMute: document.querySelector("#btn-mute"),
  btnHelp: document.querySelector("#btn-help"),
  btnPause: document.querySelector("#btn-pause"),
  btnPauseSide: document.querySelector("#btn-pause-side"),
  btnHelpSide: document.querySelector("#btn-help-side"),
  pauseOverlay: document.querySelector("#pause-overlay"),
  pauseTitle: document.querySelector("#pause-title"),
  pauseSub: document.querySelector("#pause-sub"),
  helpOverlay: document.querySelector("#help-overlay"),
  btnResume: document.querySelector("#btn-resume"),
  btnPauseHelp: document.querySelector("#btn-pause-help"),
  btnPauseStages: document.querySelector("#btn-pause-stages"),
  btnPauseChars: document.querySelector("#btn-pause-chars"),
  btnPauseHome: document.querySelector("#btn-pause-home"),
  btnPauseMute: document.querySelector("#btn-pause-mute"),
  btnHelpClose: document.querySelector("#btn-help-close"),
  btnStages: document.querySelector("#btn-stages"),
  btnChars: document.querySelector("#btn-chars"),
  btnRank: document.querySelector("#btn-rank"),
  toast: document.querySelector("#toast"),
  overlay: document.querySelector("#overlay"),
  overlayKicker: document.querySelector("#overlay-kicker"),
  overlayTitle: document.querySelector("#overlay-title"),
  overlayCopy: document.querySelector("#overlay-copy"),
  resultBanner: document.querySelector("#result-banner"),
  resultStars: document.querySelector("#result-stars"),
  resultStats: document.querySelector("#result-stats"),
  btnRestart: document.querySelector("#btn-restart"),
  btnNextStage: document.querySelector("#btn-next-stage"),
  btnToStages: document.querySelector("#btn-to-stages"),
  btnRepickChars: document.querySelector("#btn-repick-chars"),
  coachOverlay: document.querySelector("#coach-overlay"),
  coachKicker: document.querySelector("#coach-kicker"),
  coachTitle: document.querySelector("#coach-title"),
  coachBody: document.querySelector("#coach-body"),
  btnCoachNext: document.querySelector("#btn-coach-next"),
  btnCoachSkip: document.querySelector("#btn-coach-skip"),
  stageOverlay: document.querySelector("#stage-overlay"),
  stageList: document.querySelector("#stage-list"),
  continentTabs: document.querySelector("#continent-tabs"),
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
  btnWeekly: document.querySelector("#btn-weekly"),
  weeklyOverlay: document.querySelector("#weekly-overlay"),
  weeklyTitle: document.querySelector("#weekly-title"),
  weeklyReset: document.querySelector("#weekly-reset"),
  weeklyStage: document.querySelector("#weekly-stage"),
  weeklyMods: document.querySelector("#weekly-mods"),
  weeklyRestrict: document.querySelector("#weekly-restrict"),
  btnWeeklyStart: document.querySelector("#btn-weekly-start"),
  btnWeeklyCancel: document.querySelector("#btn-weekly-cancel"),
  btnHomeDex: document.querySelector("#btn-home-dex"),
  homeDexBadge: document.querySelector("#home-dex-badge"),
  dexOverlay: document.querySelector("#dex-overlay"),
  dexTitle: document.querySelector("#dex-title"),
  dexSubtitle: document.querySelector("#dex-subtitle"),
  dexTabs: document.querySelector("#dex-tabs"),
  dexGrid: document.querySelector("#dex-grid"),
  btnDexClose: document.querySelector("#btn-dex-close"),
  btnHomeGuide: document.querySelector("#btn-home-guide"),
  btnHomeSettings: document.querySelector("#btn-home-settings"),
  homeLeaves: document.querySelector("#home-leaves"),
  saveSlotList: document.querySelector("#save-slot-list"),
  guideOverlay: document.querySelector("#guide-overlay"),
  guideTabs: document.querySelector("#guide-tabs"),
  guideBody: document.querySelector("#guide-body"),
  btnGuideClose: document.querySelector("#btn-guide-close"),
  settingsOverlay: document.querySelector("#settings-overlay"),
  btnSettingsClose: document.querySelector("#btn-settings-close"),
  btnSettingsMute: document.querySelector("#btn-settings-mute"),
  btnSettingsResetCoach: document.querySelector("#btn-settings-reset-coach"),
  btnSettingsHelp: document.querySelector("#btn-settings-help"),
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
  loadoutPresets: document.querySelector("#loadout-presets"),
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
  bcDock: document.querySelector("#bc-dock"),
  bcWalletVal: document.querySelector("#bc-wallet-val"),
  bcUnitRow: document.querySelector("#bc-unit-row"),
  worldMapScroll: document.querySelector("#world-map-scroll"),
  dialogOverlay: document.querySelector("#dialog-overlay"),
  dialogKicker: document.querySelector("#dialog-kicker"),
  dialogTitle: document.querySelector("#dialog-title"),
  dialogMessage: document.querySelector("#dialog-message"),
  dialogInputWrap: document.querySelector("#dialog-input-wrap"),
  dialogInput: document.querySelector("#dialog-input"),
  dialogCancel: document.querySelector("#dialog-cancel"),
  dialogOk: document.querySelector("#dialog-ok"),
  btnDiscordImport: document.querySelector("#btn-discord-import"),
  btnDiscordExport: document.querySelector("#btn-discord-export"),
  btnDiscordCode: document.querySelector("#btn-discord-code"),
  discordBridgeBar: document.querySelector("#discord-bridge-bar"),
  discordBridgeHint: document.querySelector("#discord-bridge-hint"),
  discordLinkedRow: document.querySelector("#discord-linked-row"),
  discordLinkedName: document.querySelector("#discord-linked-name"),
  btnDiscordResync: document.querySelector("#btn-discord-resync"),
  discordImportOverlay: document.querySelector("#discord-import-overlay"),
  discordImportText: document.querySelector("#discord-import-text"),
  discordImportPreview: document.querySelector("#discord-import-preview"),
  discordImportLive: document.querySelector("#discord-import-live"),
  discordImportLiveName: document.querySelector("#discord-import-live-name"),
  discordImportManual: document.querySelector("#discord-import-manual"),
  btnDiscordImportLive: document.querySelector("#btn-discord-import-live"),
  btnDiscordImportManual: document.querySelector("#btn-discord-import-manual"),
  btnDiscordImportCancel: document.querySelector("#btn-discord-import-cancel"),
  btnDiscordImportPreview: document.querySelector("#btn-discord-import-preview"),
  btnDiscordImportConfirm: document.querySelector("#btn-discord-import-confirm"),
  artaleHubOverlay: document.querySelector("#artale-hub-overlay"),
  artaleHub: document.querySelector("#artale-hub"),
  btnEnterHub: document.querySelector("#btn-enter-hub"),
  huntOverlay: document.querySelector("#hunt-overlay"),
  huntCanvas: document.querySelector("#hunt-canvas"),
  huntTitle: document.querySelector("#hunt-title"),
  btnHuntExit: document.querySelector("#btn-hunt-exit"),
  customizeOverlay: document.querySelector("#customize-overlay"),
  czPreviewImg: document.querySelector("#cz-preview-img"),
  czTabs: document.querySelector("#cz-tabs"),
  czOptions: document.querySelector("#cz-options"),
  btnCzSave: document.querySelector("#btn-cz-save"),
  btnCzCancel: document.querySelector("#btn-cz-cancel"),
  charSelectOverlay: document.querySelector("#char-select-overlay"),
  csFigures: document.querySelector("#cs-figures"),
  csAvatarCanvas: document.querySelector("#cs-avatar-canvas"),
  csName: document.querySelector("#cs-name"),
  csStats: document.querySelector("#cs-stats"),
  btnCsEnter: document.querySelector("#btn-cs-enter"),
  btnCsBack: document.querySelector("#btn-cs-back"),
  huntPickerOverlay: document.querySelector("#hunt-picker-overlay"),
  huntContinentTabs: document.querySelector("#hunt-continent-tabs"),
  huntMapList: document.querySelector("#hunt-map-list"),
  btnHuntPickerClose: document.querySelector("#btn-hunt-picker-close"),
  btnHuntKeys: document.querySelector("#btn-hunt-keys"),
  keybindOverlay: document.querySelector("#keybind-overlay"),
  keybindList: document.querySelector("#keybind-list"),
  btnKeybindSave: document.querySelector("#btn-keybind-save"),
  btnKeybindReset: document.querySelector("#btn-keybind-reset"),
  actionRaidOverlay: document.querySelector("#action-raid-overlay"),
  actionRaidCanvas: document.querySelector("#action-raid-canvas"),
  actionRaidTitle: document.querySelector("#action-raid-title"),
  actionRaidResult: document.querySelector("#action-raid-result"),
  actionRaidResultTitle: document.querySelector("#action-raid-result-title"),
  actionRaidResultCopy: document.querySelector("#action-raid-result-copy"),
  btnActionRaidExit: document.querySelector("#btn-action-raid-exit"),
  btnActionRaidHub: document.querySelector("#btn-action-raid-hub"),
  btnActionRaidRetry: document.querySelector("#btn-action-raid-retry"),
};

/** @type {ReturnType<typeof createActionRaid> | null} */
let actionRaidSession = null;
// 城鎮 Hub 狀態（提前宣告，openTitleScreen 於載入時即引用，避免 TDZ）
let townSession = null, _townData = null, _townReturn = false;
let lastRaidBossId = "zakum";

/** Artale 主城狀態 */
let hubState = {
  tab: "home",
  me: null,
  session: null,
  equip: null,
  starforce: null,
  potential: null,
  starPick: null,
  potPick: null,
  potPanel: "slots",
  starFlash: "",
  potFlash: "",
  safeguard: false,
  equipFilter: "all",
  apiOk: null,
  oauthOk: null,
  error: "",
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
let pendingChallenge = null; // 非 null 時表示這局是「每週挑戰」，帶規則卡修飾符
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
  stopActionRaid();
  setOverlayOpen(els.stageOverlay, false);
  setOverlayOpen(els.charOverlay, false);
  setOverlayOpen(els.rewardOverlay, false);
  setOverlayOpen(els.overlay, false);
  setOverlayOpen(els.rankOverlay, false);
  setOverlayOpen(els.dexOverlay, false);
  setOverlayOpen(els.weeklyOverlay, false);
  setOverlayOpen(els.pauseOverlay, false);
  setOverlayOpen(els.helpOverlay, false);
  setOverlayOpen(els.guideOverlay, false);
  setOverlayOpen(els.dialogOverlay, false);
  setOverlayOpen(els.settingsOverlay, false);
  setOverlayOpen(els.discordImportOverlay, false);
  setOverlayOpen(els.artaleHubOverlay, false);
  setOverlayOpen(els.actionRaidOverlay, false);
}

function stopActionRaid() {
  if (actionRaidSession) {
    actionRaidSession.stop(true);
    actionRaidSession = null;
  }
  if (els.actionRaidResult) els.actionRaidResult.hidden = true;
}

async function launchActionRaid(bossId = "zakum", opts = {}) {
  lastRaidBossId = bossId || "zakum";
  if (!hubState.me) throw new Error("請先登入");
  // profile 一定要向 server 拿（依 Discord 角色裝備算）；boss 資料改用本機 → 5 王全開不依賴 server
  let payload;
  try {
    payload = await artaleHub.startActionRaid(lastRaidBossId);
  } catch {
    try {
      payload = await artaleHub.startActionRaid("zakum"); // server 不認新王時，仍能取得 profile
    } catch {
      // 後端不可用時仍可進場(預設 profile)
      payload = { profile: { name: "冒險者", family: "warrior", style: "melee", maxHp: 800, attackCd: 0.5, skillCd: 3, skillName: "技能", level: 30 } };
    }
  }
  const bossKey = resolveBossKey({ id: lastRaidBossId });
  const boss = buildActionBoss(bossKey, payload.profile, { partySize: opts.partySize || 1 });
  stopActionRaid();
  setOverlayOpen(els.artaleHubOverlay, false);
  setOverlayOpen(els.actionRaidOverlay, true);
  if (els.actionRaidTitle) {
    els.actionRaidTitle.textContent = `${boss.nameZh} · ${payload.profile.name}`;
  }
  if (els.actionRaidResult) els.actionRaidResult.hidden = true;

  actionRaidSession = createActionRaid({
    canvas: els.actionRaidCanvas,
    profile: payload.profile,
    boss,
    onEnd: async (result) => {
      try {
        await artaleHub.completeActionRaid({
          win: result.win,
          bossId: boss.botKey || lastRaidBossId, // server 用短 key(zakum..)發獎勵
          level: result.level,
        });
      } catch {
        /* ignore complete errors */
      }
      if (els.actionRaidResult) {
        els.actionRaidResult.hidden = false;
        if (els.actionRaidResultTitle) {
          els.actionRaidResultTitle.textContent = result.win
            ? "勝利！"
            : "戰敗…";
        }
        if (els.actionRaidResultCopy) {
          els.actionRaidResultCopy.textContent = result.win
            ? `擊敗 ${result.bossName}！剩餘 HP ${Math.ceil(result.hpLeft)}/${result.maxHp}`
            : `倒在 ${result.bossName} 面前。再磨磨裝備／星力再來！`;
        }
      }
      sfx.play(result.win ? "uiClick" : "uiClick");
    },
    onExit: () => {
      stopActionRaid();
      setOverlayOpen(els.actionRaidOverlay, false);
      afterActivity(openArtaleHub);
    },
  });
  actionRaidSession.start();
  sfx.play("uiClick");
}

// ── 楓之谷風角色選擇 ──
let _csSelected = null, _csNext = null;
function openCharSelect(nextAction) {
  _csNext = nextAction || null;
  screen = "charselect";
  document.body.classList.add("home-open");
  hideAllOverlays();
  if (els.titleScreen) els.titleScreen.style.visibility = "hidden";
  _csSelected = null;
  renderCharFigures();
  setOverlayOpen(els.charSelectOverlay, true);
}
function renderCharFigures() {
  if (!els.csFigures) return;
  const chars = hubState.me?.characters || [];
  els.csFigures.innerHTML = "";
  chars.forEach((c) => {
    const active = c.isActive;
    if (active && !_csSelected) _csSelected = c.charId;
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "cs-fig" + (_csSelected === c.charId ? " is-picked" : "");
    btn.dataset.charId = c.charId;
    // 每個角色都用真實紙娃娃(依職業/造型)，非通用臉
    const app = loadAppearance(c.charId, c.class);
    const avatarSrc = avatarUrl(app);
    btn.innerHTML = `
      <div class="cs-fig-plate">
        <img class="cs-fig-img cs-fig-avatar" src="${escapeHtml(avatarSrc)}" alt="" draggable="false"
             onerror="this.onerror=null;this.src='/avatars/hero.png'" />
      </div>
      <div class="cs-fig-name">${escapeHtml(c.name || artaleHub.classLabel(c.class))}</div>
      <div class="cs-fig-meta">${escapeHtml(artaleHub.classLabel(c.class))} · Lv.${c.level ?? "?"}</div>`;
    btn.addEventListener("click", () => {
      _csSelected = c.charId;
      renderCharFigures();
      showCharDetail(c);
      if (els.btnCsEnter) els.btnCsEnter.disabled = false;
      sfx.play("uiClick");
    });
    els.csFigures.appendChild(btn);
  });
  if (els.btnCsEnter) els.btnCsEnter.disabled = !_csSelected;
  // 預設顯示已選/第一個角色詳情
  const sel = chars.find((c) => c.charId === _csSelected) || chars[0];
  if (sel) showCharDetail(sel);
}

// 角色詳情：素質面板 + 會動的紙娃娃
let _csAvatar = null, _csAvatarRaf = 0, _csAvatarLast = 0;
function showCharDetail(c) {
  if (els.csName) els.csName.textContent = c.name || artaleHub.classLabel(c.class);
  const st = c.levelStats || {};
  const setTxt = (id, v) => { const e = document.getElementById(id); if (e) e.textContent = v; };
  setTxt("cs-st-job", artaleHub.classLabel(c.class));
  setTxt("cs-st-lv", c.level ?? "—");
  setTxt("cs-st-str", st.str ?? st.STR ?? "—");
  setTxt("cs-st-dex", st.dex ?? st.DEX ?? "—");
  setTxt("cs-st-int", st.int ?? st.INT ?? "—");
  setTxt("cs-st-luk", st.luk ?? st.LUK ?? "—");
  if (els.csStats) els.csStats.hidden = false;
  // 會動的紙娃娃（自訂造型優先，否則職業預設）
  _csAvatar = createAvatarObj(loadAppearance(c.charId, c.class));
  startCsAvatarLoop();
}
function createAvatarObj(app) {
  // 延遲 import 已在頂部；用 avatar.js
  return _mkAvatar(app);
}
function startCsAvatarLoop() {
  if (_csAvatarRaf) return;
  const ctx = els.csAvatarCanvas?.getContext("2d");
  if (!ctx) return;
  _csAvatarLast = performance.now();
  const loop = (now) => {
    const dt = Math.min(0.05, (now - _csAvatarLast) / 1000); _csAvatarLast = now;
    ctx.clearRect(0, 0, 180, 240);
    if (_csAvatar) _drawAvatar(ctx, _csAvatar, 90, 232, { anim: "stand1", dt, flip: 1, targetH: 200, maxW: 150 });
    _csAvatarRaf = requestAnimationFrame(loop);
  };
  _csAvatarRaf = requestAnimationFrame(loop);
}
function stopCsAvatarLoop() { if (_csAvatarRaf) { cancelAnimationFrame(_csAvatarRaf); _csAvatarRaf = 0; } }
async function csEnter() {
  if (!_csSelected) return;
  const cur = (hubState.me?.characters || []).find((c) => c.isActive);
  if (!cur || cur.charId !== _csSelected) {
    try {
      await artaleHub.selectChar(hubState.session?.discordId, _csSelected);
      (hubState.me.characters || []).forEach((c) => (c.isActive = c.charId === _csSelected));
    } catch { /* 切換失敗仍進場 */ }
  }
  hubState._charPicked = true;
  setOverlayOpen(els.charSelectOverlay, false);
  if (_csNext) { const fn = _csNext; _csNext = null; fn(); }
  else void openTown();
}

// ── 造型工房（換裝/美髮/整形）──
const CZ_TABS = [
  { key: "hair", label: "美髮" },
  { key: "face", label: "整形" },
  { key: "overall", label: "套服" },
  { key: "top", label: "上衣" },
  { key: "bottom", label: "下著" },
  { key: "hat", label: "帽子" },
  { key: "cape", label: "披風" },
];
let _czDraft = null, _czChar = null, _czTab = "hair";
const MSIO = "https://maplestory.io/api";
function avatarUrl(appearance, anim = "stand1", frame = 0) {
  const enc = encodeURIComponent(appearanceItems(appearance).map((o) => JSON.stringify(o)).join(","));
  return `${MSIO}/character/${enc}/${anim}/${frame}?resize=2`;
}
function itemIconUrl(id) { return `${MSIO}/GMS/214/item/${id}/icon`; }

// 唯讀裝備視窗：真實裝備 → 官方物品圖示疊在官方框槽位
async function openEquip() {
  const c = (hubState.me?.characters || []).find((x) => x.isActive) || (hubState.me?.characters || [])[0];
  let app;
  try { app = equipToAppearance(await artaleHub.fetchEquip(), c?.class); }
  catch { app = loadAppearance(c?.charId, c?.class); }
  const setSlot = (cls, id) => {
    const img = document.querySelector(`#equip-overlay .${cls} img`);
    if (!img) return;
    if (id && id > 0) { img.src = itemIconUrl(id); img.style.display = ""; }
    else { img.removeAttribute("src"); img.style.display = "none"; }
  };
  setSlot("es-hat", app.hat);
  setSlot("es-cape", app.cape);
  setSlot("es-glove", app.glove);
  setSlot("es-top", app.overall || app.top);
  setSlot("es-weapon", app.weapon);
  setSlot("es-bottom", app.overall || app.bottom);
  setSlot("es-shoes", app.shoes);
  setOverlayOpen(document.querySelector("#equip-overlay"), true);
  sfx.play("uiClick");
}

function openCustomize() {
  _czChar = (hubState.me?.characters || []).find((c) => c.isActive) || (hubState.me?.characters || [])[0];
  _czDraft = { ...loadAppearance(_czChar?.charId, _czChar?.class) };
  _czTab = "hair";
  renderCzTabs();
  renderCzOptions();
  updateCzPreview();
  setOverlayOpen(els.customizeOverlay, true);
}
function updateCzPreview() { if (els.czPreviewImg) els.czPreviewImg.src = avatarUrl(_czDraft); }
function renderCzTabs() {
  if (!els.czTabs) return;
  els.czTabs.innerHTML = "";
  for (const t of CZ_TABS) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "cz-tab" + (t.key === _czTab ? " is-active" : "");
    b.textContent = t.label;
    b.addEventListener("click", () => { _czTab = t.key; renderCzTabs(); renderCzOptions(); });
    els.czTabs.appendChild(b);
  }
}
function renderCzOptions() {
  if (!els.czOptions) return;
  els.czOptions.innerHTML = "";
  const opts = AVATAR_CATALOG[_czTab] || [];
  // 套服/上衣下著互斥：選套服清 top/bottom；選 top/bottom 清 overall
  for (const id of opts) {
    const cur = _czDraft[_czTab] || 0;
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "cz-opt" + (cur === id ? " is-picked" : "");
    if (id === 0) btn.innerHTML = `<span class="cz-opt-none">無</span>`;
    else btn.innerHTML = `<img src="${itemIconUrl(id)}" alt="" loading="lazy" onerror="this.style.opacity=0.2" />`;
    btn.addEventListener("click", () => {
      _czDraft[_czTab] = id;
      if (_czTab === "overall" && id) { _czDraft.top = 0; _czDraft.bottom = 0; }
      if ((_czTab === "top" || _czTab === "bottom") && id) _czDraft.overall = 0;
      renderCzOptions();
      updateCzPreview();
      sfx.play("uiClick");
    });
    els.czOptions.appendChild(btn);
  }
}
function czSave() {
  if (_czChar && _czDraft) saveAppearance(_czChar.charId, _czDraft);
  setOverlayOpen(els.customizeOverlay, false);
  showToast("造型已儲存");
  if (screen === "charselect") renderCharFigures();
}

let huntSession = null;
let lastHuntMapId = null;
let huntStartedAt = 0;
function stopHunt() {
  if (huntSession) { huntSession.stop(); huntSession = null; }
}
async function openHunt(stageId) {
  if (!hubState.me) throw new Error("請先登入");
  // profile 向 server 拿（依角色裝備），與突襲同源
  let payload;
  try { payload = await artaleHub.startActionRaid("zakum"); } catch { payload = { profile: null }; }
  const profile = payload.profile || {
    name: "冒險者", family: "warrior", style: "melee", maxHp: 600,
    attackCd: 0.5, basicMin: 30, basicMax: 45, skillMin: 80, skillMax: 120, skillCd: 3, moveSpeed: 210, jump: 560, level: 30,
  };
  const stage = getStageById(stageId) || getStageById(STAGES[0].id);
  // 收集該圖真實怪（去重）
  const ids = new Set();
  for (const w of stage.waves || []) for (const g of w.groups || []) for (const u of g.units || []) ids.add(Array.isArray(u) ? u[0] : u);
  const enemies = [...ids].map((id) => ({ id }));
  const theme = themeForStage(stage);

  stopHunt();
  setOverlayOpen(els.artaleHubOverlay, false);
  hideAllOverlays();
  setOverlayOpen(els.huntOverlay, true);
  if (els.huntTitle) els.huntTitle.textContent = `${stage.continentZh || ""} · ${stage.name}`;
  lastHuntMapId = stage.id;
  huntStartedAt = Date.now();
  // 用玩家「目前選的角色」職業挑真實技能
  const activeChar = (hubState.me?.characters || []).find((c) => c.isActive) || (hubState.me?.characters || [])[0];
  // 紙娃娃外觀：優先「角色真實裝備」(對照官方 id)，失敗才用自訂造型/職業預設
  let appearance;
  try {
    const eq = await artaleHub.fetchEquip();
    appearance = equipToAppearance(eq, activeChar?.class);
  } catch {
    appearance = loadAppearance(activeChar?.charId, activeChar?.class);
  }
  huntSession = createHunt({
    canvas: els.huntCanvas, profile, enemies, theme,
    bgCode: stage.continent,
    charClass: activeChar?.class,
    appearance,
    keybinds: loadKeybinds(),
    onExit: () => {
      void reportHuntSession(lastHuntMapId, huntStartedAt);
      stopHunt();
      setOverlayOpen(els.huntOverlay, false);
      afterActivity(openArtaleHub);
    },
  });
  huntSession.start();
  sfx.play("uiClick");
}

/** 把這場掛機的擊殺回報給 bot 權威結算經驗/掉落 */
async function reportHuntSession(mapId, startAt) {
  try {
    const st = huntSession?.getState?.();
    const kills = st?.killLog || {};
    if (!Object.keys(kills).length) return;
    const durationSec = Math.round((Date.now() - startAt) / 1000);
    const res = await artaleHub.reportHunt({ mapId, kills, durationSec });
    if (res?.expGained) showToast(`本場結算：+${res.expGained} 經驗${res.drops?.length ? ` · 掉落 ${res.drops.length} 件` : ""}`);
  } catch {
    /* bot 端未部署 hunt.report 時靜默略過（不影響遊玩） */
  }
}

// ── 按鍵配置（localStorage）──
const KEYBIND_KEY = "deadline-defense-hunt-keys";
function loadKeybinds() {
  try { const r = localStorage.getItem(KEYBIND_KEY); return r ? JSON.parse(r) : { ...DEFAULT_KEYBINDS }; }
  catch { return { ...DEFAULT_KEYBINDS }; }
}
function saveKeybinds(kb) {
  try { localStorage.setItem(KEYBIND_KEY, JSON.stringify(kb)); } catch { /* ignore */ }
}

let _kbDraft = null;
const KB_ROWS = [
  { k: "attack", label: "普攻" },
  { k: "jump", label: "跳躍" },
  { k: "dash", label: "閃避" },
  { k: "skill0", label: "技能 1" },
  { k: "skill1", label: "技能 2" },
  { k: "skill2", label: "技能 3" },
  { k: "skill3", label: "技能 4" },
];
function kbGet(kb, k) { return k.startsWith("skill") ? (kb.skills || [])[+k.slice(5)] : kb[k]; }
function kbSet(kb, k, code) { if (k.startsWith("skill")) { kb.skills = kb.skills || [...DEFAULT_KEYBINDS.skills]; kb.skills[+k.slice(5)] = code; } else kb[k] = code; }

function renderKeybinds() {
  if (!els.keybindList) return;
  els.keybindList.innerHTML = "";
  for (const row of KB_ROWS) {
    const code = kbGet(_kbDraft, row.k);
    const div = document.createElement("div");
    div.className = "keybind-row";
    div.innerHTML = `<span class="kb-label">${row.label}</span>
      <button type="button" class="btn kb-key" data-kb="${row.k}">${escapeHtml(keyLabel(code))}</button>`;
    els.keybindList.appendChild(div);
  }
  els.keybindList.querySelectorAll("[data-kb]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const others = els.keybindList.querySelectorAll(".kb-key.capturing");
      others.forEach((o) => o.classList.remove("capturing"));
      btn.classList.add("capturing");
      btn.textContent = "按鍵…";
    });
  });
}
function openKeybinds() {
  _kbDraft = loadKeybinds();
  renderKeybinds();
  setOverlayOpen(els.keybindOverlay, true);
}
function onKeybindCapture(e) {
  if (!els.keybindOverlay || els.keybindOverlay.hidden) return;
  const active = els.keybindList?.querySelector(".kb-key.capturing");
  if (!active) return;
  e.preventDefault();
  const code = e.code;
  const k = active.getAttribute("data-kb");
  // 去除與其他綁定的重複
  for (const row of KB_ROWS) if (row.k !== k && kbGet(_kbDraft, row.k) === code) kbSet(_kbDraft, row.k, null);
  kbSet(_kbDraft, k, code);
  renderKeybinds();
}

// ── 掛機地圖選單（全 448 圖，依大陸）──
let huntSelectedContinent = null;
function openHuntPicker() {
  setOverlayOpen(els.artaleHubOverlay, false);
  setOverlayOpen(els.huntPickerOverlay, true);
  renderHuntPicker();
}
function renderHuntPicker() {
  if (!els.huntMapList) return;
  const progress = loadProgress();
  const chapters = getWorldChapters();
  const contUnlocked = (ch) => isStageUnlocked(ch.stages[0].index, progress);
  if (!huntSelectedContinent || !chapters.some((c) => c.code === huntSelectedContinent && contUnlocked(c))) {
    huntSelectedContinent = (chapters.find(contUnlocked) || chapters[0]).code;
  }
  // 大陸列
  els.huntContinentTabs.innerHTML = "";
  chapters.forEach((ch) => {
    const unlocked = contUnlocked(ch);
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "continent-chip" + (ch.code === huntSelectedContinent ? " is-active" : "") + (!unlocked ? " is-locked" : "");
    const colors = STAGE_ACCENTS[ch.code.toUpperCase()] || STAGE_ACCENTS.VICTORIA;
    btn.style.setProperty("--wn-a", colors[0]); btn.style.setProperty("--wn-b", colors[1]);
    btn.innerHTML = `<span class="cc-name">${!unlocked ? "🔒 " : ""}${escapeHtml(ch.nameZh)}</span><span class="cc-prog">${ch.stages.length} 圖</span>`;
    btn.addEventListener("click", () => { if (!unlocked) { showToast("通關前面大陸解鎖"); return; } huntSelectedContinent = ch.code; sfx.play("uiClick"); renderHuntPicker(); });
    els.huntContinentTabs.appendChild(btn);
  });
  // 地圖格
  els.huntMapList.innerHTML = "";
  const chapter = chapters.find((c) => c.code === huntSelectedContinent) || chapters[0];
  chapter.stages.forEach((stage, li) => {
    const unlocked = isStageUnlocked(stage.index, progress);
    const colors = STAGE_ACCENTS[stage.code] || STAGE_ACCENTS.VICTORIA;
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "world-node" + (!unlocked ? " is-locked" : "");
    btn.style.setProperty("--wn-a", colors[0]); btn.style.setProperty("--wn-b", colors[1]);
    btn.title = unlocked ? `${stage.name} · Lv.${stage.stageLevel}` : "未解鎖";
    btn.innerHTML = `<span class="world-node-orb">${unlocked ? "🗡️" : "🔒"}</span>
      <span class="world-node-name">${escapeHtml(stage.name)}</span>
      <span class="world-node-lv">Lv.${stage.stageLevel}</span>`;
    if (unlocked) btn.addEventListener("click", () => {
      setOverlayOpen(els.huntPickerOverlay, false);
      openHunt(stage.id).catch((e) => showToast(e?.message || "無法開始"));
    });
    els.huntMapList.appendChild(btn);
  });
}

function paintHub() {
  artaleHub.renderHubShell(els, hubState);
  artaleHub.bindHubEvents(els, {
    getState: () => hubState,
    onState: (next) => {
      hubState = { ...hubState, ...next };
      paintHub();
    },
    onBackTitle: () => {
      setOverlayOpen(els.artaleHubOverlay, false);
      openTitleScreen();
    },
    onOpenDefense: () => {
      setOverlayOpen(els.artaleHubOverlay, false);
      openCampaignPanel(1);
    },
    onStartRaid: async (bossId) => {
      try {
        await launchActionRaid(bossId);
      } catch (e) {
        hubState = { ...hubState, tab: "combat", error: e.message || String(e) };
        paintHub();
      }
    },
    onStartHunt: async (stageId) => {
      try {
        await openHunt(stageId);
      } catch (e) {
        hubState = { ...hubState, tab: "combat", error: e.message || String(e) };
        paintHub();
      }
    },
    onOpenHuntPicker: () => openHuntPicker(),
  });
}

async function openArtaleHub() {
  screen = "hub";
  document.body.classList.add("home-open");
  document.body.classList.remove("in-play", "mode-bc", "mode-td");
  hideAllOverlays();
  setCampaignPanelOpen(false);
  setOverlayOpen(els.stageOverlay, true);
  if (els.titleScreen) els.titleScreen.style.visibility = "hidden";
  setOverlayOpen(els.artaleHubOverlay, true);
  hubState = { ...hubState, error: "", apiOk: null, oauthOk: null };
  paintHub();

  // OAuth 回跳 query
  const params = new URLSearchParams(window.location.search);
  if (params.get("artale_login") === "ok") {
    history.replaceState({}, "", window.location.pathname);
    showToast("Discord 登入成功");
  } else if (params.get("artale_login") === "error") {
    const msg = params.get("msg") || "登入失敗";
    history.replaceState({}, "", window.location.pathname);
    hubState.error = decodeURIComponent(msg);
  }

  try {
    const health = await artaleHub.healthCheck();
    hubState.apiOk = true;
    hubState.oauthOk = !!health.auth?.oauthConfigured;
    // 優先讀 session cookie
    try {
      const sess = await artaleHub.fetchSessionMe();
      hubState.session = sess.session;
      hubState.me = sess.me;
      if (sess.session?.discordId) {
        artaleHub.setLinkedDiscordId(sess.session.discordId);
      }
      // 登入即自動帶入角色（非破壞性：只填空存檔，不覆蓋任何既有進度）
      void autoSyncOnLogin();
    } catch {
      // 無 session — 停在登入頁
      hubState.me = null;
      hubState.session = null;
    }
  } catch (e) {
    hubState.apiOk = false;
    hubState.oauthOk = false;
    const msg = e?.message || String(e);
    hubState.error = artaleHub.isRemoteApi()
      ? `連不上 API（ngrok）。請確認 sit-kevin 上 artale-web-api / ngrok 有在跑。${msg ? " · " + msg : ""}`
      : "API 未啟動。本機請執行：npm run dev:api";
  }
  // 登入且有角色 → 先進楓之谷風角色選擇（一次 session 一次）
  if (hubState.me?.characters?.length && !hubState._charPicked) {
    setOverlayOpen(els.artaleHubOverlay, false);
    openCharSelect();
    return;
  }
  paintHub();
  sfx.play("uiClick");
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
const COACH_SEEN_KEY = "deadline-defense-coach-v1";

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

function hasSeenCoach() {
  try {
    return localStorage.getItem(COACH_SEEN_KEY) === "1";
  } catch {
    return false;
  }
}

function markCoachSeen() {
  try {
    localStorage.setItem(COACH_SEEN_KEY, "1");
  } catch {
    /* ignore */
  }
}

/** @type {null | { steps: object[], index: number }} */
let coachState = null;

function getCoachSteps(bcMode) {
  if (bcMode) {
    return [
      {
        title: "點下方卡出兵",
        body: "遠征是推線模式：點畫面下方職業頭像出兵。單位會自動往右走。",
        highlight: "deploy",
      },
      {
        title: "敵軍自動來襲",
        body: "第一隻兵出陣後會自動開波，敵人從右邊湧來。也可按「開始遠征」。錢包會自動回復。",
        highlight: "wave",
      },
      {
        title: "守住我方基地",
        body: "敵人碰到左邊基地會扣血——看上方血條。用出兵節奏擋住推線。",
        highlight: "core",
      },
      {
        title: "推倒敵方基地",
        body: "清完波次後總攻右側基地；打倒 Boss 也會重創敵方基地。拆掉即勝利！",
        highlight: null,
      },
    ];
  }
  return [
    {
      title: "部署職業",
      body: "點右側職業卡，再點地圖上的綠色「+」格放置。也可以拖曳到綠格鬆手。",
      highlight: "deploy",
    },
    {
      title: "開始波次",
      body: "佈陣完成後，點畫面中央大按鈕「開始防禦」。怪物會沿路線攻向神木。",
      highlight: "wave",
    },
    {
      title: "守護神木",
      body: "上方血條是神木／基地。漏怪會扣血，歸零就失敗。Boss 出現時看畫面上方技能提示。",
      highlight: "core",
    },
    {
      title: "轉職與勝利",
      body: "打怪賺楓幣，點場上角色可轉職。清完所有波次即過關。暫停裡可回主選單。",
      highlight: null,
    },
  ];
}

function clearCoachHighlight() {
  document.body.classList.remove(
    "coach-highlight-deploy",
    "coach-highlight-wave",
    "coach-highlight-core",
    "coach-highlight-start"
  );
}

function renderCoachStep() {
  if (!coachState || !els.coachOverlay) return;
  const step = coachState.steps[coachState.index];
  if (!step) {
    closeCoach({ mark: true });
    return;
  }
  const n = coachState.index + 1;
  const total = coachState.steps.length;
  if (els.coachKicker) els.coachKicker.textContent = `新手引導 · ${n}／${total}`;
  if (els.coachTitle) els.coachTitle.textContent = step.title;
  if (els.coachBody) els.coachBody.textContent = step.body;
  if (els.btnCoachNext) {
    els.btnCoachNext.textContent = n >= total ? "開始遊玩" : "下一步";
  }
  clearCoachHighlight();
  if (step.highlight === "deploy") document.body.classList.add("coach-highlight-deploy");
  if (step.highlight === "wave") document.body.classList.add("coach-highlight-wave");
  if (step.highlight === "core") document.body.classList.add("coach-highlight-core");
}

function openCoachIfNeeded(bcMode) {
  if (hasSeenCoach()) return;
  if (screen !== "play") return;
  coachState = { steps: getCoachSteps(bcMode), index: 0 };
  if (els.coachOverlay) {
    els.coachOverlay.hidden = false;
  }
  renderCoachStep();
  // 不凍結戰鬥：遠征出兵／移動必須能動，教學只當浮層
}

function closeCoach({ mark = true } = {}) {
  if (mark) markCoachSeen();
  coachState = null;
  clearCoachHighlight();
  if (els.coachOverlay) els.coachOverlay.hidden = true;
}

function coachNext() {
  if (!coachState) return;
  if (coachState.index >= coachState.steps.length - 1) {
    closeCoach({ mark: true });
    sfx.play("uiOk");
    showToast("祝你好運，冒險者！");
    return;
  }
  coachState.index += 1;
  renderCoachStep();
  sfx.play("uiClick");
}

function applyModeSkin(state) {
  const bc = !!state?.bcMode;
  document.body.classList.toggle("mode-bc", bc && screen === "play");
  document.body.classList.toggle("mode-td", !bc && screen === "play");
  if (els.modeBadge) {
    els.modeBadge.textContent = bc ? "EXPEDITION · 遠征" : "CAMPAIGN · 戰役";
  }
  if (els.deployHeading) {
    els.deployHeading.textContent = bc ? "出兵卡組" : "部署單位";
  }
  if (els.selectedHeading) {
    els.selectedHeading.textContent = bc ? "遠征提示" : "目前選取";
  }
  if (els.briefingHeading) {
    els.briefingHeading.textContent = bc ? "遠征目標" : "任務說明";
  }
  // 賣出僅塔防
  if (els.btnSell) {
    els.btnSell.hidden = bc;
  }
  // 遠征底欄
  if (els.bcDock) {
    els.bcDock.hidden = !(bc && screen === "play");
  }
  if (els.loadoutHint && bc && screen === "play") {
    els.loadoutHint.textContent = "使用畫面下方出兵列 · 錢包自動回復";
  }
}

function updateWaveCta(state) {
  if (!els.waveCta) return;
  // 引導中即使暫停也顯示「開始」鈕，方便對照說明
  const pausedOk = !state.paused || !!coachState;
  const show =
    screen === "play" &&
    state &&
    !state.result &&
    !state.pausedForReward &&
    pausedOk &&
    (state.canStartWave || (!!coachState && !state.waveActive));
  els.waveCta.hidden = !show;
  if (!show) return;
  const bc = !!state.bcMode;
  if (els.btnWaveCta) {
    els.btnWaveCta.textContent = bc ? "▶ 開始遠征" : "▶ 開始防禦";
  }
  if (els.waveCtaHint) {
    const next = (state.waveIndex ?? -1) + 1;
    if (next <= 0) {
      els.waveCtaHint.textContent = bc ? "先出兵，再開始第一波" : "先部署，再開始第一波";
    } else {
      els.waveCtaHint.textContent = `下一波 ${next + 1}／${state.waveTotal}`;
    }
  }
}

function updateSlimHud(state) {
  if (els.fillCore && state.coreMax > 0) {
    const pct = Math.max(0, Math.min(100, (state.coreHp / state.coreMax) * 100));
    els.fillCore.style.width = `${pct}%`;
  }
  if (els.fillWave && state.waveTotal > 0) {
    const done = Math.max(0, state.waveIndex + 1);
    const pct = state.waveIndex < 0 ? 0 : Math.min(100, (done / state.waveTotal) * 100);
    els.fillWave.style.width = `${pct}%`;
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
  const bc = !!game.bcMode;
  if (els.pauseTitle) els.pauseTitle.textContent = "戰鬥暫停中";
  if (els.pauseSub) {
    els.pauseSub.textContent = bc
      ? "遠征時間已凍結 · 可調整出兵或離開"
      : "波次時間已凍結 · 可看說明或離開";
  }
  if (els.btnPauseMute) {
    els.btnPauseMute.textContent = sfx.muted ? "🔇 開音樂" : "🔊 音樂";
  }
  setOverlayOpen(els.pauseOverlay, true);
}

function closePauseOverlay({ resume = true } = {}) {
  setOverlayOpen(els.pauseOverlay, false);
  setOverlayOpen(els.helpOverlay, false);
  if (resume && game) game.setPaused(false);
}

let rankTab = "weekly";  // 週榜是社群主戰場，排行榜預設開在這

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
    closeCoach({ mark: false });
    document.body.classList.remove("mode-bc", "mode-td");

    const isWin = kind === "win";
    const stage = game?.stage;
    const stageName = stage?.name || "本關";
    const isArena = !!stage?.arena || !!game?.bcMode;
    const nextIndex = (stage?.index ?? 0) + 1;
    const refreshed = loadProgress();
    const canNext = nextIndex < STAGES.length && isStageUnlocked(nextIndex, refreshed);
    const starInfo = game?.lastStars;
    const score = game?.lastScore || 0;

    if (els.resultBanner) {
      els.resultBanner.dataset.kind = isWin ? "win" : "lose";
    }
    if (els.overlayKicker) {
      els.overlayKicker.textContent = isWin
        ? isArena
          ? "遠征勝利"
          : "任務完成"
        : isArena
          ? "遠征失敗"
          : "任務失敗";
    }
    if (els.overlayTitle) {
      els.overlayTitle.textContent = isWin ? "勝利！" : "再試一次";
    }

    // stars
    if (els.resultStars) {
      if (isWin && starInfo && !isArena) {
        els.resultStars.hidden = false;
        const n = Math.min(3, Math.max(0, starInfo.count || 0));
        els.resultStars.innerHTML =
          `<span class="star-on">★</span>`.repeat(n) +
          `<span class="star-off">★</span>`.repeat(3 - n);
      } else if (isWin && isArena) {
        els.resultStars.hidden = false;
        els.resultStars.innerHTML = `<span class="star-on">🏆</span>`;
      } else {
        els.resultStars.hidden = true;
        els.resultStars.innerHTML = "";
      }
    }

    // stats chips
    if (els.resultStats) {
      const chips = [];
      if (isWin && score) chips.push({ k: "分數", v: String(score) });
      if (isWin && starInfo && !isArena) chips.push({ k: "評價", v: `${starInfo.count} 星` });
      chips.push({ k: isArena ? "我方基地" : "神木", v: `${game?.coreHp ?? 0}` });
      chips.push({ k: "漏怪", v: String(game?.leaks ?? 0) });
      if (isWin) chips.push({ k: "楓葉", v: "已入帳" });
      els.resultStats.hidden = chips.length === 0;
      els.resultStats.innerHTML = chips
        .map(
          (c) =>
            `<div class="result-stat"><small>${escapeHtml(c.k)}</small><strong>${escapeHtml(c.v)}</strong></div>`
        )
        .join("");
    }

    if (els.overlayCopy) {
      if (isWin) {
        if (isArena) {
          els.overlayCopy.textContent = `${stageName} 通關！分數已寫入本機排行榜。`;
        } else if (nextIndex < STAGES.length) {
          els.overlayCopy.textContent = canNext
            ? `${stageName} 守護成功！下一關已解鎖。`
            : `${stageName} 守護成功！`;
        } else {
          els.overlayCopy.textContent = `${stageName} 完成！你已走完全部地區戰役。`;
        }
      } else {
        els.overlayCopy.textContent = isArena
          ? "我方基地陷落…調整出兵節奏與職業再挑戰！"
          : "神木被攻陷…換個職業或佈陣再試一次！";
      }
    }

    // primary CTA ordering
    if (els.btnRestart) {
      els.btnRestart.textContent = isWin ? "再打一次" : "重新挑戰";
      els.btnRestart.classList.toggle("primary", !isWin);
      els.btnRestart.classList.toggle("maple-primary", !isWin);
    }
    if (els.btnNextStage) {
      if (isWin) {
        if (isArena) {
          els.btnNextStage.hidden = false;
          els.btnNextStage.disabled = false;
          els.btnNextStage.textContent = "再戰遠征 Boss";
          els.btnNextStage.classList.add("primary", "maple-primary");
        } else {
          els.btnNextStage.hidden = nextIndex >= STAGES.length;
          els.btnNextStage.disabled = !canNext;
          els.btnNextStage.textContent = canNext
            ? `下一關：${getStageByIndex(nextIndex)?.name || ""}`
            : "下一關（未解鎖）";
          els.btnNextStage.classList.add("primary", "maple-primary");
        }
      } else {
        els.btnNextStage.hidden = true;
      }
    }
    if (els.btnToStages) els.btnToStages.textContent = "回主選單";

    setOverlayOpen(els.overlay, true);
  } catch (err) {
    console.error("[showResult]", err);
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
  // 第二章
  GHOSTSHIP: ["#67e8f9", "#1e293b"],
  ICETOWER: ["#a5f3fc", "#0891b2"],
  ABYSS: ["#06b6d4", "#082f49"],
  FORTRESS: ["#f59e0b", "#292524"],
  ENDTIME: ["#e879f9", "#1e1b4b"],
};

function getStarsForStage(stageId) {
  const data = loadStars();
  return Math.min(3, Number(data?.[stageId] || 0));
}

let selectedContinent = null;

function renderStageList() {
  if (!els.stageList) return;
  flushActiveSlot();
  const progress = loadProgress();
  const chapters = getWorldChapters();

  // 下一個可挑戰（全域）
  let nextIdx = STAGES.findIndex((_, i) => isStageUnlocked(i, progress) && !progress.cleared[STAGES[i].id]);
  if (nextIdx < 0) nextIdx = Math.min(STAGES.length - 1, (progress.unlocked || 1) - 1);

  // 大陸解鎖：首關解鎖即解鎖；預設選中「下一關所在的大陸」
  const contUnlocked = (ch) => isStageUnlocked(ch.stages[0].index, progress);
  if (!selectedContinent || !chapters.some((c) => c.code === selectedContinent && contUnlocked(c))) {
    const nextStage = STAGES[nextIdx];
    selectedContinent = nextStage?.continent || chapters[0].code;
  }

  // ── 大陸列 ──
  if (els.continentTabs) {
    els.continentTabs.innerHTML = "";
    chapters.forEach((ch) => {
      const unlocked = contUnlocked(ch);
      const clears = ch.stages.filter((s) => progress.cleared[s.id]).length;
      const hasNext = ch.stages.some((s) => s.index === nextIdx);
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className =
        "continent-chip" +
        (ch.code === selectedContinent ? " is-active" : "") +
        (!unlocked ? " is-locked" : "") +
        (hasNext ? " has-next" : "");
      // 鎖住的大陸不 disable —— 允許點擊跳出「還差幾關」提示（disabled 會吃掉 click）
      const colors = STAGE_ACCENTS[ch.code.toUpperCase()] || STAGE_ACCENTS.VICTORIA;
      btn.style.setProperty("--wn-a", colors[0]);
      btn.style.setProperty("--wn-b", colors[1]);
      let prog;
      if (!unlocked) {
        const req = continentUnlockReq(ch.code, progress);
        prog = `🔒 前區 ${req.cleared}/${req.need}`;
        btn.title = `通關「${req.prevZh}」${req.need} 關即解鎖（已 ${req.cleared}）`;
      } else {
        prog = `${clears}/${ch.stages.length}${hasNext ? " ▶" : clears === ch.stages.length ? " ✓" : ""}`;
      }
      btn.innerHTML = `
        <span class="cc-name">${!unlocked ? "🔒 " : ""}${escapeHtml(ch.nameZh)}</span>
        <span class="cc-prog">${prog}</span>`;
      btn.addEventListener("click", () => {
        if (!unlocked) {
          const req = continentUnlockReq(ch.code, progress);
          showToast(`🔒 通關「${req.prevZh}」${req.need} 關解鎖（已 ${req.cleared}/${req.need}）`);
          return;
        }
        selectedContinent = ch.code;
        sfx.play("uiClick");
        renderStageList();
      });
      els.continentTabs.appendChild(btn);
    });
  }

  // ── 選中大陸的地圖格 ──
  els.stageList.innerHTML = "";
  const chapter = chapters.find((c) => c.code === selectedContinent) || chapters[0];
  chapter.stages.forEach((stage, li) => {
    const i = stage.index;
    const unlocked = isStageUnlocked(i, progress);
    const cleared = !!progress.cleared[stage.id];
    const stars = getStarsForStage(stage.id);
    const isNext = i === nextIdx && unlocked;
    const colors = STAGE_ACCENTS[stage.code] || STAGE_ACCENTS.VICTORIA;

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className =
      "world-node" +
      (isNext ? " is-next" : "") +
      (cleared ? " is-cleared" : "") +
      (!unlocked ? " is-locked" : "");
    btn.disabled = !unlocked;
    btn.setAttribute("role", "listitem");
    btn.style.setProperty("--wn-a", colors[0]);
    btn.style.setProperty("--wn-b", colors[1]);
    btn.title = unlocked ? `${stage.name} · 建議等級 ${stage.stageLevel}` : "未解鎖 · 通關前一關";
    const starStr =
      cleared || stars > 0 ? "★".repeat(stars) + "☆".repeat(Math.max(0, 3 - stars)) : isNext ? "▶" : "";
    btn.innerHTML = `
      <span class="world-node-orb">${!unlocked ? "🔒" : String(li + 1).padStart(2, "0")}</span>
      <span class="world-node-name">${escapeHtml(stage.name)}</span>
      <span class="world-node-lv">Lv.${stage.stageLevel}</span>
      <span class="world-node-stars">${starStr}</span>
    `;
    btn.addEventListener("click", () => {
      void sfx.unlock();
      sfx.play("uiClick");
      pendingStageId = stage.id;
      pendingChallenge = null;
      openCharacterSelect();
    });
    els.stageList.appendChild(btn);
  });

  requestAnimationFrame(() => {
    const nextEl = els.stageList.querySelector(".world-node.is-next");
    nextEl?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  });

  syncNickInput();
  refreshHomeMeta(progress, nextIdx);
}

/** 遠征底部出兵列 */
function renderBcDock(state) {
  if (!els.bcDock || !els.bcUnitRow) return;
  if (!state?.bcMode || screen !== "play") {
    els.bcDock.hidden = true;
    return;
  }
  els.bcDock.hidden = false;
  if (els.bcWalletVal) {
    els.bcWalletVal.textContent = String(state.points ?? 0);
  }
  const loadout = state.loadout?.length ? state.loadout : game?.loadout || [];
  const blocked = !!state.result || !!state.pausedForReward;
  els.bcUnitRow.innerHTML = "";
  for (const id of loadout) {
    const d = SPECIALISTS[id];
    if (!d) continue;
    const lv = getCardLevel(id);
    const leveled = buildLeveledDef(id, lv);
    const cd = state.spawnCd?.[id] || 0;
    const cantAfford = (state.points ?? 0) < leveled.cost;
    const teamFull = (state.teamCount ?? 0) >= (state.teamLimit ?? 16);
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "bc-unit-btn";
    btn.disabled = blocked || cantAfford || teamFull || cd > 0;
    btn.title = cd > 0 ? `冷卻 ${cd.toFixed(1)}s` : `${d.nameZh} · ${leveled.cost}`;

    const portrait = getSpecialistPortrait(id, d);
    let face;
    if (portrait instanceof HTMLImageElement && portrait.src) {
      face = document.createElement("img");
      face.src = portrait.currentSrc || portrait.src;
      face.alt = "";
      face.draggable = false;
    } else {
      face = document.createElement("canvas");
      face.width = portrait?.width || 48;
      face.height = portrait?.height || 48;
      try {
        face.getContext("2d")?.drawImage(portrait, 0, 0);
      } catch {
        /* ignore */
      }
    }
    const name = document.createElement("span");
    name.className = "bc-name";
    name.textContent = d.nameZh;
    const cost = document.createElement("span");
    cost.className = "bc-cost";
    cost.textContent = cd > 0 ? `${cd.toFixed(1)}s` : `${leveled.cost}`;
    btn.append(face, name, cost);
    if (cd > 0) {
      const ring = document.createElement("span");
      ring.className = "bc-cd-ring";
      // approximate: spawn cd default 2.2
      const pct = Math.min(100, (cd / 2.2) * 100);
      ring.style.setProperty("--cd", String(pct));
      btn.appendChild(ring);
    }
    btn.addEventListener("click", () => {
      withAudio(() => game.tryDeployBc(id));
    });
    els.bcUnitRow.appendChild(btn);
  }
}

/** HTML data-preset → meta-progress preset id */
const PRESET_HTML_MAP = {
  starter: "beginner_line",
  balanced: "fortress",
  anti_stealth: "reveal",
  anti_armor: "break",
};

function applyLoadoutPresetById(presetId) {
  const p = LOADOUT_PRESETS.find((x) => x.id === presetId);
  if (!p) return;
  const ok = p.jobs.filter((id) => canDeployJob(id));
  if (!ok.length) {
    // fallback: beginner + any deployable from catalog
    const fallback = SPECIALIST_ORDER.filter((id) => canDeployJob(id)).slice(0, LOADOUT_MAX);
    if (!fallback.length) {
      sfx.play("error");
      showToast("尚無可編隊職業：" + p.desc);
      return;
    }
    draftLoadout = fallback;
    focusCardId = draftLoadout[0];
    renderCharacterGrid();
    showToast(`「${p.nameZh}」職業未齊，已帶可用單位`);
    sfx.play("uiOk");
    return;
  }
  draftLoadout = ok.slice(0, LOADOUT_MAX);
  focusCardId = draftLoadout[0];
  renderCharacterGrid();
  showToast(`已套用「${p.nameZh}」：${ok.map((id) => SPECIALISTS[id]?.nameZh).join("、")}`);
  sfx.play("uiOk");
}

function openSettingsOverlay() {
  if (els.btnSettingsMute) {
    els.btnSettingsMute.textContent = sfx.muted ? "🔇 靜音中" : "🔊 開啟中";
  }
  setOverlayOpen(els.settingsOverlay, true);
  sfx.play("uiClick");
}

function closeSettingsOverlay() {
  setOverlayOpen(els.settingsOverlay, false);
  sfx.play("uiClick");
}

/**
 * 已登入就走 API 直讀（即時），沒登入才要貼短碼。
 * API 是直接讀 Bot 的 player-data.json，所以登入狀態下根本不需要玩家去
 * Discord 打 /同步 再複製貼上。
 */
/** 依登入與否切換視窗的兩種樣貌 */
function paintDiscordImport(logged) {
  if (els.discordImportLive) els.discordImportLive.hidden = !logged;
  if (els.discordImportManual) els.discordImportManual.hidden = logged;
  if (logged && els.discordImportLiveName) {
    els.discordImportLiveName.textContent = hubState.me?.username || "冒險者";
  }
  // 未登入時「預覽/確認匯入」才有意義（要有貼上的內容）
  if (els.btnDiscordImportPreview) els.btnDiscordImportPreview.hidden = logged;
  if (els.btnDiscordImportConfirm) els.btnDiscordImportConfirm.hidden = logged;
  // 上次可能被展開過手動路徑，每次開窗都要收回去
  if (els.btnDiscordImportManual) els.btnDiscordImportManual.hidden = !logged;
}

async function openDiscordImport() {
  if (els.discordImportText) els.discordImportText.value = "";
  if (els.discordImportPreview) {
    els.discordImportPreview.hidden = true;
    els.discordImportPreview.innerHTML = "";
  }

  // 先用手上的狀態畫一次，避免開窗閃爍
  paintDiscordImport(!!hubState.me);
  setOverlayOpen(els.discordImportOverlay, true);
  sfx.play("uiClick");

  // ⚠️ hubState.me 只有在開過「主城」之後才有值。玩家直接從存檔頁點匯入時
  //    它一定是 null，會誤判成未登入 —— 所以這裡要自己補問一次 session。
  if (!hubState.me) {
    try {
      const sess = await artaleHub.fetchSessionMe();
      if (sess?.me) {
        hubState.session = sess.session;
        hubState.me = sess.me;
        if (sess.session?.discordId) artaleHub.setLinkedDiscordId(sess.session.discordId);
        paintDiscordImport(true);
        return;
      }
    } catch {
      // 沒 session 或 API 掛掉 → 留在手動貼碼
    }
  }
  if (!hubState.me) setTimeout(() => els.discordImportText?.focus(), 50);
}

/** 手動展開貼短碼（已登入但想貼別人的碼 / API 掛掉時的退路） */
function showDiscordImportManual() {
  if (els.discordImportManual) els.discordImportManual.hidden = false;
  if (els.btnDiscordImportPreview) els.btnDiscordImportPreview.hidden = false;
  if (els.btnDiscordImportConfirm) els.btnDiscordImportConfirm.hidden = false;
  if (els.btnDiscordImportManual) els.btnDiscordImportManual.hidden = true;
  sfx.play("uiClick");
  setTimeout(() => els.discordImportText?.focus(), 50);
}

/** 一鍵同步：重新打 API 拿最新資料（不用 hubState 那份可能已經過期的快照） */
/**
 * 登入後自動帶入 Discord 角色。**非破壞性**：只有在本機三個存檔「全空」時才動作
 * （＝這台裝置第一次登入），把養好的角色直接帶進來，玩家不必再手動點「匯入」。
 * 只要任何一個存檔有進度 → 尊重既有存檔，什麼都不改（回訪玩家可用「重新同步」）。
 */
async function autoSyncOnLogin() {
  try {
    const slots = listSaveSlots() || [];
    const allEmpty = slots.length > 0 && slots.every((s) => s && s.empty);
    if (!allEmpty) {
      renderSaveSlots();
      return;
    }
    const me = await artaleHub.loadMe();
    hubState.me = me;
    const payload = payloadFromAccountSummary(me);
    if (!(payload.characters || []).length) {
      renderSaveSlots();
      return;
    }
    const { written } = importBridgeToSlots(payload);
    syncNickInput();
    refreshHomeMeta();
    renderSaveSlots();
    if (written.length) {
      showToast(
        `已自動帶入你的 ${written.length} 個角色：` +
          written.map((w) => `${w.name}(槽${w.slot + 1})`).join("、")
      );
    }
  } catch {
    // 自動同步失敗不打斷玩家，維持登入狀態即可（仍可手動重新同步）
    renderSaveSlots();
  }
}

async function doLiveSync() {
  // ⚠️ 同步會覆蓋存檔 1~3。本機已有非空存檔時先確認 —— 這是不可逆的資料損失，
  //    比刪除還危險（刪除有確認，覆蓋反而沒有）。空存檔就不用煩玩家。
  const hasProgress = (listSaveSlots() || []).some((s) => s && !s.empty);
  if (hasProgress) {
    const ok = await confirmDialog(
      "用 Discord 進度覆蓋本機存檔？",
      "會以你 Discord 的角色覆蓋存檔 1~3，本機現有進度將消失，無法復原。",
      { okText: "覆蓋同步", danger: true }
    );
    if (!ok) return;
  }
  const btn = els.btnDiscordImportLive;
  if (btn) {
    btn.disabled = true;
    btn.textContent = "同步中…";
  }
  try {
    const me = await artaleHub.loadMe();
    const payload = payloadFromAccountSummary(me);
    const { written } = importBridgeToSlots(payload);
    hubState.me = me;
    syncNickInput();
    refreshHomeMeta();
    renderSaveSlots();
    closeDiscordImport();
    // 超過 3 個角色會被靜默丟棄（只有 3 個存檔槽），要講出來
    const total = (me.characters || []).length;
    const dropped = Math.max(0, total - written.length);
    showToast(
      `已同步 ${written.length} 個角色：` +
        written.map((w) => `${w.name}(槽${w.slot + 1})`).join("、") +
        (dropped ? `（另有 ${dropped} 個角色因為只有 3 個存檔槽未帶入）` : "")
    );
    sfx.play("waveClear");
  } catch (e) {
    sfx.play("error");
    showToast(e?.message || "同步失敗，可改用手動貼短碼");
    // API 出問題就把手動路徑攤開來，玩家不會卡死
    showDiscordImportManual();
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = "⚡ 立即同步最新進度";
    }
  }
}

function closeDiscordImport() {
  setOverlayOpen(els.discordImportOverlay, false);
  sfx.play("uiClick");
}

function doDiscordPreview() {
  const raw = els.discordImportText?.value || "";
  const res = parseBridgePayload(raw);
  if (!res.ok) {
    sfx.play("error");
    showToast(res.error);
    if (els.discordImportPreview) {
      els.discordImportPreview.hidden = false;
      els.discordImportPreview.innerHTML = `<span style="color:#b33a2e">${escapeHtml(res.error)}</span>`;
    }
    return null;
  }
  const rows = previewImport(res.data);
  if (els.discordImportPreview) {
    els.discordImportPreview.hidden = false;
    els.discordImportPreview.innerHTML =
      `<strong>${escapeHtml(res.data.username || "")}</strong> · 楓葉 ${res.data.account?.mapleLeaves ?? 0}<br/>` +
      rows
        .map(
          (r) =>
            `存檔 ${r.slot}：${escapeHtml(r.name)} · ${escapeHtml(r.webJobName)} · Lv.${r.level} → ★${r.cardStars} · 解鎖 ${r.unlockedStages} 關`
        )
        .join("<br/>");
  }
  sfx.play("uiOk");
  return res.data;
}

async function doDiscordImport() {
  const data = doDiscordPreview();
  if (!data) return;
  // 覆蓋前確認（同 doLiveSync）：本機有非空存檔才問
  const hasProgress = (listSaveSlots() || []).some((s) => s && !s.empty);
  if (hasProgress) {
    const ok = await confirmDialog(
      "匯入會覆蓋本機存檔？",
      "會以貼上的進度覆蓋存檔 1~3，本機現有進度將消失，無法復原。",
      { okText: "覆蓋匯入", danger: true }
    );
    if (!ok) return;
  }
  try {
    const { written } = importBridgeToSlots(data);
    syncNickInput();
    refreshHomeMeta();
    renderSaveSlots();
    closeDiscordImport();
    showToast(
      `已匯入 ${written.length} 個角色：` +
        written.map((w) => `${w.name}(槽${w.slot + 1})`).join("、")
    );
    sfx.play("waveClear");
  } catch (e) {
    sfx.play("error");
    showToast(e?.message || "匯入失敗");
  }
}

function doDiscordExport() {
  try {
    const payload = exportSlotsAsBridge();
    const code = encodeBridgeCode(payload);
    if (els.discordImportText) {
      // reuse overlay to show export
      openDiscordImport();
      els.discordImportText.value = code;
      if (els.discordImportPreview) {
        els.discordImportPreview.hidden = false;
        els.discordImportPreview.textContent =
          "已產生進度碼（上方）。可複製貼到備註；反向同步 Bot 尚在規劃。";
      }
    }
    void navigator.clipboard?.writeText(code);
    showToast("進度碼已複製到剪貼簿");
    sfx.play("uiOk");
  } catch {
    sfx.play("error");
    showToast("匯出失敗");
  }
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
  refreshDexBadge();
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
      pendingChallenge = null; // 動作突襲：清掉週挑戰狀態
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

/**
 * 依登入與否切換存檔區的橋接列：
 * 已登入 = 角色自動帶入，手動「匯入/匯出」多餘 → 收起，改顯示一行連結狀態＋重新同步。
 */
function paintSaveBridgeBar() {
  const logged = !!hubState.me;
  if (els.discordBridgeBar) els.discordBridgeBar.hidden = logged;
  if (els.discordBridgeHint) els.discordBridgeHint.hidden = logged;
  if (els.discordLinkedRow) els.discordLinkedRow.hidden = !logged;
  if (logged && els.discordLinkedName) {
    els.discordLinkedName.textContent = hubState.me?.username || "冒險者";
  }
}

function renderSaveSlots() {
  if (!els.saveSlotList) return;
  paintSaveBridgeBar();
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
            // 用當下的 meta，不用渲染當時的閉包快照（期間可能已同步/匯入過）
            await openOrCreateSlot(idx, listSaveSlots()[idx] || slot);
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
        await openOrCreateSlot(i, listSaveSlots()[i] || slot);
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
    <h3>🐉 遠征 Boss（推線模式）</h3>
    <p>遠征採用<strong>貓咪大戰爭式</strong>玩法：點職業卡出兵，單位自動往右推，拆敵方基地獲勝。</p>
    <ul>
      <li><strong>海怒斯</strong>（水世界）物理無效、嘴炮、火柱</li>
      <li><strong>拉圖斯</strong>（玩具城）時空暫停、反射</li>
      <li><strong>殘暴炎魔</strong>（冰原）八臂封印、火柱</li>
      <li><strong>暗黑龍王</strong>（神木村）劇毒、連鎖閃電</li>
      <li><strong>皮卡啾</strong>（時間神殿 · 最難）封印、反盾、狂暴</li>
    </ul>
    <div class="guide-tip">💡 錢包會自動回復；Boss 波後可攻擊敵方基地。地區戰役仍是塔防佈陣。</div>
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

function fmtEta(sec) {
  const d = Math.floor(sec / 86400);
  const h = Math.floor((sec % 86400) / 3600);
  const m = Math.floor((sec % 3600) / 60);
  if (d > 0) return `${d} 天 ${h} 小時`;
  if (h > 0) return `${h} 小時 ${m} 分`;
  return `${m} 分`;
}

function openWeeklyOverlay() {
  const ch = getWeeklyChallenge();
  pendingChallenge = ch; // 先記著，「開始挑戰」才真正用
  hideAllOverlays();

  els.weeklyTitle.textContent = `第 ${ch.week} 週挑戰`;
  els.weeklyReset.textContent = `距離下週重置：${fmtEta(ch.resetEta)}`;
  els.weeklyStage.textContent = `🗺️ ${ch.baseStageName}`;
  els.weeklyMods.innerHTML = ch.modifiers
    .map(
      (m) =>
        `<div class="weekly-mod"><span class="weekly-mod-icon">${m.icon}</span>
          <div><strong>${escapeHtml(m.label)}</strong><small>${escapeHtml(m.desc)}</small></div></div>`
    )
    .join("");
  if (els.weeklyRestrict) {
    if (hasJobRestriction(ch)) {
      els.weeklyRestrict.hidden = false;
      els.weeklyRestrict.textContent = "⚠️ 本週有職業限制，部分職業無法出戰";
    } else {
      els.weeklyRestrict.hidden = true;
    }
  }

  setOverlayOpen(els.weeklyOverlay, true);
  void sfx.unlock();
  sfx.play("uiClick");
}

let dexTab = "jobs";

function openDexOverlay(tab = "jobs") {
  dexTab = tab;
  hideAllOverlays();
  renderDex();
  setOverlayOpen(els.dexOverlay, true);
  void sfx.unlock();
  sfx.play("uiClick");
}

function renderDex() {
  if (!els.dexGrid) return;
  const sum = getDexSummary();

  if (els.dexTabs) {
    els.dexTabs.querySelectorAll(".dex-tab").forEach((b) => {
      b.classList.toggle("is-active", b.dataset.tab === dexTab);
    });
  }

  if (dexTab === "jobs") {
    els.dexTitle.textContent = `職業圖鑑　${sum.jobs.done} / ${sum.jobs.total}`;
    els.dexSubtitle.textContent = "在防衛戰裡部署過的職業會亮起。用你在 Discord 練的角色收集全部！";
    const rows = getJobDex();
    els.dexGrid.innerHTML = rows
      .map((j) => {
        if (!j.used) {
          return `<div class="dex-cell dex-locked" title="尚未使用"><span class="dex-q">?</span></div>`;
        }
        return `<div class="dex-cell dex-owned" style="--dex-c:${j.color || "#6aaa62"}" title="${escapeHtml(j.nameZh)}">
          <span class="dex-dot"></span><span class="dex-name">${escapeHtml(j.nameZh)}</span></div>`;
      })
      .join("");
  } else {
    els.dexTitle.textContent = `怪物圖鑑　擊倒 ${sum.enemies.killed} / ${sum.enemies.total}`;
    els.dexSubtitle.textContent = "遇到會顯示剪影，擊倒後解鎖名字。Boss 排在最後。";
    const rows = getEnemyDex();
    els.dexGrid.innerHTML = rows
      .map((e) => {
        if (!e.seen) {
          return `<div class="dex-cell dex-locked ${e.boss ? "dex-boss" : ""}" title="未遭遇"><span class="dex-q">?</span></div>`;
        }
        const cls = e.killed ? "dex-owned" : "dex-seen";
        const nameHtml = e.killed
          ? `<span class="dex-name">${escapeHtml(e.nameZh)}</span>`
          : `<span class="dex-name dex-shadow">？？？</span>`;
        return `<div class="dex-cell ${cls} ${e.boss ? "dex-boss" : ""}" style="--dex-c:${e.color || "#b45"}" title="${e.killed ? escapeHtml(e.nameZh) : "已遭遇，尚未擊倒"}">
          <span class="dex-dot"></span>${nameHtml}</div>`;
      })
      .join("");
  }
}

/** 首頁圖鑑按鈕的完成度徽章 */
function refreshDexBadge() {
  if (!els.homeDexBadge) return;
  const sum = getDexSummary();
  els.homeDexBadge.textContent = `${sum.percent}%`;
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
  if (rankTab === "weekly") {
    const ch = getWeeklyChallenge();
    rows = getWeeklyLeaderboard(ch.week, 15).map((r) => ({
      nick: r.nick,
      score: r.score,
      detail: `★${r.stars || 0}`,
      at: r.at,
    }));
  } else if (rankTab === "arena") {
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
    els.rankList.innerHTML =
      rankTab === "weekly"
        ? `<p class="muted center-hint">本週還沒有人達成 — 去「⚔️ 每週挑戰」搶頭香！</p>`
        : `<p class="muted center-hint">尚無紀錄 — 通關或打競賽後寫入</p>`;
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
  // 若在城鎮進的塔防結束(塔防走 openTitleScreen 出場)，攔截回城鎮
  if (_townReturn) { _townReturn = false; stopTown(); void openTown(); return; }
  screen = "stage";
  closeCharacterChrome();
  closeCoach({ mark: false });
  document.body.classList.remove("in-play", "mode-bc", "mode-td");
  document.body.classList.add("home-open");
  hideAllOverlays();
  flushActiveSlot();
  setCampaignPanelOpen(false);
  if (els.titleScreen) els.titleScreen.style.visibility = "visible";
  // 只刷新繼續按鈕／楓葉，不把關卡列表塞進主畫面
  const progress = loadProgress();
  let nextIdx = STAGES.findIndex((_, i) => isStageUnlocked(i, progress) && !progress.cleared[STAGES[i].id]);
  if (nextIdx < 0) nextIdx = Math.min(STAGES.length - 1, (progress.unlocked || 1) - 1);
  refreshHomeMeta(progress, nextIdx);
  paintTitleAuth();
  setOverlayOpen(els.stageOverlay, true);
  void sfx.unlock();
  if (!sfx.muted) sfx.startBgm("menu");
  if (game) ui.onState(game.getPublicState());
}

/** 開場依登入狀態切換：未登入=官方登入頁；已登入=模式選擇選單 */
function paintTitleAuth() {
  const logged = !!hubState.me;
  const login = document.getElementById("title-login");
  const menu = document.getElementById("title-menu");
  if (login) login.hidden = logged;
  if (menu) menu.hidden = !logged;
  document.querySelectorAll(".title-auth-in").forEach((el) => { el.hidden = !logged; });
  document.querySelectorAll(".title-auth-out").forEach((el) => { el.hidden = logged; });
}
/** 開場先探登入狀態(顯示正確選單) */
async function bootAuthCheck() {
  try {
    await artaleHub.healthCheck();
    const sess = await artaleHub.fetchSessionMe();
    hubState.session = sess.session;
    hubState.me = sess.me;
  } catch { hubState.me = null; }
  paintTitleAuth();
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

/**
 * 玩家「已學會且可部署」的職業，強度高→低排序（初心者永遠墊底）。
 * 給登入/匯入角色後自動編隊用：有英雄就不該預設塞初心者。
 */
function deployableLearnedJobs() {
  const learned = loadLearnedJobs();
  return Object.keys(learned)
    .filter(
      (id) =>
        canDeployJob(id) && (!pendingChallenge || isJobAllowedThisWeek(id, pendingChallenge))
    )
    .sort((a, b) => {
      const ta = SPECIALISTS[a]?.jobTier ?? 0;
      const tb = SPECIALISTS[b]?.jobTier ?? 0;
      if (ta !== tb) return tb - ta; // 高轉優先
      return (SPECIALISTS[b]?.dps || 0) - (SPECIALISTS[a]?.dps || 0);
    });
}

function openCharacterSelect() {
  if (!game) return;
  screen = "char";
  document.body.classList.remove("home-open");
  hideAllOverlays();
  markJobLearned("beginner");
  // Only keep deployable jobs in draft
  const prevSel = game.loadout?.length ? game.loadout : [];
  let base = prevSel.filter(
    (id) => canDeployJob(id) && (!pendingChallenge || isJobAllowedThisWeek(id, pendingChallenge))
  );
  // ⚠️ 登入/匯入角色後最常見的抱怨：「有英雄了誰要用初心者」。
  //    玩家若還沒手動編過隊（base 空、或只剩初心者），但已有更強的已學職業，
  //    就自動把最強的幾個帶進編隊，讓養好的角色一進來就能打。
  const onlyBeginner = base.length === 0 || (base.length === 1 && base[0] === "beginner");
  if (onlyBeginner) {
    const strong = deployableLearnedJobs().filter((id) => id !== "beginner");
    if (strong.length) base = strong.slice(0, LOADOUT_MAX);
  }
  if (!base.length) base = ["beginner"];
  draftLoadout = base;
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
  // 週挑戰的編隊限制：本週禁用的職業比照未解鎖處理（標灰、不可選）
  const bannedThisWeek =
    !!pendingChallenge && !isJobAllowedThisWeek(id, pendingChallenge);
  const deployable = canDeployJob(id) && !bannedThisWeek;
  const unlocked = isJobUnlocked(id);
  const lockHint = bannedThisWeek ? "本週規則卡禁用此職業" : getUnlockHint(id);

  const btn = document.createElement("button");
  btn.type = "button";
  btn.className =
    "char-pick" +
    (selected ? " selected" : "") +
    (focused ? " focused" : "") +
    (!deployable ? " locked" : "") +
    (bannedThisWeek ? " banned-week" : "");
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
  game.loadStage(pendingStageId, { challenge: pendingChallenge });
  game.setLoadout(draftLoadout);
  hideAllOverlays();
  screen = "play";
  document.body.classList.add("in-play");
  document.body.classList.remove("home-open");
  refreshWaveIntel();
  const st = game.getPublicState();
  applyModeSkin(st);
  renderSpecialistCards(st);
  ui.onState(st);
  const names = draftLoadout.map((id) => SPECIALISTS[id].nameZh).join("、");
  const bc = !!st.bcMode;
  showToast(
    bc
      ? `遠征：${names} — 點卡出兵，推倒敵方基地`
      : `出戰：${names} — 部署後開始防禦`
  );
  sfx.play("waveStart");
  // 首次：互動引導（取代硬塞說明浮層）
  setTimeout(() => {
    if (screen === "play" && game && !game.result) openCoachIfNeeded(bc);
  }, 350);
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

    applyModeSkin(state);
    updateSlimHud(state);
    updateWaveCta(state);
    renderBcDock(state);

    els.core.textContent = state.bcMode
      ? `${state.coreHp}/${state.coreMax || state.coreHp}`
      : `${state.coreHp}`;
    els.wave.textContent =
      state.waveIndex < 0 ? `0 / ${state.waveTotal}` : `${state.waveIndex + 1} / ${state.waveTotal}`;
    els.points.textContent = state.bcMode
      ? `${state.points}${state.walletMax ? `/${state.walletMax}` : ""}`
      : `${state.points}`;
    els.team.textContent = `${state.teamCount} / ${state.teamLimit}`;
    if (els.lblCore) els.lblCore.textContent = state.bcMode ? "我方基地" : "神木";
    if (els.lblPoints) els.lblPoints.textContent = state.bcMode ? "錢包" : "點數";
    if (els.lblMesos) els.lblMesos.textContent = state.bcMode ? "敵方基地" : "楓幣";
    if (els.lblTeam) els.lblTeam.textContent = state.bcMode ? "出兵" : "場上";
    if (els.mesosHud) {
      els.mesosHud.textContent = state.bcMode
        ? `${Math.ceil(state.enemyCastleHp || 0)}`
        : String(state.mesos ?? 0);
    }
    // 遠征：敵方基地也畫一條進度（用 wave fill 旁的 mesos chip 即可）
    if (state.bcMode && els.fillCore && state.coreMax > 0) {
      /* already via updateSlimHud */
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
      ? state.bcMode
        ? `出戰：${names.join("、")} · 點卡出兵推線`
        : `出戰：${names.join("、")} · 點選或拖到綠格`
      : "請先完成角色選擇";

    renderCombatHud(state);
    // 神木數字閃紅
    if (els.core && (state.coreHitFlash || 0) > 0.35) {
      els.core.classList.add("is-hurt");
    } else if (els.core) {
      els.core.classList.remove("is-hurt");
    }

    const selected = game.specialists.find((s) => s.id === state.selectedSpecialistId);
    if (state.bcMode) {
      const castle = Math.ceil(state.enemyCastleHp || 0);
      const cmax = Math.ceil(state.enemyCastleMax || 1);
      els.selectedInfo.innerHTML = `
        <strong>遠征推線</strong>（貓咪大戰爭風）<br/>
        <span class="muted">點右側職業卡出兵 · 錢包自動回復<br/>
        敵方基地 ${castle}/${cmax}${state.waveIndex >= (state.waveTotal || 1) - 1 ? " · 可拆塔" : " · Boss 波後可拆塔"}</span>`;
    } else if (selected) {
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
  // 遠征 BC：點一下直接出兵
  if (state.bcMode) {
    void sfx.unlock();
    game.tryDeployBc(id);
    return;
  }
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
  // 遠征：不拖曳，點一下出兵
  if (state.bcMode) {
    void sfx.unlock();
    e.preventDefault();
    game.tryDeployBc(id);
    return;
  }
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
    const onCd = state?.bcMode && state?.spawnCd?.[id] > 0;
    if (cantAfford || teamFull || blocked || onCd) btn.classList.add("disabled");
    btn.title = state?.bcMode ? "點一下出兵（推線）" : "按住拖到地圖綠格部署";

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
    const actHint = state?.bcMode
      ? onCd
        ? `冷卻 ${state.spawnCd[id].toFixed(1)}s`
        : "點一下出兵"
      : "拖曳部署";
    text.innerHTML = `<strong>${d.nameZh} ★${lv}</strong><small>${lastSkill} · 傷${leveled.damage} · ${actHint}</small>`;

    const cost = document.createElement("span");
    cost.className = "cost";
    cost.textContent = String(leveled.cost);

    btn.append(img, text, cost);

    if (!cantAfford && !teamFull && !blocked && !onCd) {
      btn.addEventListener("pointerdown", (e) => beginSpecialistDrag(e, id, d));
    } else {
      btn.addEventListener("click", () => {
        if (onCd) showToast("出兵冷卻中");
        else if (cantAfford) showToast(state?.bcMode ? "錢包不足" : "部署點數不足");
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

function startWaveFromUi() {
  if (!game) return;
  if (coachState) closeCoach({ mark: true });
  game.startNextWave();
  updateWaveCta(game.getPublicState());
}

els.btnStart?.addEventListener("click", () => withAudio(startWaveFromUi));
els.btnWaveCta?.addEventListener("click", () => withAudio(startWaveFromUi));
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
    closeCoach({ mark: false });
    openCampaignPanel(1);
  })
);
els.btnPauseChars?.addEventListener("click", () =>
  withAudio(() => {
    sfx.play("uiClick");
    if (game) {
      game.setPaused(false);
      game.result = null;
    }
    clearRunState();
    closePauseOverlay({ resume: false });
    closeCoach({ mark: false });
    pendingStageId = game?.stageId || STAGES[0]?.id || "s01-victoria";
    openCharacterSelect();
  })
);
els.btnPauseHome?.addEventListener("click", () =>
  withAudio(() => {
    sfx.play("uiClick");
    if (game) {
      game.setPaused(false);
      game.result = null;
    }
    clearRunState();
    closePauseOverlay({ resume: false });
    closeCoach({ mark: false });
    openTitleScreen();
  })
);
els.btnPauseMute?.addEventListener("click", () =>
  withAudio(() => {
    game?.toggleMute?.() || sfx.toggleMute();
    if (els.btnPauseMute) {
      els.btnPauseMute.textContent = sfx.muted ? "🔇 開音樂" : "🔊 音樂";
    }
    updateMuteButton(sfx.muted);
  })
);
els.btnCoachNext?.addEventListener("click", () => withAudio(coachNext));
els.btnCoachSkip?.addEventListener("click", () =>
  withAudio(() => {
    closeCoach({ mark: true });
    sfx.play("uiClick");
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
    openRankOverlay(rankTab || "weekly");
  })
);
els.btnEnterHub?.addEventListener("click", () => withAudio(() => { void openTown(); }));
els.btnActionRaidExit?.addEventListener("click", () =>
  withAudio(() => {
    stopActionRaid();
    setOverlayOpen(els.actionRaidOverlay, false);
    afterActivity(openArtaleHub);
  })
);
els.btnHuntExit?.addEventListener("click", () =>
  withAudio(() => {
    if (huntSession) void reportHuntSession(lastHuntMapId, huntStartedAt);
    stopHunt();
    setOverlayOpen(els.huntOverlay, false);
    afterActivity(openArtaleHub);
  })
);
els.btnCsEnter?.addEventListener("click", () => withAudio(() => { stopCsAvatarLoop(); csEnter(); }));
els.btnCsCustomize?.addEventListener("click", () => withAudio(openCustomize));
document.querySelector("#btn-cs-equip")?.addEventListener("click", () => withAudio(openEquip));
document.querySelector("#btn-equip-close")?.addEventListener("click", () => withAudio(() => setOverlayOpen(document.querySelector("#equip-overlay"), false)));
els.btnCsBack?.addEventListener("click", () => withAudio(() => { stopCsAvatarLoop(); setOverlayOpen(els.charSelectOverlay, false); openTitleScreen(); }));
els.btnCzSave?.addEventListener("click", () => withAudio(czSave));
els.btnCzCancel?.addEventListener("click", () => withAudio(() => setOverlayOpen(els.customizeOverlay, false)));
els.btnHuntPickerClose?.addEventListener("click", () => withAudio(() => { setOverlayOpen(els.huntPickerOverlay, false); openArtaleHub(); }));
els.btnHuntKeys?.addEventListener("click", () => withAudio(openKeybinds));
els.btnKeybindReset?.addEventListener("click", () => withAudio(() => { _kbDraft = { ...DEFAULT_KEYBINDS, skills: [...DEFAULT_KEYBINDS.skills] }; renderKeybinds(); }));
els.btnKeybindSave?.addEventListener("click", () => withAudio(() => { saveKeybinds(_kbDraft); setOverlayOpen(els.keybindOverlay, false); showToast("按鍵已儲存"); }));
window.addEventListener("keydown", onKeybindCapture, true);
els.btnActionRaidHub?.addEventListener("click", () =>
  withAudio(() => {
    stopActionRaid();
    setOverlayOpen(els.actionRaidOverlay, false);
    afterActivity(openArtaleHub);
  })
);
els.btnActionRaidRetry?.addEventListener("click", () =>
  withAudio(async () => {
    try {
      await launchActionRaid(lastRaidBossId);
    } catch (e) {
      showToast(e.message || "無法再戰");
    }
  })
);
els.btnStartGame?.addEventListener("click", () =>
  withAudio(() => {
    openCampaignPanel(1);
  })
);
// 官方登入頁
document.querySelector("#btn-login-discord")?.addEventListener("click", () => withAudio(() => artaleHub.startDiscordOAuth()));
document.querySelector("#btn-login-guest")?.addEventListener("click", (e) => { e.preventDefault(); withAudio(() => openCampaignPanel(1)); });
// 未登入：Discord 登入(選單內備用)
document.querySelector("#btn-maple-login")?.addEventListener("click", () => withAudio(() => artaleHub.startDiscordOAuth()));
// 已登入模式：掛機探險 / Boss 突襲
document.querySelector("#btn-mode-hunt")?.addEventListener("click", () => withAudio(() => {
  if (!hubState.me) return artaleHub.startDiscordOAuth();
  if ((hubState.me.characters || []).length) openCharSelect(openHuntPicker);
  else openHuntPicker();
}));
document.querySelector("#btn-mode-raid")?.addEventListener("click", () => withAudio(() => {
  if (!hubState.me) return artaleHub.startDiscordOAuth();
  hubState.tab = "combat";
  openArtaleHub();
}));
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
    openRankOverlay(rankTab || "weekly");
  })
);
els.btnHomeDex?.addEventListener("click", () =>
  withAudio(() => {
    openDexOverlay(dexTab || "jobs");
  })
);
els.btnWeekly?.addEventListener("click", () => withAudio(() => openWeeklyOverlay()));
els.btnWeeklyCancel?.addEventListener("click", () =>
  withAudio(() => {
    pendingChallenge = null;
    setOverlayOpen(els.weeklyOverlay, false);
    openTitleScreen();
  })
);
els.btnWeeklyStart?.addEventListener("click", () =>
  withAudio(() => {
    if (!pendingChallenge) return;
    pendingStageId = pendingChallenge.baseStageId;
    setOverlayOpen(els.weeklyOverlay, false);
    openCharacterSelect(); // pendingChallenge 保留 → 職業選擇會套用限制，confirm 時帶進 loadStage
  })
);
els.btnDexClose?.addEventListener("click", () =>
  withAudio(() => {
    sfx.play("uiClick");
    setOverlayOpen(els.dexOverlay, false);
    openTitleScreen();
  })
);
els.dexTabs?.addEventListener("click", (e) => {
  const btn = e.target.closest?.(".dex-tab");
  if (!btn) return;
  withAudio(() => {
    dexTab = btn.dataset.tab;
    renderDex();
  });
});
els.btnHomeGuide?.addEventListener("click", () =>
  withAudio(() => {
    openGuideOverlay("play");
  })
);
els.btnHomeSettings?.addEventListener("click", () =>
  withAudio(() => {
    openSettingsOverlay();
  })
);
els.btnSettingsClose?.addEventListener("click", () =>
  withAudio(() => {
    closeSettingsOverlay();
  })
);
els.btnSettingsMute?.addEventListener("click", () =>
  withAudio(() => {
    if (game) game.toggleMute();
    else sfx.toggleMute();
    if (els.btnSettingsMute) {
      els.btnSettingsMute.textContent = sfx.muted ? "🔇 靜音中" : "🔊 開啟中";
    }
    updateMuteButton(sfx.muted);
  })
);
els.btnSettingsResetCoach?.addEventListener("click", () =>
  withAudio(() => {
    try {
      localStorage.removeItem(COACH_SEEN_KEY);
      localStorage.removeItem(HELP_SEEN_KEY);
    } catch {
      /* ignore */
    }
    showToast("已重設新手引導 — 下次進關會再出現");
    sfx.play("uiOk");
  })
);
els.btnSettingsHelp?.addEventListener("click", () =>
  withAudio(() => {
    closeSettingsOverlay();
    openGuideOverlay("play");
  })
);
els.loadoutPresets?.addEventListener("click", (ev) => {
  const b = ev.target.closest("[data-preset]");
  if (!b) return;
  withAudio(() => {
    const key = b.getAttribute("data-preset");
    const id = PRESET_HTML_MAP[key] || key;
    applyLoadoutPresetById(id);
  });
});
// 未登入主 CTA：直接走 Discord 登入（登入後角色自動帶入，不用手動匯入）
els.btnDiscordImport?.addEventListener("click", () => withAudio(() => artaleHub.startDiscordOAuth()));
// 沒有 Discord 的備援：貼 /同步 短碼
els.btnDiscordCode?.addEventListener("click", () => withAudio(openDiscordImport));
els.btnDiscordExport?.addEventListener("click", () => withAudio(doDiscordExport));
els.btnDiscordResync?.addEventListener("click", () => withAudio(doLiveSync));
els.btnDiscordImportCancel?.addEventListener("click", () => withAudio(closeDiscordImport));
els.btnDiscordImportPreview?.addEventListener("click", () => withAudio(doDiscordPreview));
els.btnDiscordImportConfirm?.addEventListener("click", () => withAudio(doDiscordImport));
els.btnDiscordImportLive?.addEventListener("click", () => withAudio(doLiveSync));
els.btnDiscordImportManual?.addEventListener("click", () => withAudio(showDiscordImportManual));
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
    if (!game.paused && !game.pausedForReward) startWaveFromUi();
    return;
  }
  // 引導中 Esc 略過
  if (coachState && e.key === "Escape") {
    e.preventDefault();
    closeCoach({ mark: true });
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
    if (loadout[i]) {
      if (game.bcMode) game.tryDeployBc(loadout[i]);
      else game.setPlacing(loadout[i]);
    }
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
  }
  // ⚠️ 一律隱藏：原本只在非靜音時 hide，靜音玩家的提示橫幅會永遠卡在畫面擋內容。
  //    玩家既然已互動過，這個一次性提示就沒有存在必要了。
  hideAudioBanner();
  window.removeEventListener("pointerdown", unlockOnce);
  window.removeEventListener("keydown", unlockOnce);
};
window.addEventListener("pointerdown", unlockOnce, { capture: true });
window.addEventListener("keydown", unlockOnce, { capture: true });

function ensureAudioBanner() {
  let el = document.querySelector("#audio-banner");
  if (el) return el;
  el = document.createElement("button");
  el.type = "button";
  el.id = "audio-banner";
  el.className = "audio-banner";
  el.hidden = true;
  el.textContent = "♪ 點一下開啟背景音樂";
  el.addEventListener("click", () => {
    void sfx.unlock();
    void sfx.preload();
    if (!sfx.muted) sfx.startBgm(screen === "play" && game?.waveActive ? "battle" : "menu");
    hideAudioBanner();
    updateMuteButton(sfx.muted);
  });
  document.body.appendChild(el);
  return el;
}

function hideAudioBanner() {
  const el = document.querySelector("#audio-banner");
  if (el) el.hidden = true;
}

function showAudioBanner(msg) {
  const el = ensureAudioBanner();
  el.textContent = msg;
  el.hidden = false;
}

// Preload LPC chibi portraits early
void preloadLpcPortraits(SPECIALIST_ORDER);

// If previously muted in localStorage, show it clearly
updateMuteButton(sfx.muted);
if (sfx.muted) {
  setTimeout(() => showAudioBanner("🔇 目前靜音 — 點此開啟音樂"), 500);
} else {
  setTimeout(() => showAudioBanner("♪ 點一下開啟背景音樂"), 400);
}
refreshWaveIntel();
renderSpecialistCards(game.getPublicState());
ui.onState(game.getPublicState());
game.start();
openTitleScreen();
void bootAuthCheck();

// 全域官方 UI 音效：任何可點元素 click→BtMouseClick、hover→BtMouseOver
// (sfx 內對 uiClick/uiHover 有節流，與各處明確呼叫不會重複播放)
(() => {
  const CLICKABLE = "button, a, [role=\"button\"], .cs-fig, .title-btn, .title-icon-btn, .cs-sign-btn";
  document.addEventListener("click", (e) => {
    const el = e.target?.closest?.(CLICKABLE);
    if (el && !el.disabled) sfx.play("uiClick");
  }, true);
  document.addEventListener("pointerover", (e) => {
    if (e.pointerType && e.pointerType !== "mouse") return; // 手機不觸發 hover 音
    const el = e.target?.closest?.(CLICKABLE);
    if (el && !el.disabled) sfx.play("uiHover");
  }, true);
})();

// DEV：截圖驗證登入態畫面（?devcs / ?devhunt），僅測試用
if (location.search.includes("dev")) {
  window.__devChars = () => {
    hubState.me = { username: "測試員", characters: [
      { charId: "1", name: "阿劍", class: "hero", level: 50, isActive: true, levelStats: { str: 80, dex: 20, int: 4, luk: 15 } },
      { charId: "2", name: "小弓", class: "bowmaster", level: 30, levelStats: { str: 10, dex: 90, int: 4, luk: 30 } },
      { charId: "3", name: "法師", class: "fire_mage", level: 40, levelStats: { str: 4, dex: 20, int: 95, luk: 10 } },
    ] };
    hubState.session = { discordId: "dev" };
  };
  window.__devCharSelect = () => { window.__devChars(); openCharSelect(); };
  window.__devTitle = () => { window.__devChars(); openTitleScreen(); };
  window.__devHunt = async () => { window.__devChars(); try { await openHunt("dev"); } catch (e) { console.error(e); } };
  window.__devRaid = async () => { window.__devChars(); try { await launchActionRaid("zakum"); } catch (e) { console.error(e); } };
  window.__devTown = async () => { window.__devChars(); try { await openTown(); } catch (e) { console.error(e); } };
}

// 可探索城鎮 Hub
function stopTown() { if (townSession) { townSession.stop(); townSession = null; } }
/** 副本結束後：若從城鎮進來則回城鎮，否則回主城 */
function afterActivity(fallback) { if (_townReturn) { _townReturn = false; void openTown(); } else fallback(); }
async function openTown() {
  if (!_townData) _townData = await (await fetch("/town/fm/town.json")).json();
  const town = _townData;
  const activeChar = (hubState.me?.characters || []).find((c) => c.isActive) || (hubState.me?.characters || [])[0];
  let appearance;
  try { appearance = equipToAppearance(await artaleHub.fetchEquip(), activeChar?.class); }
  catch { appearance = loadAppearance(activeChar?.charId, activeChar?.class); }
  const profile = { name: activeChar?.name || "冒險者", level: activeChar?.level || 1, maxHp: 600, maxMp: 300 };
  // 活動傳送門：放在出生點平台附近
  const sp = town.portals.find((p) => p.n === "sp") || { x: 179, y: 30 };
  const acts = [
    { label: "🗡️ 掛機探險", act: "hunt", x: sp.x - 120, y: 30, color: "#7ed957" },
    { label: "🛡️ 神木防衛戰", act: "tower", x: sp.x, y: 30, color: "#ffd23c" },
    { label: "🐉 Boss 突襲", act: "raid", x: sp.x + 120, y: 30, color: "#ff6b6b" },
  ];
  stopTown();
  hideAllOverlays();
  const overlay = document.querySelector("#town-overlay");
  setOverlayOpen(overlay, true);
  townSession = createTown({
    canvas: document.querySelector("#town-canvas"),
    town, appearance, charClass: activeChar?.class, profile, acts,
    onAct: (a) => {
      _townReturn = true; stopTown(); setOverlayOpen(overlay, false);
      if (a.act === "hunt") void openHunt("dev");
      else if (a.act === "raid") void launchActionRaid("zakum");
      else if (a.act === "tower") openCampaignPanel(1); // 塔防結束走 openTitleScreen→攔截回城鎮
    },
    onNpc: (n) => openNpcDialog(n),
    onExit: () => { stopTown(); setOverlayOpen(overlay, false); openTitleScreen(); },
  });
  townSession.start();
  sfx.startBgm("menu");
}
document.querySelector("#btn-town-exit")?.addEventListener("click", () => withAudio(() => { stopTown(); setOverlayOpen(document.querySelector("#town-overlay"), false); openTitleScreen(); }));

// NPC 對話框（台詞 + 接真功能選項）
const NPC_DATA = {
  "9030000": { line: "冒險家你好！要看看你身上的裝備嗎？", opts: [{ t: "🎒 查看裝備", fn: () => { closeNpcDialog(); openEquip(); } }] },
  "9030100": { line: "嘿嘿，想知道有哪些怪物、掉哪些寶？看看圖鑑吧！", opts: [{ t: "📖 怪物圖鑑", fn: () => { closeNpcDialog(); openDexOverlay(); } }] },
  "9300011": { line: "呵呵呵～想看看誰最有錢最強嗎？去看排行榜！", opts: [{ t: "🏆 排行榜", fn: () => { closeNpcDialog(); openRankOverlay(); } }] },
};
function closeNpcDialog() {
  setOverlayOpen(document.querySelector("#npc-dialog-overlay"), false);
  townSession?.resume();
}
function openNpcDialog(npc) {
  townSession?.pause();
  const data = NPC_DATA[String(npc.id)];
  const img = document.querySelector("#npc-dialog-img");
  if (img) img.src = `https://maplestory.io/api/GMS/214/npc/${npc.id}/render/stand`;
  const nameEl = document.querySelector("#npc-dialog-name");
  if (nameEl) nameEl.textContent = npc.name || "NPC";
  const txtEl = document.querySelector("#npc-dialog-text");
  if (txtEl) txtEl.textContent = data?.line || `你好，我是「${npc.name || "這裡的居民"}」，歡迎來到自由市場！`;
  const acts = document.querySelector("#npc-dialog-actions");
  if (acts) {
    acts.innerHTML = "";
    for (const o of (data?.opts || [])) {
      const btn = document.createElement("button");
      btn.className = "btn primary"; btn.textContent = o.t;
      btn.addEventListener("click", () => withAudio(o.fn));
      acts.appendChild(btn);
    }
    const close = document.createElement("button");
    close.className = "btn"; close.textContent = "結束對話";
    close.addEventListener("click", () => withAudio(closeNpcDialog));
    acts.appendChild(close);
  }
  setOverlayOpen(document.querySelector("#npc-dialog-overlay"), true);
  sfx.play("uiSelect");
}
