/**
 * Stage 01 — First Shift
 * Single path, 8 waves, mixed threat grammar + final mini-boss.
 */
export const STAGE_01 = {
  id: "first-shift",
  index: 0,
  code: "FIRST SHIFT",
  name: "維多利亞港外圍",
  nameEn: "Victoria Road",
  briefing:
    "藍蝸牛與木妖湧向神木。組成 3 人小隊，建立第一道防線！",
  coreHp: 20,
  teamLimit: 6,
  deploymentPoints: 10,
  sellEnabled: true,
  map: {
    width: 960,
    height: 540,
    paths: {
      workflow: [
        { x: -20, y: 270 },
        { x: 140, y: 270 },
        { x: 140, y: 120 },
        { x: 360, y: 120 },
        { x: 360, y: 400 },
        { x: 620, y: 400 },
        { x: 620, y: 180 },
        { x: 820, y: 180 },
        { x: 820, y: 300 },
        { x: 980, y: 300 },
      ],
    },
    pads: [
      { x: 220, y: 200 },
      { x: 220, y: 340 },
      { x: 300, y: 250 },
      { x: 440, y: 200 },
      { x: 440, y: 320 },
      { x: 520, y: 250 },
      { x: 700, y: 250 },
      { x: 700, y: 360 },
      { x: 760, y: 120 },
      { x: 760, y: 250 },
    ],
    core: { x: 900, y: 300, radius: 28 },
  },
  waves: [
    {
      name: "FIRST PING",
      intel: "快速、脆弱的通知流量。",
      groups: [{ at: 0, path: "workflow", units: [["notification", 6]], interval: 0.95 }],
    },
    {
      name: "HIDDEN ATTACHMENT",
      intel: "隱形 Bug 混進通知流。",
      groups: [
        { at: 0, path: "workflow", units: [["notification", 7]], interval: 0.85 },
        { at: 2.5, path: "workflow", units: [["bug", 3]], interval: 1.2 },
      ],
    },
    {
      name: "CONFLICT THREAD",
      intel: "耐打的衝突對為第二線爭取時間。",
      groups: [
        { at: 0, path: "workflow", units: [["conflict", 3]], interval: 1.8 },
        { at: 2.0, path: "workflow", units: [["notification", 6]], interval: 0.75 },
      ],
    },
    {
      name: "LOCK TEST",
      intel: "隱藏 Bug 懲罰覆蓋不足的佈陣。",
      groups: [
        { at: 0, path: "workflow", units: [["bug", 5], ["conflict", 3]], interval: 1.05 },
      ],
    },
    {
      name: "BURNOUT WALL",
      intel: "厚血錨點吸收火力，掩護蟲群。",
      groups: [
        { at: 0, path: "workflow", units: [["burnout", 2]], interval: 3.2 },
        { at: 2.0, path: "workflow", units: [["notification", 10]], interval: 0.55 },
      ],
    },
    {
      name: "REOPENED TICKET",
      intel: "Ticket 殭屍擊敗後會復活一次。",
      groups: [
        { at: 0, path: "workflow", units: [["ticketZombie", 6]], interval: 1.1 },
        { at: 3.0, path: "workflow", units: [["bug", 3]], interval: 1.0 },
      ],
    },
    {
      name: "SHIFT REVIEW",
      intel: "四種基礎威脅語法同時登場。",
      groups: [
        { at: 0, path: "workflow", units: [["burnout", 2]], interval: 2.6 },
        {
          at: 1.5,
          path: "workflow",
          units: [
            ["conflict", 3],
            ["bug", 3],
            ["notification", 8],
          ],
          interval: 0.7,
        },
      ],
    },
    {
      name: "RE-SUBMISSION",
      intel: "審閱迴圈半血會自我修復一次。守住 Core！",
      groups: [
        { at: 0, path: "workflow", units: [["reviewLoop", 1]], interval: 1 },
        {
          at: 2.5,
          path: "workflow",
          units: [
            ["notification", 8],
            ["ticketZombie", 4],
          ],
          interval: 0.65,
        },
        { at: 8.0, path: "workflow", units: [["bug", 4], ["conflict", 2]], interval: 0.9 },
      ],
    },
  ],
  waveClearBonus: {
    1: 2,
    3: 2,
    5: 3,
  },
  /** After clearing wave index N, offer one of these items */
  waveRewards: {
    2: ["espresso", "keyboard", "sticky"],
    4: ["stapler", "powerBank", "backup"],
    6: ["firewall", "copier", "espresso"],
  },
};
