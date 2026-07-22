/**
 * Artale 主城 Hub — Discord OAuth 登入 + 角色／裝備／星力／潛能
 */

const SESSION_KEY = "artale-web-discord-id";

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
  const res = await fetch(path, {
    credentials: "include",
    headers: { "Content-Type": "application/json", ...(opts.headers || {}) },
    ...opts,
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
  // 走同源 /api → vite proxy → API（Set-Cookie 在 callback 由 API 直接 302 到前端）
  window.location.href = "/api/auth/discord";
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

export function renderHubShell(els, state) {
  const root = els.artaleHub;
  if (!root) return;

  const {
    tab = "home",
    me = null,
    session = null,
    equip = null,
    apiOk = null,
    oauthOk = null,
    error = "",
    equipFilter = "all",
  } = state;

  if (!me) {
    root.innerHTML = `
      <div class="hub-login maple-panel maple-ornament">
        <p class="overlay-kicker">ARTALE WEB · M1</p>
        <h2>Discord 登入主城</h2>
        <p class="muted hub-lead">
          用 Discord 帳號載入 Bot 角色資料。<br/>
          首次登入會自動建立初心者角色（若 Bot 尚無此 ID）。
        </p>
        <div class="hub-api-status ${apiOk === true ? "ok" : apiOk === false ? "bad" : ""}">
          API：${apiOk === true ? "已連線" : apiOk === false ? "未啟動 — npm run dev:api" : "檢查中…"}
          ${oauthOk === true ? " · OAuth 已設定" : oauthOk === false ? " · OAuth 未設定（可用下方開發登入）" : ""}
        </div>
        ${error ? `<p class="hub-error">${escapeHtml(error)}</p>` : ""}

        <button type="button" class="btn primary maple-primary hub-discord-btn" id="hub-btn-discord" ${apiOk === false ? "disabled" : ""}>
          🎮 使用 Discord 登入
        </button>
        <p class="muted hub-oauth-hint">
          需在 <code>server/.env</code>（從 env.example 複製）設定 Client ID／Secret<br/>
          並於 Discord Developer Portal 加入 Redirect：<br/>
          <code>http://127.0.0.1:5173/api/auth/discord/callback</code>
        </p>

        <details class="hub-dev-details">
          <summary>開發用：ID 登入（本機）</summary>
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
              <button type="button" class="btn primary maple-primary" id="hub-btn-load">開發登入</button>
            </div>
          </label>
        </details>

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
            <p class="overlay-kicker">ARTALE 主城</p>
            <h2>${escapeHtml(me.username)}</h2>
            <p class="muted">🍁 ${me.mapleLeaves} · 角色 ${me.characters?.length || 0} · ID ${escapeHtml(me.discordId)}</p>
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
        ${renderTab(tab, me, active, equip, equipFilter)}
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

  const invHtml = inv.length
    ? inv
        .map((it) => {
          const stats = [];
          if (it.totalAd) stats.push(`攻${it.totalAd}`);
          if (it.str) stats.push(`力${it.str}`);
          if (it.dex) stats.push(`敏${it.dex}`);
          if (it.int) stats.push(`智${it.int}`);
          if (it.luk) stats.push(`幸${it.luk}`);
          return `
          <button type="button" class="ms-inv-item ${it.equipped ? "is-worn" : ""}"
            data-wear-id="${escapeHtml(it.itemId)}"
            ${it.equipped ? "data-worn=1" : ""}
            title="${escapeHtml(it.name)}">
            <strong>${escapeHtml(it.name)}</strong>
            <small>Lv.${it.level || "?"} · ${escapeHtml(it.slot || it.type || "")}
            ${stats.length ? " · " + stats.join(" ") : ""}
            ${it.equipped ? " · 已裝備" : ""}</small>
          </button>`;
        })
        .join("")
    : `<p class="muted">背包沒有可裝備物品</p>`;

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
          <p class="muted ms-inv-hint">點背包物品穿上 · 點紙娃娃槽位卸下</p>
          <div class="ms-inv-grid">${invHtml}</div>
        </div>
      </div>
    </div>`;
}

function renderTab(tab, me, active, equip, equipFilter) {
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
    const keys = Object.keys(me.starSlots || {});
    if (!keys.length) {
      return `<p class="muted">尚無 starSlots（Bot 衝星後會有）。操作台 M2。</p>`;
    }
    return `<div class="hub-kv">${keys
      .map((k) => {
        const s = me.starSlots[k] || {};
        return `<div class="hub-eq-row"><span>${escapeHtml(k)}</span><strong>★ ${s.stars || 0}</strong></div>`;
      })
      .join("")}</div>`;
  }

  if (tab === "pot") {
    const keys = Object.keys(me.potentialSlots || {});
    if (!keys.length) return `<p class="muted">尚無 potentialSlots。潛能台 M2。</p>`;
    return `<div class="hub-kv">${keys
      .slice(0, 40)
      .map((k) => {
        const s = me.potentialSlots[k];
        return `<div class="hub-eq-row"><span>${escapeHtml(k)}</span><code>${escapeHtml(JSON.stringify(s).slice(0, 80))}</code></div>`;
      })
      .join("")}</div>`;
  }

  if (tab === "combat") {
    return `
      <div class="hub-combat-card">
        <h3>Boss 突襲 · 動作戰鬥</h3>
        <p>定案：完整動作向。M3 開發中。</p>
        <button type="button" class="btn primary maple-primary" disabled>即將開放</button>
      </div>
      <div class="hub-combat-card">
        <h3>無止境</h3>
        <p class="muted">M4</p>
        <button type="button" class="btn" disabled>即將開放</button>
      </div>
      <div class="hub-combat-card subtle">
        <h3>神木防衛戰</h3>
        <button type="button" class="btn" id="hub-btn-open-defense">進入防衛戰</button>
      </div>`;
  }

  return `
    <div class="hub-home">
      <div class="hub-stat-cards">
        <div class="hub-stat"><small>目前角色</small><strong>${escapeHtml(active?.name || "—")}</strong></div>
        <div class="hub-stat"><small>職業</small><strong>${escapeHtml(classLabel(active?.class))}</strong></div>
        <div class="hub-stat"><small>等級</small><strong>Lv.${active?.level ?? "—"}</strong></div>
        <div class="hub-stat"><small>楓葉</small><strong>${me.mapleLeaves}</strong></div>
      </div>
      <p class="hub-roadmap muted">
        ✅ M0 讀取 Bot 資料<br/>
        ✅ M1 Discord OAuth 登入<br/>
        ✅ M2 換裝（楓之谷風）· 星力/潛能預覽<br/>
        ▢ M3 動作突襲　▢ M4 無止境
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
  const { onBackTitle, onOpenDefense, onState, getState } = ctx;

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

  els.artaleHub?.querySelectorAll("[data-hub-tab]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const tab = btn.getAttribute("data-hub-tab");
      const next = { ...getState?.(), tab };
      if (tab === "equip") {
        try {
          next.equip = await fetchEquip();
          next.error = "";
        } catch (e) {
          next.error = e.message;
        }
      }
      onState?.(next);
    });
  });

  els.artaleHub?.querySelectorAll("[data-select-char]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const charId = btn.getAttribute("data-select-char");
      const st = getState?.() || {};
      const id = st.me?.discordId || getLinkedDiscordId();
      if (!id || !charId) return;
      try {
        const me = await selectChar(id, charId);
        let equip = st.equip;
        try {
          equip = await fetchEquip();
        } catch {
          /* ignore */
        }
        onState?.({ me, equip, tab: "chars", error: "" });
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
}
