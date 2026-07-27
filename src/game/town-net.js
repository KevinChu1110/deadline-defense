/**
 * 聊天城鎮的即時多人連線(Colyseus)。連到 artale-games-server 的 TownRoom。
 * ngrok 攔截頁只擋 GET 導航,matchmake(POST)+WS 不受影響,故可從 netlify 直連。
 * ⚠️ 後端 ngrok 網址若變,改 WS_ENDPOINT(與 edge function BACKEND 同步)。
 */
import { Client } from "colyseus.js";

const WS_ENDPOINT = "wss://primary-marmoset-publicly.ngrok-free.app";

/** 連線並加入城鎮房。回傳 net 物件:players(他人)/sendMove/sendChat/selfChat/leave */
export function connectTown({ name, sheet, x, y, face } = {}) {
  const net = { room: null, connected: false, players: [], selfChat: null, self: null };
  try {
    const client = new Client(WS_ENDPOINT);
    client.joinOrCreate("town", { name, sheet, x, y, face })
      .then((room) => {
        net.room = room;
        net.connected = true;
        net.self = room.sessionId;
        room.onMessage("town", (snap) => {
          // 排除自己（避免畫出第二個自己）
          const selfId = room.sessionId || net.self;
          net.players = (snap.players || []).filter((p) => {
            if (!p) return false;
            if (selfId && (p.id === selfId || p.sessionId === selfId)) return false;
            return true;
          });
        });
        room.onLeave(() => { net.connected = false; net.players = []; });
        room.onError?.((code, msg) => console.warn("[town-net] room error", code, msg));
      })
      .catch((e) => console.warn("[town-net] join failed", e?.message || e));
  } catch (e) { console.warn("[town-net] connect error", e?.message || e); }

  net.sendMove = (m) => { if (net.room) { try { net.room.send("move", m); } catch { /* ignore */ } } };
  net.sendChat = (text) => {
    const t = String(text || "").trim().slice(0, 80);
    if (!t) return;
    net.selfChat = { text: t, at: performance.now() };
    if (net.room) { try { net.room.send("chat", { text: t }); } catch { /* ignore */ } }
  };
  net.leave = () => { if (net.room) { try { net.room.leave(); } catch { /* ignore */ } } net.room = null; net.connected = false; net.players = []; };
  return net;
}
