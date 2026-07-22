/**
 * Artale 主城 Hub — 帳號養成入口（接 Bot player-data）
 * 動作戰鬥 M3 另開；此處先做角色／裝備／星力／潛能殼。
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
    headers: { "Content-Type": "application/json", ...(opts.headers || {}) },
    ...opts,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

export async function searchPlayers(q) {
  return api(`/api/dev/search?q=${encodeURIComponent(q || "")}`);
}

export async function loadMe(discordId) {
  return api(`/api/me?discordId=${encodeURIComponent(discordId)}`);
}

export async function selectChar(discordId, charId) {
  return api("/api/me/select-char", {
    method: "POST",
    body: JSON.stringify({ discordId, charId }),
  });
}

export async function loadCharDetail(discordId, charId) {
  return api(
    `/api/me/characters/${encodeURIComponent(charId)}?discordId=${encodeURIComponent(discordId)}`
  );
}

export async function healthCheck() {
  return api("/api/health");
}

/** 職業中文粗標（與 Bot class id 對齊） */
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

  const { tab = "home", me = null, apiOk = null, error = "" } = state;

  if (!me) {
    root.innerHTML = `
      <div class="hub-login maple-panel maple-ornament">
        <p class="overlay-kicker">ARTALE WEB · M0</p>
        <h2>進入主城</h2>
        <p class="muted hub-lead">
          連接 Discord Bot 玩家資料（本機 API）。<br/>
          正式環境將改為 <strong>Discord 登入</strong>；目前開發模式用 ID 載入。
        </p>
        <div class="hub-api-status ${apiOk === true ? "ok" : apiOk === false ? "bad" : ""}">
          API：${apiOk === true ? "已連線" : apiOk === false ? "未啟動 — 請開 server" : "檢查中…"}
        </div>
        ${error ? `<p class="hub-error">${escapeHtml(error)}</p>` : ""}
        <label class="hub-field">
          <span>搜尋冒險家</span>
          <div class="hub-row">
            <input id="hub-search-q" type="text" placeholder="暱稱或 Discord ID" />
            <button type="button" class="btn primary maple-primary" id="hub-btn-search">搜尋</button>
          </div>
        </label>
        <div id="hub-search-results" class="hub-search-results"></div>
        <label class="hub-field">
          <span>或直接貼 Discord ID</span>
          <div class="hub-row">
            <input id="hub-discord-id" type="text" placeholder="6980…" value="${escapeHtml(getLinkedDiscordId())}" />
            <button type="button" class="btn primary maple-primary" id="hub-btn-load">載入帳號</button>
          </div>
        </label>
        <div class="hub-footer-actions">
          <button type="button" class="btn" id="hub-btn-back-title">← 回主選單</button>
        </div>
        <p class="muted hub-note">
          定案：動作戰鬥 · 完整衝裝 · Discord 突襲關閉改網頁打。<br/>
          詳見 docs/ARTALE_WEB_PLAN.md
        </p>
      </div>
    `;
    return;
  }

  const active = me.characters?.find((c) => c.isActive) || me.characters?.[0];

  root.innerHTML = `
    <div class="hub-shell maple-panel maple-ornament">
      <header class="hub-top">
        <div>
          <p class="overlay-kicker">ARTALE 主城</p>
          <h2>${escapeHtml(me.username)}</h2>
          <p class="muted">🍁 ${me.mapleLeaves} · 角色 ${me.characters?.length || 0} · 背包 ${me.inventoryCount || 0}</p>
        </div>
        <div class="hub-top-actions">
          <button type="button" class="btn" id="hub-btn-logout">切換帳號</button>
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
      <div class="hub-body" id="hub-body">
        ${renderTab(tab, me, active)}
      </div>
    </div>
  `;
}

function tabBtn(id, label, cur) {
  return `<button type="button" class="btn hub-tab ${cur === id ? "is-active" : ""}" data-hub-tab="${id}">${label}</button>`;
}

