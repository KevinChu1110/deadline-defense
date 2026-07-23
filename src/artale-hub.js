/**
 * Artale 主城 Hub — Discord OAuth 登入 + 角色／裝備／星力／潛能
 */

const SESSION_KEY = "artale-web-discord-id";

/** SIT 預設 API（Netlify 前端 + ngrok）；可被 VITE_API_BASE 覆寫 */
const DEFAULT_NGROK_API =
  "https://primary-marmoset-publicly.ngrok-free.app/defense";

/**
 * API 絕對／相對路徑
 * - Netlify 前端 + ngrok API：VITE_API_BASE 或 runtime 偵測 *.netlify.app
 * - 本機 Vite：不設，走同源 /api（proxy）
 */
export function apiUrl(p) {
  const clean = String(p || "").replace(/^\//, "");
  let apiBase = String(import.meta.env.VITE_API_BASE || "").replace(/\/$/, "");
  // Netlify 建置若漏塞 env，runtime 仍要打到 ngrok（否則會打到自己網站 /api 失敗）
  if (!apiBase && typeof location !== "undefined") {
    const host = location.hostname || "";
    if (host === "maplestory-defense.netlify.app" || host.endsWith(".netlify.app")) {
      apiBase = DEFAULT_NGROK_API;
    }
  }
  if (apiBase) return `${apiBase}/${clean}`;
  const base = import.meta.env.BASE_URL || "/";
  if (base === "/") return `/${clean}`;
  return `${base.replace(/\/?$/, "/")}${clean}`;
}

/** 是否跨站 API（用於錯誤文案） */
export function isRemoteApi() {
  if (import.meta.env.VITE_API_BASE) return true;
  if (typeof location === "undefined") return false;
  const host = location.hostname || "";
  return host === "maplestory-defense.netlify.app" || host.endsWith(".netlify.app");
}

export function getLinkedDiscordId() {
  try {
    return localStorage.getItem(SESSION_KEY) || "";
  } catch {
    return "";
  }
}

export function setLinkedDiscordId(id) {
  try {
    if (id) localStorage.setItem(SESSION_KEY, String(id));
    else localStorage.removeItem(SESSION_KEY);
  } catch {
    /* ignore */
  }
}

async function api(path, opts = {}) {
  const { headers: extraHeaders, ...rest } = opts || {};
  const res = await fetch(apiUrl(path), {
    credentials: "include",
    ...rest,
    headers: {
      "Content-Type": "application/json",
      // ngrok free：瀏覽器 fetch 必須帶此 header，否則回警告 HTML → 被當成 API 掛了
      "ngrok-skip-browser-warning": "69420",
      ...(extraHeaders || {}),
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || data.hint || `HTTP ${res.status}`);
  return data;
}

export async function getAuthConfig() {
  return api("/api/auth/config");
}

export async function fetchSessionMe() {
  return api("/api/auth/me");
}

export async function logoutSession() {
  return api("/api/auth/logout", { method: "POST", body: "{}" });
}

export async function devLogin(discordId, username) {
  return api("/api/auth/dev-login", {
    method: "POST",
    body: JSON.stringify({ discordId, username }),
  });
}

/** 導向 Discord OAuth（全頁） */
export function startDiscordOAuth() {
  // 走同源 /api → vite proxy 或 nginx /defense/ → API
  window.location.href = apiUrl("/api/auth/discord");
}

export async function searchPlayers(q) {
  return api(`/api/dev/search?q=${encodeURIComponent(q || "")}`);
}

export async function loadMe(discordId) {
  if (discordId) {
    return api(`/api/me?discordId=${encodeURIComponent(discordId)}`);
  }
  return api("/api/me");
}

export async function selectChar(discordId, charId) {
  return api("/api/me/select-char", {
    method: "POST",
    body: JSON.stringify({ discordId, charId }),
  });
}

export async function healthCheck() {
  return api("/api/health");
}

export async function fetchEquip() {
  return api("/api/equip");
}

export async function wearItem(itemId, subIdx = 0) {
  return api("/api/equip/wear", {
    method: "POST",
    body: JSON.stringify({ itemId, subIdx }),
  });
}

export async function unequipSlot(slot, subIdx = 0) {
  return api("/api/equip/unequip", {
    method: "POST",
    body: JSON.stringify({ slot, subIdx }),
  });
}

export async function fetchStarforce() {
  return api("/api/starforce");
}

export async function attemptStarforce(slot, subIdx = 0, safeguard = false) {
  return api("/api/starforce/attempt", {
    method: "POST",
    body: JSON.stringify({ slot, subIdx, safeguard }),
  });
}

export async function fetchPotential() {
  return api("/api/potential");
}

export async function usePotential(slot, subIdx, action) {
  return api("/api/potential/use", {
    method: "POST",
    body: JSON.stringify({ slot, subIdx, action }),
  });
}

export async function craftPotential(toKey, times = 1) {
  return api("/api/potential/craft", {
    method: "POST",
    body: JSON.stringify({ toKey, times }),
  });
}

export async function fetchCombatProfile() {
  return api("/api/combat/profile");
}

export async function startActionRaid(bossId = "zakum") {
  return api("/api/combat/raid/start", {
    method: "POST",
    body: JSON.stringify({ bossId }),
  });
}

export async function completeActionRaid(payload) {
  return api("/api/combat/raid/complete", {
    method: "POST",
    body: JSON.stringify(payload || {}),
  });
}

const CLASS_ZH = {
  beginner: "初心者",
  gunslinger: "槍神／槍手",
  dark_knight: "黑騎士",
  hero: "英雄",
  paladin: "聖騎士",
  mage: "主教線",
  fire_mage: "火毒",
  ice_mage: "冰雷",
  bowmaster: "箭神",
  marksman: "神射手",
  night_envoy: "夜使者",
  shadow_bandit: "暗影神偷",
  buccaneer: "拳霸",
  soul_swordsman: "聖魂劍士",
  flame_wizard: "烈焰巫師",
  wind_breaker: "破風使者",
  night_walker: "暗夜行者",
  thunder_breaker: "閃雷悍將",
  aran: "狂狼勇士",
  evan: "龍魔導士",
  mercedes: "精靈遊俠",
  luminous: "夜光",
  phantom: "幻影俠盜",
  noblesse: "貴族",
};

export function classLabel(id) {
  return CLASS_ZH[id] || id || "？";
}

// 部位（equipType/slot）→ 中文
const SLOT_ZH = {
  weapon: "武器",
  bullet: "副武／彈藥",
  helmet: "帽子",
  overall: "套服",
  top: "上衣",
  bottom: "褲裙",
  shoes: "鞋子",
  glove: "手套",
  cape: "披風",
  shoulder: "肩飾",
  belt: "腰帶",
  face: "臉飾",
  eye: "眼飾",
  earring: "耳環",
  ring: "戒指",
  necklace: "項鍊",
  pendant: "墜飾",
  title: "稱號",
  pet: "寵物",
  totem: "圖騰",
  badge: "徽章",
  medal: "勳章",
  shield: "盾牌",
};

// 武器 category → 中文
const WEAPON_CAT_ZH = {
  sword: "單手劍",
  two_sword: "雙手劍",
  axe: "斧",
  two_axe: "雙手斧",
  blunt: "鈍器",
  two_blunt: "雙手鈍器",
  spear: "槍",
  polearm: "矛",
  dagger: "短劍",
  claw: "拳套",
  gun: "火槍",
  knuckle: "指虎",
  bow: "弓",
  crossbow: "弩",
  staff: "長杖",
  wand: "短杖",
  cane: "手杖",
  dual_bowgun: "雙弩槍",
};

// 三大分類（給背包分組）
const CATEGORY_GROUPS = [
  { key: "weapon", label: "🗡️ 武器", match: (t) => t === "weapon" },
  { key: "armor", label: "🛡️ 防具", match: (t) => t === "armor" },
  { key: "accessory", label: "💍 飾品", match: (t) => t === "accessory" || (t !== "weapon" && t !== "armor") },
];

function slotZh(item) {
  const k = item?.equipType || item?.slot || item?.type || "";
  return SLOT_ZH[k] || k || "裝備";
}

function weaponCatZh(item) {
  const c = item?.category;
  return c ? WEAPON_CAT_ZH[c] || c : "";
}

/** jobs 陣列 → 中文；null / 空 = 不限職業 */
function itemJobsZh(item) {
  const jobs = item?.jobs;
  if (!jobs || (Array.isArray(jobs) && !jobs.length)) return "不限職業";
  const arr = Array.isArray(jobs) ? jobs : [jobs];
  return arr.map((j) => classLabel(j)).join("／");
}

/** 開發工具：?dev=1、localStorage artale-dev=1、或本機 */
export function showDevTools() {
  try {
    const q = new URLSearchParams(location.search);
    if (q.get("dev") === "1") return true;
    if (localStorage.getItem("artale-dev") === "1") return true;
    const h = location.hostname || "";
    if (h === "localhost" || h === "127.0.0.1") return true;
  } catch {
    /* ignore */
  }
  return false;
}

export function renderHubShell(els, state) {
  const root = els.artaleHub;
  if (!root) return;

  const {
    tab = "home",
    me = null,
    session = null,
    equip = null,
    starforce = null,
    potential = null,
    starPick = null,
    potPick = null,
    potPanel = "slots",
    starFlash = "",
    potFlash = "",
    safeguard = false,
    apiOk = null,
    oauthOk = null,
    error = "",
    equipFilter = "all",
  } = state;

  const dev = showDevTools();

  if (!me) {
    const canDiscord = apiOk !== false && oauthOk !== false;
    const statusLine =
      apiOk === false
        ? `<p class="hub-error">目前無法連線伺服器，請稍後再試。</p>`
        : apiOk === null
          ? `<p class="muted hub-oauth-hint">連線中…</p>`
          : oauthOk === false
            ? `<p class="muted hub-oauth-hint">Discord 登入暫不可用，請稍後再試${dev ? "（或使用下方開發登入）" : ""}。</p>`
            : "";

    const devBlock = dev
      ? `
        <details class="hub-dev-details">
          <summary>開發工具</summary>
          <p class="muted" style="font-size:0.75rem;margin:0 0 8px">僅本機或 ?dev=1 顯示</p>
          <div class="hub-api-status ${apiOk === true ? "ok" : apiOk === false ? "bad" : ""}">
            API ${apiOk === true ? "OK" : apiOk === false ? "FAIL" : "…"}
            · OAuth ${oauthOk === true ? "OK" : oauthOk === false ? "OFF" : "…"}
          </div>
          <label class="hub-field">
            <span>搜尋冒險家</span>
            <div class="hub-row">
              <input id="hub-search-q" type="text" placeholder="暱稱" />
              <button type="button" class="btn" id="hub-btn-search">搜尋</button>
            </div>
          </label>
          <div id="hub-search-results" class="hub-search-results"></div>
          <label class="hub-field">
            <span>Discord ID</span>
            <div class="hub-row">
              <input id="hub-discord-id" type="text" placeholder="6980…" value="${escapeHtml(getLinkedDiscordId())}" />
              <button type="button" class="btn primary maple-primary" id="hub-btn-load">ID 登入</button>
            </div>
          </label>
        </details>`
      : "";

    root.innerHTML = `
      <div class="hub-login maple-panel maple-ornament">
        <p class="overlay-kicker">ARTALE · 主城</p>
        <h2>歡迎回來，冒險家</h2>
        <p class="muted hub-lead">
          使用 Discord 登入，同步你的角色、裝備與進度。<br/>
          首次登入會自動建立初心者角色。
        </p>
        ${statusLine}
        ${error ? `<p class="hub-error">${escapeHtml(error)}</p>` : ""}

        <button type="button" class="btn primary maple-primary hub-discord-btn" id="hub-btn-discord"
          ${canDiscord ? "" : "disabled"}>
          🎮 使用 Discord 登入
        </button>
        <p class="muted hub-oauth-hint">登入後可換裝、衝星、洗潛能，並挑戰 Boss 突襲。</p>

        ${devBlock}

        <div class="hub-footer-actions">
          <button type="button" class="btn" id="hub-btn-back-title">← 回主選單</button>
        </div>
      </div>
    `;
    return;
  }

  const active = me.characters?.find((c) => c.isActive) || me.characters?.[0];
  const avatar = session?.avatar
    ? `<img class="hub-avatar" src="${escapeHtml(session.avatar)}" alt="" />`
    : `<span class="hub-avatar placeholder">🍁</span>`;

  root.innerHTML = `
    <div class="hub-shell maple-panel maple-ornament">
      <header class="hub-top">
        <div class="hub-top-user">
          ${avatar}
          <div>
            <p class="overlay-kicker">主城</p>
            <h2>${escapeHtml(me.username)}</h2>
            <p class="muted">🍁 楓葉 ${me.mapleLeaves} · 💰 楓幣 ${(me.coins ?? 0).toLocaleString()} · ${me.characters?.length || 0} 名角色</p>
          </div>
        </div>
        <div class="hub-top-actions">
          <button type="button" class="btn" id="hub-btn-logout">登出</button>
          <button type="button" class="btn" id="hub-btn-back-title">主選單</button>
        </div>
      </header>
      <nav class="hub-tabs" role="tablist">
        ${tabBtn("home", "總覽", tab)}
        ${tabBtn("chars", "角色", tab)}
        ${tabBtn("equip", "裝備", tab)}
        ${tabBtn("star", "星力", tab)}
        ${tabBtn("pot", "潛能", tab)}
        ${tabBtn("combat", "突襲／無止境", tab)}
      </nav>
      ${error ? `<p class="hub-error" style="margin:8px 0">${escapeHtml(error)}</p>` : ""}
      <div class="hub-body" id="hub-body">
        ${renderTab(tab, me, active, {
          equip,
          equipFilter,
          starforce,
          potential,
          starPick,
          potPick,
          potPanel,
          starFlash,
          potFlash,
          safeguard,
        })}
      </div>
    </div>
  `;
}

function tabBtn(id, label, cur) {
  return `<button type="button" class="btn hub-tab ${cur === id ? "is-active" : ""}" data-hub-tab="${id}">${label}</button>`;
}

function slotCell(slotKey, item, subIdx = 0, label = "") {
  const filled = !!item;
  const title = filled
    ? `${item.name} Lv.${item.level || "?"}${item.totalAd ? ` · 攻${item.totalAd}` : ""}`
    : label || slotKey;
  return `
    <button type="button"
      class="ms-slot ${filled ? "filled" : "empty"}"
      data-unequip-slot="${escapeHtml(slotKey)}"
      data-sub-idx="${subIdx}"
      title="${escapeHtml(title)}"
      ${filled ? "" : "disabled"}>
      <span class="ms-slot-label">${escapeHtml(label || slotKey)}</span>
      <span class="ms-slot-name">${filled ? escapeHtml(shortName(item.name)) : "—"}</span>
      ${filled && item.totalAd ? `<span class="ms-slot-stat">ATK ${item.totalAd}</span>` : ""}
    </button>`;
}

function shortName(n) {
  const s = String(n || "");
  return s.length > 8 ? s.slice(0, 7) + "…" : s;
}

function renderMapleEquip(equip, me, active, equipFilter) {
  if (!equip) {
    return `<p class="muted center-hint">載入裝備中…</p>`;
  }
  const S = equip.slots || {};
  const one = (k, label) => slotCell(k, S[k]?.item, 0, label);
  const multi = (k, label, i) =>
    slotCell(k, S[k]?.items?.[i], i, `${label}${i + 1}`);

  const filter = equipFilter || "all";
  let inv = equip.inventory || [];
  if (filter === "bag") inv = inv.filter((x) => !x.equipped);
  if (filter === "worn") inv = inv.filter((x) => x.equipped);

  const charLv = equip.charLevel || active?.level || 0;
  const itemCard = (it) => {
    const stats = [];
    if (it.totalAd) stats.push(`攻${it.totalAd}`);
    if (it.totalAp || it.int) stats.push(`魔${it.totalAp || it.int}`);
    if (it.str) stats.push(`力${it.str}`);
    if (it.dex) stats.push(`敏${it.dex}`);
    if (it.int && !it.totalAp) stats.push(`智${it.int}`);
    if (it.luk) stats.push(`幸${it.luk}`);
    if (it.def) stats.push(`防${it.def}`);
    const cat = weaponCatZh(it);
    const req = it.reqLevel ?? it.level ?? 0;
    // 需求等級高於角色 → 標紅提示不能穿
    const cantWear = charLv && req && req > charLv;
    const star = it.starforce ? ` ★${it.starforce}` : "";
    return `
      <button type="button" class="ms-inv-item ${it.equipped ? "is-worn" : ""} ${cantWear ? "is-locked-req" : ""}"
        data-wear-id="${escapeHtml(it.itemId)}"
        ${it.equipped ? "data-worn=1" : ""}
        title="${escapeHtml(it.name)}${cantWear ? ` · 需 Lv.${req} 才能裝備` : ""}">
        <strong>${escapeHtml(it.name)}${star}</strong>
        <small class="ms-inv-meta">
          <span class="ms-inv-slot">${escapeHtml(slotZh(it))}${cat ? `·${escapeHtml(cat)}` : ""}</span>
          <span class="ms-inv-req ${cantWear ? "over" : ""}">需Lv.${req}</span>
          <span class="ms-inv-jobs">${escapeHtml(itemJobsZh(it))}</span>
        </small>
        ${stats.length ? `<small class="ms-inv-stats">${stats.join(" · ")}</small>` : ""}
        ${it.equipped ? `<span class="ms-inv-worn-tag">已裝備</span>` : ""}
      </button>`;
  };

  let invHtml;
  if (!inv.length) {
    invHtml = `<p class="muted">背包沒有可裝備物品</p>`;
  } else {
    // 依三大分類分組顯示
    const used = new Set();
    const sections = [];
    for (const grp of CATEGORY_GROUPS) {
      const items = inv.filter((it) => !used.has(it.itemId) && grp.match(it.type));
      items.forEach((it) => used.add(it.itemId));
      if (!items.length) continue;
      // 同組內依需求等級高→低排序
      items.sort((a, b) => (b.reqLevel ?? b.level ?? 0) - (a.reqLevel ?? a.level ?? 0));
      sections.push(`
        <div class="ms-inv-group">
          <div class="ms-inv-group-head">${grp.label}<span class="ms-inv-group-n">${items.length}</span></div>
          <div class="ms-inv-grid">${items.map(itemCard).join("")}</div>
        </div>`);
    }
    invHtml = sections.join("");
  }

  return `
    <div class="ms-equip-window">
      <div class="ms-equip-titlebar">
        <span>EQUIPMENT</span>
        <strong>${escapeHtml(equip.charName || active?.name || me.username)} · Lv.${equip.charLevel || active?.level || "?"} · ${escapeHtml(classLabel(equip.charClass || active?.class))}</strong>
      </div>
      <div class="ms-equip-body">
        <div class="ms-paper-doll">
          <div class="ms-col">
            ${one("face", "臉飾")}
            ${one("eye", "眼飾")}
            ${one("earring", "耳環")}
            ${one("shoulder", "肩飾")}
            ${one("weapon", "武器")}
            ${one("glove", "手套")}
            ${multi("ring", "戒", 0)}
            ${multi("ring", "戒", 1)}
          </div>
          <div class="ms-col ms-col-center">
            ${one("helmet", "帽子")}
            ${one("overall", "套服")}
            ${one("shoes", "鞋子")}
            ${one("belt", "腰帶")}
            ${multi("necklace", "項", 0)}
            ${multi("necklace", "項", 1)}
            <div class="ms-doll-silhouette" aria-hidden="true">🧍</div>
          </div>
          <div class="ms-col">
            ${one("title", "稱號")}
            ${one("cape", "披風")}
            ${one("bullet", "副武")}
            ${one("pet", "寵物")}
            ${one("totem", "圖騰")}
            ${multi("ring", "戒", 2)}
            ${multi("ring", "戒", 3)}
          </div>
        </div>
        <div class="ms-inventory">
          <div class="ms-inv-head">
            <strong>裝備欄</strong>
            <div class="ms-inv-filters">
              <button type="button" class="btn chip-preset ${filter === "all" ? "is-on" : ""}" data-eq-filter="all">全部</button>
              <button type="button" class="btn chip-preset ${filter === "bag" ? "is-on" : ""}" data-eq-filter="bag">未穿</button>
              <button type="button" class="btn chip-preset ${filter === "worn" ? "is-on" : ""}" data-eq-filter="worn">已穿</button>
            </div>
          </div>
          <p class="muted ms-inv-hint">點背包物品穿上 · 點紙娃娃槽位卸下 · <span class="ms-inv-req over">紅字</span>＝等級不足不能裝備</p>
          <div class="ms-forge-bar">
            <span class="ms-forge-q">想讓裝備更強？</span>
            <button type="button" class="btn chip-preset" data-hub-goto="star">⭐ 衝星力</button>
            <button type="button" class="btn chip-preset" data-hub-goto="pot">🔮 洗潛能</button>
          </div>
          <div class="ms-inv-scroll">${invHtml}</div>
        </div>
      </div>
    </div>`;
}

function pct(x) {
  if (x == null) return "—";
  const p = x * 100;
  return `${p.toFixed(p < 10 && p > 0 ? 1 : 0)}%`;
}

/**
 * 星力條。⚠️ 原本的 `"☆".repeat(Math.min(5, Math.max(0, max - s > 20 ? 0 : 0)))`
 * 三元的兩個分支都是 0，空星永遠不會出現，玩家看不出「還能衝幾星」。
 * 25 顆全畫太長，改成每 5 顆一組、只顯示到目前所在那一組的上限。
 */
function starBar(n, max = 25) {
  const s = Math.max(0, Math.min(max, n | 0));
  const groupTop = Math.min(max, Math.max(5, Math.ceil((s + 1) / 5) * 5));
  return "★".repeat(s) + "☆".repeat(Math.max(0, groupTop - s));
}

function renderStarforce(sf, me, active, starPick, starFlash, safeguard) {
  if (!sf) return `<p class="muted center-hint">載入星力台中…</p>`;

  const slots = sf.slots || [];
  let pick = null;
  if (starPick && slots.length) {
    pick =
      slots.find(
        (s) => s.slotKey === starPick.slot && s.subIdx === starPick.subIdx
      ) || null;
  }
  if (!pick && slots.length) pick = slots[0];

  const listHtml = slots.length
    ? slots
        .map((s) => {
          const on =
            pick && s.slotKey === pick.slotKey && s.subIdx === pick.subIdx;
          return `
          <button type="button" class="sf-slot-row ${on ? "is-on" : ""} ${s.stars >= 15 ? "danger-zone" : ""}"
            data-sf-pick="${escapeHtml(s.slotKey)}" data-sub-idx="${s.subIdx}">
            <span class="sf-slot-emoji">${s.emoji || "⭐"}</span>
            <span class="sf-slot-meta">
              <strong>${escapeHtml(s.label)}</strong>
              <small>${escapeHtml(s.itemName)}</small>
            </span>
            <span class="sf-slot-stars">★${s.stars}</span>
          </button>`;
        })
        .join("")
    : `<p class="muted sf-empty">身上沒有可衝星裝備 — 先到「裝備」穿上武器／防具／飾品。</p>`;

  let detail = `<div class="sf-detail empty"><p class="muted">選擇左側部位開始衝星</p></div>`;
  if (pick) {
    const canProtect = pick.canProtect && (sf.protectCount || 0) > 0;
    const protectOn = canProtect && safeguard;
    const flashClass =
      starFlash?.includes("成功") || starFlash?.includes("保底")
        ? "ok"
        : starFlash?.includes("歸零")
          ? "boom"
          : starFlash?.includes("降")
            ? "down"
            : starFlash
              ? "info"
              : "";

    detail = `
      <div class="sf-detail">
        <div class="sf-detail-head">
          <span class="sf-emoji">${pick.emoji || "⭐"}</span>
          <div>
            <strong>${escapeHtml(pick.label)}</strong>
            <p class="muted">${escapeHtml(pick.itemName)} · Lv.${pick.itemLevel || "?"}</p>
          </div>
        </div>
        <div class="sf-star-display ${pick.stars >= 15 ? "hot" : ""}">
          <span class="sf-big">★${pick.stars}</span>
          <span class="sf-max">/ ${pick.maxStars}</span>
        </div>
        <p class="sf-bar">${escapeHtml(starBar(pick.stars))}</p>
        <div class="sf-bonus-box">
          <div><small>目前加成</small><strong>全屬+${pick.bonus?.allStat || 0} · ${escapeHtml(pick.bonus?.attLabel || "攻擊")}+${pick.bonus?.att || 0}</strong></div>
          ${
            pick.nextBonus
              ? `<div><small>下一星</small><strong>全屬+${pick.nextBonus.allStat} · ${escapeHtml(pick.nextBonus.attLabel)}+${pick.nextBonus.att}</strong></div>`
              : `<div><small>狀態</small><strong>🏆 滿星</strong></div>`
          }
        </div>
        ${
          !pick.maxed && pick.rates
            ? `<div class="sf-rates">
                <span class="ok">成功 ${pct(pick.rates.success)}</span>
                ${pick.rates.maintain > 0 ? `<span>維持 ${pct(pick.rates.maintain)}</span>` : ""}
                ${pick.rates.decrease > 0 ? `<span class="warn">降星 ${pct(pick.rates.decrease)}</span>` : ""}
                ${pick.rates.boom > 0 ? `<span class="boom">💥歸零 ${pct(pick.rates.boom)}</span>` : ""}
              </div>
              <p class="sf-cost">💰 費用 <strong>${(pick.cost || 0).toLocaleString()}</strong> 楓幣
                · 餘額 ${(sf.coins || 0).toLocaleString()}
              </p>
              ${pick.guaranteed ? `<p class="sf-guarantee">🔥 保底觸發！這次必定成功</p>` : pick.miss === 1 ? `<p class="muted sf-miss">再失敗 1 次觸發必成保底</p>` : ""}
              ${
                pick.canProtect
                  ? `<label class="sf-protect ${canProtect ? "" : "disabled"}">
                      <input type="checkbox" id="sf-safeguard" ${protectOn ? "checked" : ""} ${canProtect ? "" : "disabled"} />
                      🛡️ 防歸零保護卷（持有 ×${sf.protectCount || 0}）
                    </label>`
                  : ""
              }
              <button type="button" class="btn primary maple-primary sf-go"
                data-sf-go="${escapeHtml(pick.slotKey)}" data-sub-idx="${pick.subIdx}"
                ${(sf.coins || 0) < (pick.cost || 0) ? "disabled" : ""}>
                ${(sf.coins || 0) < (pick.cost || 0) ? "💸 楓幣不足" : pick.stars >= 15 ? "⭐ 衝星（高風險）" : "⭐ 衝星"}
              </button>`
            : `<p class="sf-maxed muted">已達星數上限</p>`
        }
        ${starFlash ? `<p class="sf-flash ${flashClass}">${escapeHtml(starFlash)}</p>` : ""}
      </div>`;
  }

  return `
    <div class="ms-equip-window sf-window">
      <div class="ms-equip-titlebar">
        <span>STAR FORCE</span>
        <strong>${escapeHtml(sf.charName || active?.name || me.username)} · 💰 ${(sf.coins || 0).toLocaleString()} · 🛡️×${sf.protectCount || 0}</strong>
      </div>
      <div class="sf-body">
        <div class="sf-list">
          <p class="sf-list-hint muted">星力綁部位 · 換裝保留 · 爆裝只歸零</p>
          ${listHtml}
        </div>
        ${detail}
      </div>
    </div>`;
}

function renderPotential(pot, me, active, potPick, potPanel, potFlash) {
  if (!pot) return `<p class="muted center-hint">載入潛能台中…</p>`;

  const inv = pot.inv || {};
  const invStrip = ["cube", "grant", "grant_epic", "grant_legend", "silver_stamp", "gold_stamp", "perfect_stamp"]
    .map((k) => {
      const it = inv[k];
      if (!it) return "";
      return `<span class="pot-inv-chip" title="${escapeHtml(it.desc || "")}">${it.emoji} ${escapeHtml(it.name)} ×${it.count}</span>`;
    })
    .join("");

  if (potPanel === "craft") {
    const c = pot.craft || {};
    return `
      <div class="ms-equip-window pot-window">
        <div class="ms-equip-titlebar">
          <span>POTENTIAL · CRAFT</span>
          <strong>賦予券／方塊合成</strong>
        </div>
        <div class="pot-craft">
          <button type="button" class="btn" data-pot-panel="slots">← 回部位</button>
          <div class="pot-craft-grid">
            <div class="pot-craft-card">
              <h4>🟣 罕見賦予券</h4>
              <p>20 張稀有卷 → 1 張</p>
              <p class="muted">持有稀有 ×${c.grant_epic?.have ?? 0}</p>
              <button type="button" class="btn primary" data-pot-craft="grant_epic" ${(c.grant_epic?.have || 0) < 20 ? "disabled" : ""}>合成 ×1</button>
            </div>
            <div class="pot-craft-card">
              <h4>🟢 傳說賦予券</h4>
              <p>10 張罕見卷 → 1 張</p>
              <p class="muted">持有罕見 ×${c.grant_legend?.have ?? 0}</p>
              <button type="button" class="btn primary" data-pot-craft="grant_legend" ${(c.grant_legend?.have || 0) < 10 ? "disabled" : ""}>合成 ×1</button>
            </div>
            <div class="pot-craft-card">
              <h4>🧩 結合方塊</h4>
              <p>10 神秘方塊 → 1 個</p>
              <p class="muted">持有方塊 ×${c.combine_cube?.have ?? 0}</p>
              <button type="button" class="btn" data-pot-craft="combine_cube" ${(c.combine_cube?.have || 0) < 10 ? "disabled" : ""}>合成 ×1</button>
              <small class="muted">使用請走 Discord</small>
            </div>
            <div class="pot-craft-card">
              <h4>✨ 閃炫方塊</h4>
              <p>30 神秘方塊 → 1 個</p>
              <p class="muted">持有方塊 ×${c.bright_cube?.have ?? 0}</p>
              <button type="button" class="btn" data-pot-craft="bright_cube" ${(c.bright_cube?.have || 0) < 30 ? "disabled" : ""}>合成 ×1</button>
              <small class="muted">使用請走 Discord</small>
            </div>
          </div>
          ${potFlash ? `<p class="sf-flash ok">${escapeHtml(potFlash)}</p>` : ""}
          <div class="pot-inv-strip">${invStrip}</div>
        </div>
      </div>`;
  }

  const slots = pot.slots || [];
  let pick = null;
  if (potPick && slots.length) {
    pick =
      slots.find(
        (s) => s.slotKey === potPick.slot && s.subIdx === potPick.subIdx
      ) || null;
  }
  if (!pick && slots.length) pick = slots[0];

  const grid = slots
    .map((s) => {
      const on =
        pick && s.slotKey === pick.slotKey && s.subIdx === pick.subIdx;
      return `
        <button type="button" class="pot-slot-cell ${on ? "is-on" : ""}"
          style="--tier:${escapeHtml(s.tierColor || "#3498db")}"
          data-pot-pick="${escapeHtml(s.slotKey)}" data-sub-idx="${s.subIdx}">
          <span class="pot-slot-emoji">${s.emoji || "🎲"}</span>
          <strong>${escapeHtml(s.label)}</strong>
          <span class="pot-tier-badge">${escapeHtml(s.tierName)}</span>
          <small>${s.lineCount || 0} 條${s.equippedName ? " · " + escapeHtml(shortName(s.equippedName)) : ""}</small>
        </button>`;
    })
    .join("");

  let detail = `<div class="pot-detail empty"><p class="muted">選擇部位</p></div>`;
  if (pick) {
    const linesHtml = (pick.lines || []).length
      ? pick.lines
          .map(
            (ln) =>
              `<div class="pot-line ${ln.isMain ? "main" : ""}"><span>${ln.isMain ? "主" : "副"}</span><strong>${escapeHtml(ln.label)}</strong></div>`
          )
          .join("")
      : `<p class="muted">尚無詞條</p>`;

    const act = (action, label, emoji, disabled) =>
      `<button type="button" class="btn pot-act" data-pot-act="${action}"
        data-slot="${escapeHtml(pick.slotKey)}" data-sub-idx="${pick.subIdx}"
        ${disabled ? "disabled" : ""}>${emoji} ${label}</button>`;

    detail = `
      <div class="pot-detail" style="--tier:${escapeHtml(pick.tierColor || "#9b59b6")}">
        <div class="pot-detail-head">
          <span>${pick.emoji || "🎲"}</span>
          <div>
            <strong>${escapeHtml(pick.label)}</strong>
            <p class="muted">${escapeHtml(pick.equippedName || "（空槽 · 潛能仍綁部位）")}</p>
          </div>
          <span class="pot-tier-badge big">${escapeHtml(pick.stateLabel || pick.tierName)}</span>
        </div>
        <div class="pot-lines">${linesHtml}</div>
        <div class="pot-actions">
          ${act("grant", "跳稀有", "🎟️", (inv.grant?.count || 0) < 1 || !pick.canGrant?.grant)}
          ${act("grant_epic", "跳罕見", "🟣", (inv.grant_epic?.count || 0) < 1 || !pick.canGrant?.grant_epic)}
          ${act("grant_legend", "跳傳說", "🟢", (inv.grant_legend?.count || 0) < 1 || !pick.canGrant?.grant_legend)}
          ${act("cube", "方塊重洗", "🎲", (inv.cube?.count || 0) < 1)}
        </div>
        <div class="pot-actions">
          ${act("silver_stamp", "銀印章", "🥈", (inv.silver_stamp?.count || 0) < 1 || !pick.canStamp)}
          ${act("gold_stamp", "金印章", "🥇", (inv.gold_stamp?.count || 0) < 1 || !pick.canStamp)}
          ${act("perfect_stamp", "完美印章", "💯", (inv.perfect_stamp?.count || 0) < 1 || !pick.canStamp)}
        </div>
        ${potFlash ? `<p class="sf-flash ok">${escapeHtml(potFlash)}</p>` : ""}
      </div>`;
  }

  return `
    <div class="ms-equip-window pot-window">
      <div class="ms-equip-titlebar">
        <span>POTENTIAL</span>
        <strong>${escapeHtml(pot.charName || active?.name || me.username)} · 稀有以上 ${pot.rareCount || 0}/${pot.totalSlots || 0}</strong>
      </div>
      <div class="pot-toolbar">
        <div class="pot-inv-strip">${invStrip}</div>
        <button type="button" class="btn chip-preset" data-pot-panel="craft">🔨 合成</button>
      </div>
      <div class="pot-body">
        <div class="pot-grid">${grid}</div>
        ${detail}
      </div>
    </div>`;
}

function renderTab(tab, me, active, ui = {}) {
  const {
    equip,
    equipFilter,
    starforce,
    potential,
    starPick,
    potPick,
    potPanel,
    starFlash,
    potFlash,
    safeguard,
  } = ui;

  if (tab === "chars") {
    if (!me.characters?.length) {
      return `<p class="muted center-hint">尚無角色</p>`;
    }
    return `
      <div class="hub-char-grid">
        ${me.characters
          .map(
            (c) => `
          <button type="button" class="hub-char-card ${c.isActive ? "is-active" : ""}" data-select-char="${escapeHtml(c.charId)}">
            <strong>${escapeHtml(c.name)}</strong>
            <span>${escapeHtml(classLabel(c.class))} · Lv.${c.level}</span>
            <small>${c.isActive ? "使用中" : "點擊切換"}</small>
          </button>`
          )
          .join("")}
      </div>`;
  }

  if (tab === "equip") {
    return renderMapleEquip(equip, me, active, equipFilter);
  }

  if (tab === "star") {
    return renderStarforce(starforce, me, active, starPick, starFlash, safeguard);
  }

  if (tab === "pot") {
    return renderPotential(potential, me, active, potPick, potPanel, potFlash);
  }

  if (tab === "combat") {
    const bosses = [
      {
        id: "zakum",
        name: "殘暴炎魔",
        tier: "S+",
        region: "冰原雪域",
        blurb: "三階段戰 · 注意地上 telegraph",
        open: true,
      },
      {
        id: "horntail",
        name: "暗黑龍王",
        tier: "SS",
        region: "神木村",
        blurb: "更高難度 · 建議先磨裝",
        open: true,
      },
    ];
    return `
      <div class="hub-combat-card highlight">
        <h3>Boss 突襲</h3>
        <p>橫向動作戰：左右移動、跳躍、普攻與技能。裝備與星力會影響輸出。</p>
        <div class="hub-raid-boss-grid">
          ${bosses
            .map(
              (b) => `
            <button type="button" class="hub-raid-boss-card" data-start-raid="${b.id}">
              <strong>${escapeHtml(b.name)}</strong>
              <span>${escapeHtml(b.region)} · ${escapeHtml(b.tier)}</span>
              <small>${escapeHtml(b.blurb)}</small>
              <em>出戰 ▶</em>
            </button>`
            )
            .join("")}
        </div>
        <p class="muted" style="margin-top:8px;font-size:0.78rem">←→ 移動 · 空白鍵跳躍 · J 普攻 · K 技能 · Esc 離開</p>
      </div>
      <div class="hub-combat-card">
        <h3>無止境</h3>
        <p class="muted">持續挑戰、競速排行——即將開放</p>
        <button type="button" class="btn" disabled>即將開放</button>
      </div>
      <div class="hub-combat-card subtle">
        <h3>神木防衛戰</h3>
        <p class="muted">塔防小遊戲 · 守護神木</p>
        <button type="button" class="btn" id="hub-btn-open-defense">進入防衛戰</button>
      </div>`;
  }

  return `
    <div class="hub-home">
      <div class="hub-stat-cards">
        <div class="hub-stat"><small>目前角色</small><strong>${escapeHtml(active?.name || "—")}</strong></div>
        <div class="hub-stat"><small>職業</small><strong>${escapeHtml(classLabel(active?.class))}</strong></div>
        <div class="hub-stat"><small>等級</small><strong>Lv.${active?.level ?? "—"}</strong></div>
        <div class="hub-stat"><small>楓幣</small><strong>${(me.coins ?? 0).toLocaleString()}</strong></div>
      </div>
      <p class="hub-roadmap muted">
        在上方分頁管理<strong>角色、裝備、星力、潛能</strong>，或前往<strong>突襲</strong>挑戰 Boss。<br/>
        進度與 Discord Bot 共用同一份冒險資料。
      </p>
    </div>`;
}

function escapeHtml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function bindHubEvents(els, ctx) {
  const { onBackTitle, onOpenDefense, onStartRaid, onState, getState } = ctx;

  els.artaleHub?.querySelector("#hub-btn-back-title")?.addEventListener("click", () => onBackTitle?.());
  els.artaleHub?.querySelector("#hub-btn-open-defense")?.addEventListener("click", () => onOpenDefense?.());

  els.artaleHub?.querySelector("#hub-btn-discord")?.addEventListener("click", () => {
    startDiscordOAuth();
  });

  els.artaleHub?.querySelector("#hub-btn-logout")?.addEventListener("click", async () => {
    try {
      await logoutSession();
    } catch {
      /* ignore */
    }
    setLinkedDiscordId("");
    onState?.({ me: null, session: null, tab: "home", error: "" });
  });

  els.artaleHub?.querySelector("#hub-btn-search")?.addEventListener("click", async () => {
    const q = els.artaleHub.querySelector("#hub-search-q")?.value || "";
    const box = els.artaleHub.querySelector("#hub-search-results");
    try {
      const { results } = await searchPlayers(q);
      if (!box) return;
      if (!results?.length) {
        box.innerHTML = `<p class="muted">沒有符合</p>`;
        return;
      }
      box.innerHTML = results
        .map(
          (r) =>
            `<button type="button" class="hub-search-item" data-id="${escapeHtml(r.discordId)}">
              <strong>${escapeHtml(r.username)}</strong>
              <small>${escapeHtml(r.discordId)}</small>
            </button>`
        )
        .join("");
      box.querySelectorAll("[data-id]").forEach((btn) => {
        btn.addEventListener("click", () => {
          const id = btn.getAttribute("data-id");
          const input = els.artaleHub.querySelector("#hub-discord-id");
          if (input) input.value = id;
        });
      });
    } catch (e) {
      if (box) box.innerHTML = `<p class="hub-error">${escapeHtml(e.message)}</p>`;
    }
  });

  els.artaleHub?.querySelector("#hub-btn-load")?.addEventListener("click", async () => {
    const id = els.artaleHub.querySelector("#hub-discord-id")?.value?.trim();
    if (!id) return;
    try {
      const { me, session } = await devLogin(id);
      setLinkedDiscordId(id);
      onState?.({ me, session, tab: "home", error: "", apiOk: true });
    } catch (e) {
      onState?.({ me: null, session: null, error: e.message, apiOk: true });
    }
  });

  const gotoTab = async (tab) => {
    const next = { ...getState?.(), tab, starFlash: "", potFlash: "", error: "" };
    try {
      if (tab === "equip") next.equip = await fetchEquip();
      if (tab === "star") next.starforce = await fetchStarforce();
      if (tab === "pot") next.potential = await fetchPotential();
    } catch (e) {
      next.error = e.message;
    }
    onState?.(next);
  };
  els.artaleHub?.querySelectorAll("[data-hub-tab]").forEach((btn) => {
    btn.addEventListener("click", () => gotoTab(btn.getAttribute("data-hub-tab")));
  });
  // 裝備頁的「衝星力／洗潛能」捷徑
  els.artaleHub?.querySelectorAll("[data-hub-goto]").forEach((btn) => {
    btn.addEventListener("click", () => gotoTab(btn.getAttribute("data-hub-goto")));
  });

  els.artaleHub?.querySelectorAll("[data-select-char]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const charId = btn.getAttribute("data-select-char");
      const st = getState?.() || {};
      const id = st.me?.discordId || getLinkedDiscordId();
      if (!id || !charId) return;
      try {
        const me = await selectChar(id, charId);
        let equip = null;
        let starforce = null;
        let potential = null;
        try {
          equip = await fetchEquip();
        } catch {
          /* ignore */
        }
        onState?.({
          me,
          equip,
          starforce,
          potential,
          starPick: null,
          potPick: null,
          starFlash: "",
          potFlash: "",
          tab: "chars",
          error: "",
        });
      } catch (e) {
        onState?.({ error: e.message });
      }
    });
  });

  // 穿上
  els.artaleHub?.querySelectorAll("[data-wear-id]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      if (btn.getAttribute("data-worn") === "1") return;
      const itemId = btn.getAttribute("data-wear-id");
      try {
        const equip = await wearItem(itemId);
        onState?.({ ...getState?.(), equip, tab: "equip", error: "" });
      } catch (e) {
        onState?.({ ...getState?.(), error: e.message });
      }
    });
  });

  // 卸下
  els.artaleHub?.querySelectorAll("[data-unequip-slot]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      if (btn.disabled) return;
      const slot = btn.getAttribute("data-unequip-slot");
      const subIdx = Number(btn.getAttribute("data-sub-idx") || 0);
      try {
        const equip = await unequipSlot(slot, subIdx);
        onState?.({ ...getState?.(), equip, tab: "equip", error: "" });
      } catch (e) {
        onState?.({ ...getState?.(), error: e.message });
      }
    });
  });

  els.artaleHub?.querySelectorAll("[data-eq-filter]").forEach((btn) => {
    btn.addEventListener("click", () => {
      onState?.({
        ...getState?.(),
        tab: "equip",
        equipFilter: btn.getAttribute("data-eq-filter"),
      });
    });
  });

  // 星力：選部位
  els.artaleHub?.querySelectorAll("[data-sf-pick]").forEach((btn) => {
    btn.addEventListener("click", () => {
      onState?.({
        ...getState?.(),
        tab: "star",
        starPick: {
          slot: btn.getAttribute("data-sf-pick"),
          subIdx: Number(btn.getAttribute("data-sub-idx") || 0),
        },
        starFlash: "",
      });
    });
  });

  // 星力：保護卷開關
  els.artaleHub?.querySelector("#sf-safeguard")?.addEventListener("change", (e) => {
    onState?.({
      ...getState?.(),
      tab: "star",
      safeguard: !!e.target.checked,
    });
  });

  // 星力：衝星
  els.artaleHub?.querySelectorAll("[data-sf-go]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      if (btn.disabled) return;
      const slot = btn.getAttribute("data-sf-go");
      const subIdx = Number(btn.getAttribute("data-sub-idx") || 0);
      const st = getState?.() || {};
      // ⚠️ await 期間 disable，否則玩家可狂點 → 重複送衝星請求、重複扣楓幣、重複炸裝
      btn.disabled = true;
      const _orig = btn.textContent;
      btn.textContent = "衝星中…";
      try {
        const out = await attemptStarforce(slot, subIdx, !!st.safeguard);
        const r = out.result || {};
        const flash =
          r.outcome === "success"
            ? `✨ ${r.outcomeZh}！${r.from}★ → ${r.to}★（−${(r.cost || 0).toLocaleString()} 楓幣）${r.guaranteed ? " · 保底" : ""}`
            : r.outcome === "boom"
              ? `💥 星數歸零！${r.from}★ → 0★`
              : r.outcome === "decrease"
                ? `⬇️ 降星 ${r.from}★ → ${r.to}★${r.protectUsed ? "（保護卷生效）" : ""}`
                : `➡️ 維持 ${r.from}★`;
        const me = st.me
          ? { ...st.me, coins: out.view?.coins ?? st.me.coins }
          : st.me;
        onState?.({
          ...st,
          me,
          starforce: out.view,
          starPick: { slot, subIdx },
          starFlash: flash,
          tab: "star",
          error: "",
        });
      } catch (e) {
        onState?.({ ...st, tab: "star", error: e.message, starFlash: "" });
      } finally {
        // onState 通常會重繪整個 hub 換掉這顆 btn；若沒重繪（例如出錯）就還原
        btn.disabled = false;
        btn.textContent = _orig;
      }
    });
  });

  // 潛能：選部位
  els.artaleHub?.querySelectorAll("[data-pot-pick]").forEach((btn) => {
    btn.addEventListener("click", () => {
      onState?.({
        ...getState?.(),
        tab: "pot",
        potPick: {
          slot: btn.getAttribute("data-pot-pick"),
          subIdx: Number(btn.getAttribute("data-sub-idx") || 0),
        },
        potFlash: "",
        potPanel: "slots",
      });
    });
  });

  // 潛能：面板切換
  els.artaleHub?.querySelectorAll("[data-pot-panel]").forEach((btn) => {
    btn.addEventListener("click", () => {
      onState?.({
        ...getState?.(),
        tab: "pot",
        potPanel: btn.getAttribute("data-pot-panel") || "slots",
        potFlash: "",
      });
    });
  });

  // 潛能：使用道具
  els.artaleHub?.querySelectorAll("[data-pot-act]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      if (btn.disabled) return;
      const action = btn.getAttribute("data-pot-act");
      const slot = btn.getAttribute("data-slot");
      const subIdx = Number(btn.getAttribute("data-sub-idx") || 0);
      const st = getState?.() || {};
      btn.disabled = true; // await 期間防狂點重複扣道具/楓幣
      const _origP = btn.textContent;
      btn.textContent = "…";
      try {
        const out = await usePotential(slot, subIdx, action);
        onState?.({
          ...st,
          potential: out.view,
          potPick: { slot, subIdx },
          potFlash: out.result?.note || "完成",
          potPanel: "slots",
          tab: "pot",
          error: "",
        });
      } catch (e) {
        onState?.({ ...st, tab: "pot", error: e.message });
      } finally {
        btn.disabled = false;
        btn.textContent = _origP;
      }
    });
  });

  // 潛能：合成
  els.artaleHub?.querySelectorAll("[data-pot-craft]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      if (btn.disabled) return;
      const toKey = btn.getAttribute("data-pot-craft");
      const st = getState?.() || {};
      btn.disabled = true; // await 期間防狂點重複合成
      const _origC = btn.textContent;
      btn.textContent = "合成中…";
      try {
        const out = await craftPotential(toKey, 1);
        onState?.({
          ...st,
          potential: out.view,
          potFlash: out.result?.note || "合成完成",
          potPanel: "craft",
          tab: "pot",
          error: "",
        });
      } catch (e) {
        onState?.({ ...st, tab: "pot", potPanel: "craft", error: e.message });
      } finally {
        btn.disabled = false;
        btn.textContent = _origC;
      }
    });
  });

  // 動作突襲
  els.artaleHub?.querySelectorAll("[data-start-raid]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const bossId = btn.getAttribute("data-start-raid");
      try {
        await onStartRaid?.(bossId);
      } catch (e) {
        onState?.({ ...getState?.(), tab: "combat", error: e.message });
      }
    });
  });
}
