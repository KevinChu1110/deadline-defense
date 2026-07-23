/**
 * 五大 Boss 的真實 MapleStory 動畫（來源 maplestory.io framebooks）+ 各王真實招式組。
 * 動畫檔由 scripts/download-bosses.mjs 抓到 public/mobs/b{mob}_{anim}.png。
 * render 時用 sampleGifFrame 依 Boss 狀態播對應動畫。
 *
 * anims 只保留招式組實際用到的（stand/2攻/1技/hit/die），控制檔案大小。
 */
export const BOSS_ANIMS = {
  boss_zakum: { mob: 8800000, ver: 62, anims: ["stand", "attack1", "attack2", "skill1", "hit1", "die1"] },
  boss_dark_dragon: { mob: 8810002, ver: 62, anims: ["stand", "attack1", "attack2", "skill1", "hit1", "die1"] },
  boss_papulatus: { mob: 8500001, ver: 62, anims: ["stand", "attack1", "attack2", "skill1", "hit1", "die1"] },
  boss_hainurs: { mob: 8510000, ver: 62, anims: ["stand", "attack1", "attack2", "skill1", "hit1", "die1"] },
  boss_pink_bean: { mob: 8820001, ver: 83, anims: ["stand", "attack1", "attack2", "skill1", "hit1", "die1"] },
};
BOSS_ANIMS.boss_horntail = BOSS_ANIMS.boss_hainurs; // 舊 id 相容

/** 某 Boss 某動畫的 sprite 檔名（public/mobs/ 下） */
export function bossAnimFile(bossId, anim) {
  const b = BOSS_ANIMS[bossId];
  if (!b) return null;
  return `b${b.mob}_${anim}.png`;
}

/**
 * 各王真實招式組（Phase C）。每招：
 *   kind — 機制解析器（見 action-raid resolveCast）
 *   anim — 施放時播的真實動畫
 *   tel  — 預警秒數  · dur — 全長  · phase — 解鎖階段(1/2/3)
 * 每王有 1~2 個「簽名機制」讓打起來不同（council 定案，用真實招式改編）。
 */
export const BOSS_KITS = {
  // 殘暴炎魔：八臂連砸(簽名) + 火柱 + 魔方彈幕 + 暗黑詛咒
  boss_zakum: [
    { kind: "multismash", anim: "attack1", tel: 0.8, dur: 1.5, phase: 1 }, // 簽名：3臂連砸
    { kind: "pillar", anim: "skill1", tel: 0.85, dur: 1.2, phase: 1 },
    { kind: "smash", anim: "attack2", tel: 0.7, dur: 1.1, phase: 1 },
    { kind: "barrage", anim: "skill1", tel: 0.5, dur: 1.6, phase: 2 },
    { kind: "darkcurse", anim: "attack1", tel: 1.0, dur: 1.6, phase: 3 }, // 簽名：詛咒霧(降攻)
  ],
  // 暗黑龍王：三頭 → 龍息橫掃(簽名,需跳+閃) + 雙頭對角彈幕 + 尾掃
  boss_dark_dragon: [
    { kind: "beam", anim: "attack1", tel: 0.9, dur: 1.4, phase: 1 }, // 簽名：全寬龍息
    { kind: "smash", anim: "attack2", tel: 0.75, dur: 1.1, phase: 1 },
    { kind: "swipe", anim: "skill1", tel: 0.7, dur: 1.2, phase: 1 },
    { kind: "diagbarrage", anim: "attack1", tel: 0.55, dur: 1.6, phase: 2 }, // 簽名：對角兩波
    { kind: "rage", anim: "skill1", tel: 1.0, dur: 1.8, phase: 3 },
  ],
  // 拉圖斯：時鐘 → 假落點(簽名,3柱1真) + 落石 + 時空緩速
  boss_papulatus: [
    { kind: "fakepillar", anim: "attack1", tel: 0.9, dur: 1.5, phase: 1 }, // 簽名：3柱只1真
    { kind: "smash", anim: "attack2", tel: 0.7, dur: 1.1, phase: 1 },
    { kind: "barrage", anim: "skill1", tel: 0.5, dur: 1.5, phase: 2 },
    { kind: "swipe", anim: "attack1", tel: 0.7, dur: 1.2, phase: 2 },
    { kind: "rage", anim: "skill1", tel: 1.0, dur: 1.8, phase: 3 },
  ],
  // 海怒斯：深海 → 潮汐推拉(簽名) + 千斤墜 + 召喚彈幕
  boss_hainurs: [
    { kind: "tide", anim: "skill1", tel: 0.8, dur: 1.6, phase: 1 }, // 簽名：吸引+彈幕
    { kind: "smash", anim: "attack1", tel: 0.8, dur: 1.3, phase: 1 }, // 千斤墜
    { kind: "pillar", anim: "attack2", tel: 0.85, dur: 1.2, phase: 1 },
    { kind: "barrage", anim: "skill1", tel: 0.5, dur: 1.6, phase: 2 },
    { kind: "rage", anim: "attack1", tel: 1.0, dur: 1.8, phase: 3 },
  ],
  // 皮卡啾：最難 → 安全座椅(簽名,站上免傷) + 落石 + 花瓣彈幕 + 狂暴
  boss_pink_bean: [
    { kind: "smash", anim: "attack1", tel: 0.7, dur: 1.1, phase: 1 },
    { kind: "pillar", anim: "attack2", tel: 0.8, dur: 1.2, phase: 1 },
    { kind: "barrage", anim: "skill1", tel: 0.5, dur: 1.6, phase: 2 },
    { kind: "safeseat", anim: "skill1", tel: 1.1, dur: 2.0, phase: 2 }, // 簽名：全屏,站座椅免傷
    { kind: "rage", anim: "attack1", tel: 0.9, dur: 1.7, phase: 3 },
  ],
};
BOSS_KITS.boss_horntail = BOSS_KITS.boss_hainurs;

export function getBossKit(bossKey) {
  return BOSS_KITS[bossKey] || BOSS_KITS.boss_zakum;
}

// 突襲入口/伺服器可能傳短 id(zakum/horntail)或 botKey 或中文名 → 正規化成 boss_* key
const BOSS_ALIAS = {
  zakum: "boss_zakum",
  horntail: "boss_dark_dragon",
  darkdragon: "boss_dark_dragon",
  dark_dragon: "boss_dark_dragon",
  papulatus: "boss_papulatus",
  hainurs: "boss_hainurs",
  pianus: "boss_hainurs",
  pinkbean: "boss_pink_bean",
  pink_bean: "boss_pink_bean",
};
const BOSS_NAME_KEY = {
  殘暴炎魔: "boss_zakum",
  暗黑龍王: "boss_dark_dragon",
  拉圖斯: "boss_papulatus",
  海怒斯: "boss_hainurs",
  皮卡啾: "boss_pink_bean",
};
export function resolveBossKey(boss) {
  if (!boss) return "boss_zakum";
  if (BOSS_ANIMS[boss.id]) return boss.id;
  return (
    BOSS_ALIAS[boss.id] ||
    BOSS_ALIAS[boss.botKey] ||
    BOSS_NAME_KEY[boss.nameZh] ||
    "boss_zakum"
  );
}