function renderTab(tab, me, active) {
  if (tab === "chars") {
    if (!me.characters?.length) {
      return `<p class="muted center-hint">此帳號尚無 characters 資料</p>`;
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
    const eq = me.equipped || {};
    const slots = [
      "weapon",
      "overall",
      "helmet",
      "glove",
      "shoes",
      "cape",
      "belt",
      "earring",
      "shoulder",
      "eye",
      "face",
      "title",
    ];
    const rows = slots
      .map((s) => {
        const v = eq[s];
        const name = Array.isArray(v)
          ? v.map((x) => x?.name || "空").join("、") || "空"
          : v?.name || "（空）";
        return `<div class="hub-eq-row"><span class="hub-eq-slot">${s}</span><span>${escapeHtml(name)}</span></div>`;
      })
      .join("");
    const inv = (me.inventoryPreview || [])
      .slice(0, 24)
      .map((it) => `<li>${escapeHtml(it.name)} <small>Lv.${it.level || "?"} · ${escapeHtml(it.type || "")}</small></li>`)
      .join("");
    return `
      <p class="muted">當前角色：<strong>${escapeHtml(active?.name || "—")}</strong> · 換裝 API 下階段接上</p>
      <div class="hub-eq-list">${rows}</div>
      <h3 class="hub-subh">背包預覽</h3>
      <ul class="hub-inv">${inv || "<li class='muted'>無</li>"}</ul>`;
  }

  if (tab === "star") {
    const keys = Object.keys(me.starSlots || {});
    if (!keys.length) {
      return `<p class="muted">此角色尚無 starSlots 資料（Bot 衝星後會出現）。星力操作 UI 下階段接 star-force.js 公式。</p>`;
    }
    return `
      <div class="hub-kv">
        ${keys
          .map((k) => {
            const s = me.starSlots[k] || {};
            return `<div class="hub-eq-row"><span>${escapeHtml(k)}</span><strong>★ ${s.stars || 0}</strong></div>`;
          })
          .join("")}
      </div>
      <p class="muted hub-note">規則：綁部位槽、爆星歸零不毀裝（與 Bot 定案一致）</p>`;
  }

  if (tab === "pot") {
    const keys = Object.keys(me.potentialSlots || {});
    if (!keys.length) {
      return `<p class="muted">此角色尚無 potentialSlots。潛能台 UI 下階段接 potential.js。</p>`;
    }
    return `
      <div class="hub-kv">
        ${keys
          .slice(0, 40)
          .map((k) => {
            const s = me.potentialSlots[k];
            return `<div class="hub-eq-row"><span>${escapeHtml(k)}</span><code>${escapeHtml(JSON.stringify(s).slice(0, 80))}</code></div>`;
          })
          .join("")}
      </div>`;
  }

  if (tab === "combat") {
    return `
      <div class="hub-combat-card">
        <h3>Boss 突襲 · 動作戰鬥</h3>
        <p>定案：完整動作向（移動／技能／階段招式），<strong>不是</strong> Discord 文字模擬。</p>
        <p class="muted">M3 開發中 — 會沿用 Bot Boss 表與 calcStats，畫面即時結算。</p>
        <button type="button" class="btn primary maple-primary" id="hub-btn-raid-soon" disabled>即將開放</button>
      </div>
      <div class="hub-combat-card">
        <h3>無止境</h3>
        <p class="muted">無限波壓力測試，排行寫入帳號。M4。</p>
        <button type="button" class="btn" disabled>即將開放</button>
      </div>
      <div class="hub-combat-card subtle">
        <h3>神木防衛戰（小品）</h3>
        <p class="muted">塔防／推線小遊戲，與突襲主線分離。</p>
        <button type="button" class="btn" id="hub-btn-open-defense">進入防衛戰</button>
      </div>`;
  }

  // home
  return `
    <div class="hub-home">
      <div class="hub-stat-cards">
        <div class="hub-stat"><small>目前角色</small><strong>${escapeHtml(active?.name || "—")}</strong></div>
        <div class="hub-stat"><small>職業</small><strong>${escapeHtml(classLabel(active?.class))}</strong></div>
        <div class="hub-stat"><small>等級</small><strong>Lv.${active?.level ?? "—"}</strong></div>
        <div class="hub-stat"><small>楓葉</small><strong>${me.mapleLeaves}</strong></div>
      </div>
      <p class="hub-roadmap muted">
        <strong>路線圖</strong><br/>
        ✅ M0 讀取 Bot 帳號／角色／裝備預覽<br/>
        ▢ M1 Discord OAuth<br/>
        ▢ M2 換裝·星力·潛能可操作<br/>
        ▢ M3 動作突襲　▢ M4 無止境　▢ M5 關閉 Discord 突襲
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

/**
 * 綁定 Hub 事件（每次 render 後呼叫）
 */
export function bindHubEvents(els, ctx) {
  const {
    onBackTitle,
    onOpenDefense,
    onState,
    getState,
  } = ctx;

  els.artaleHub?.querySelector("#hub-btn-back-title")?.addEventListener("click", () => onBackTitle?.());
  els.artaleHub?.querySelector("#hub-btn-open-defense")?.addEventListener("click", () => onOpenDefense?.());
  els.artaleHub?.querySelector("#hub-btn-logout")?.addEventListener("click", () => {
    setLinkedDiscordId("");
    onState?.({ me: null, tab: "home", error: "" });
  });

  els.artaleHub?.querySelector("#hub-btn-search")?.addEventListener("click", async () => {
    const q = els.artaleHub.querySelector("#hub-search-q")?.value || "";
    const box = els.artaleHub.querySelector("#hub-search-results");
    try {
      const { results } = await searchPlayers(q);
      if (!box) return;
      if (!results?.length) {
        box.innerHTML = `<p class="muted">沒有符合的冒險家</p>`;
        return;
      }
      box.innerHTML = results
        .map(
          (r) =>
            `<button type="button" class="hub-search-item" data-id="${escapeHtml(r.discordId)}">
              <strong>${escapeHtml(r.username)}</strong>
              <small>${escapeHtml(r.discordId)} · ${r.charCount} 角色</small>
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
      const me = await loadMe(id);
      setLinkedDiscordId(id);
      onState?.({ me, tab: "home", error: "", apiOk: true });
    } catch (e) {
      onState?.({ me: null, error: e.message, apiOk: true });
    }
  });

  els.artaleHub?.querySelectorAll("[data-hub-tab]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const tab = btn.getAttribute("data-hub-tab");
      onState?.({ ...getState?.(), tab });
    });
  });

  els.artaleHub?.querySelectorAll("[data-select-char]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const charId = btn.getAttribute("data-select-char");
      const id = getLinkedDiscordId();
      if (!id || !charId) return;
      try {
        const me = await selectChar(id, charId);
        onState?.({ me, tab: "chars", error: "" });
      } catch (e) {
        onState?.({ error: e.message });
      }
    });
  });
}
