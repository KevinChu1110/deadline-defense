/**
 * Mid-wave office tools / consumable buffs.
 * Applied once when the player picks a reward card.
 */

export const ITEMS = {
  espresso: {
    id: "espresso",
    name: "Double Espresso",
    nameZh: "雙倍濃縮",
    icon: "☕",
    color: "#c4a484",
    desc: "全體攻擊速度 +30%（本關剩餘時間）",
    apply(game) {
      game.buffs.attackSpeedMult *= 1.3;
      return "攻擊速度提升 30%";
    },
  },
  keyboard: {
    id: "keyboard",
    name: "Mechanical Keyboard",
    nameZh: "機械鍵盤",
    icon: "⌨️",
    color: "#94a3b8",
    desc: "立刻獲得 +3 部署點數",
    apply(game) {
      game.points += 3;
      return "+3 部署點數";
    },
  },
  sticky: {
    id: "sticky",
    name: "Priority Notes",
    nameZh: "優先便利貼",
    icon: "📝",
    color: "#fde047",
    desc: "Core 附近自動緩速（半徑 140）",
    apply(game) {
      game.buffs.coreSlowRadius = Math.max(game.buffs.coreSlowRadius, 140);
      game.buffs.coreSlowPower = Math.min(game.buffs.coreSlowPower || 1, 0.55);
      return "Core 防線緩速啟動";
    },
  },
  stapler: {
    id: "stapler",
    name: "Auto Stapler",
    nameZh: "自動釘書機",
    icon: "📎",
    color: "#fb923c",
    desc: "忽略敵人 35% 護甲",
    apply(game) {
      game.buffs.armorBreak = Math.max(game.buffs.armorBreak, 0.35);
      return "破甲 +35%";
    },
  },
  powerBank: {
    id: "powerBank",
    name: "Power Bank",
    nameZh: "行動電源",
    icon: "🔋",
    color: "#4ade80",
    desc: "全體傷害 +25%",
    apply(game) {
      game.buffs.damageMult *= 1.25;
      return "傷害提升 25%";
    },
  },
  backup: {
    id: "backup",
    name: "Backup Drive",
    nameZh: "備份硬碟",
    icon: "💾",
    color: "#60a5fa",
    desc: "修復 Core +4 HP（不超過上限）",
    apply(game) {
      const before = game.coreHp;
      game.coreHp = Math.min(game.coreMax, game.coreHp + 4);
      return `Core +${game.coreHp - before}`;
    },
  },
  firewall: {
    id: "firewall",
    name: "Enterprise Firewall",
    nameZh: "企業防火牆",
    icon: "🛡️",
    color: "#22d3ee",
    desc: "吸收接下來 5 次漏怪傷害",
    apply(game) {
      game.buffs.coreShield += 5;
      return "Core 護盾 ×5";
    },
  },
  copier: {
    id: "copier",
    name: "High-Speed Copier",
    nameZh: "高速影印機",
    icon: "🖨️",
    color: "#a78bfa",
    desc: "隊伍上限 +1，並 +1 部署點",
    apply(game) {
      game.teamLimit += 1;
      game.points += 1;
      return "隊伍上限 +1、點數 +1";
    },
  },
};

export function getItem(id) {
  return ITEMS[id] || null;
}
