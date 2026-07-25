/**
 * 資料驅動任務 + 對話引擎（純邏輯，無 DOM/網路）。
 *
 * 設計原則（見 docs/MAPLE_ISLAND_PLAN.md）：
 *  - 伺服器唯一裁判：此引擎只「讀」玩家世界進度(worldState=char.web) + 決定 UI 該顯示什麼；
 *    任何會發獎/改資料的動作都透過 emit() 交給上層(→server web-ops)，不在這裡算獎勵。
 *  - 任務擊殺計數由 server 從 hunt.report 累加（worldState.quests[qid].kills），此處只比對達標與否。
 *
 * worldState 形狀：{ level, flags:{}, quests:{ qid:{ st:"active"|"done", kills:{}, items:{} } } }
 */
export function createQuestSystem({ quests = {}, dialogs = {}, getState, emit }) {
  const S = () => {
    const s = (getState && getState()) || {};
    return { level: s.level || 1, flags: s.flags || {}, quests: s.quests || {} };
  };

  // ── 任務狀態機：locked / available / active / ready(達標未回報) / done ──
  function objectivesMet(qid) {
    const def = quests[qid]; const prog = S().quests[qid];
    if (!def || !prog) return false;
    return (def.objectives || []).every((o) => {
      if (o.type === "kill") return (prog.kills?.[o.mobId] || 0) >= o.count;
      if (o.type === "item") return (prog.items?.[o.itemId] || 0) >= o.count;
      if (o.type === "level") return S().level >= o.count;
      return true;
    });
  }
  function prereqMet(def) {
    const req = (def && def.req) || {};
    if (req.level && S().level < req.level) return false;
    if (req.quest && questStatus(req.quest) !== "done") return false;
    if (req.flag && !S().flags[req.flag]) return false;
    return true;
  }
  function questStatus(qid) {
    const def = quests[qid];
    if (!def) return "unknown";
    const st = S().quests[qid]?.st;
    if (st === "done") return "done";
    if (st === "active") return objectivesMet(qid) ? "ready" : "active";
    return prereqMet(def) ? "available" : "locked";
  }

  // ── 條件 DSL：quest.qid==ready | flag.x==true | level>=8 ──
  function evalCond(expr) {
    if (!expr) return true;
    let m;
    if ((m = expr.match(/^quest\.(\w+)\s*==\s*(\w+)$/))) return questStatus(m[1]) === m[2];
    if ((m = expr.match(/^quest\.(\w+)\s*!=\s*(\w+)$/))) return questStatus(m[1]) !== m[2];
    if ((m = expr.match(/^flag\.(\w+)\s*==\s*(true|false)$/))) return Boolean(S().flags[m[1]]) === (m[2] === "true");
    if ((m = expr.match(/^level\s*(>=|>|==)\s*(\d+)$/))) {
      const lv = S().level, n = Number(m[2]);
      return m[1] === ">=" ? lv >= n : m[1] === ">" ? lv > n : lv === n;
    }
    return true; // 未知條件視為通過（避免整段卡死）
  }

  // ── 對話：取節點 + 依條件過濾選項 ──
  function dialogNode(npcId, nodeKey = "start") {
    const d = dialogs[npcId];
    if (!d) return null;
    const node = d[nodeKey];
    if (!node) return null;
    const opts = (node.opts || []).filter((o) => evalCond(o.if));
    return { text: typeof node.text === "function" ? node.text(S()) : node.text, opts };
  }

  /**
   * 執行選項動作。回傳 UI 該做什麼：
   *   { close:true } | { node:"key" } | { toast:"…" } | { openJob:true }
   * 會發獎/改資料的動作走 emit(kind,args)（→server 權威），並把回傳的最新 worldState 交給上層套用。
   */
  async function runAction(act) {
    if (!act || act === "close") return { close: true };
    const [verb, arg] = act.split(":");
    if (verb === "goto") return { node: arg };
    if (verb === "openJob") return { openJob: true };
    // 支援 "quest.accept:qid" / "quest.complete:qid"
    if (act.startsWith("quest.accept:") || act.startsWith("quest.complete:")) {
      const event = act.startsWith("quest.accept:") ? "accept" : "complete";
      const qid = act.split(":")[1];
      const def = quests[qid];
      if (!def) return { toast: "任務不存在" };
      if (event === "complete" && questStatus(qid) !== "ready") return { toast: "任務目標還沒完成" };
      if (event === "accept" && questStatus(qid) !== "available") return { toast: "現在無法接這個任務" };
      const res = emit ? await emit("quest.event", { qid, event }) : { ok: true };
      if (res && res.ok) {
        const label = event === "accept" ? "接受任務" : "任務完成";
        const r = res.rewards || {};
        const bits = [];
        if (r.exp) bits.push(`+${r.exp} 經驗`);
        if (r.meso) bits.push(`+${r.meso} 楓幣`);
        return { toast: `${label}：${def.name}${bits.length ? "（" + bits.join("・") + "）" : ""}`, state: res.state };
      }
      return { toast: (res && res.error) || "操作失敗" };
    }
    return { close: true };
  }

  // 給 NPC 名牌 / 頭上驚嘆號用：這個 NPC 現在有可接/可回報的任務嗎
  function npcQuestMark(npcId) {
    const d = dialogs[npcId];
    if (!d) return null;
    for (const node of Object.values(d)) {
      for (const o of node.opts || []) {
        if (!evalCond(o.if)) continue;
        if (o.act?.startsWith("quest.accept:")) return "!";       // 可接（黃）
        if (o.act?.startsWith("quest.complete:")) return "?";     // 可回報（完成）
      }
    }
    return null;
  }

  return { questStatus, objectivesMet, prereqMet, evalCond, dialogNode, runAction, npcQuestMark };
}
