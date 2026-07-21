/**
 * Stage 02 — Moving Target
 * Dual routes (workflow + service elevator). Forces coverage of both lanes.
 */
export const STAGE_02 = {
  id: "moving-target",
  index: 1,
  code: "MOVING TARGET",
  name: "勇士部落岔路",
  nameEn: "Perion Fork",
  briefing:
    "上下兩條山路同時來襲！幽靈木妖會走捷徑，務必雙線佈防。",
  coreHp: 22,
  teamLimit: 7,
  deploymentPoints: 12,
  sellEnabled: true,
  map: {
    width: 960,
    height: 540,
    paths: {
      // Upper workflow lane
      workflow: [
        { x: -20, y: 140 },
        { x: 160, y: 140 },
        { x: 280, y: 140 },
        { x: 400, y: 100 },
        { x: 560, y: 100 },
        { x: 700, y: 160 },
        { x: 820, y: 220 },
        { x: 900, y: 280 },
        { x: 980, y: 300 },
      ],
      // Lower service elevator lane
      event: [
        { x: -20, y: 420 },
        { x: 160, y: 420 },
        { x: 300, y: 440 },
        { x: 460, y: 400 },
        { x: 600, y: 380 },
        { x: 740, y: 360 },
        { x: 840, y: 320 },
        { x: 900, y: 300 },
        { x: 980, y: 300 },
      ],
    },
    pads: [
      // upper coverage
      { x: 220, y: 70 },
      { x: 220, y: 210 },
      { x: 380, y: 60 },
      { x: 380, y: 180 },
      { x: 540, y: 50 },
      { x: 540, y: 170 },
      // mid choke
      { x: 480, y: 260 },
      { x: 640, y: 240 },
      // lower coverage
      { x: 220, y: 340 },
      { x: 220, y: 480 },
      { x: 400, y: 340 },
      { x: 400, y: 480 },
      { x: 580, y: 320 },
      { x: 580, y: 460 },
      // core approach
      { x: 760, y: 200 },
      { x: 760, y: 360 },
    ],
    core: { x: 900, y: 300, radius: 28 },
  },
  waves: [
    {
      name: "SPLIT INBOX",
      intel: "上下兩路同時湧入基礎通知。",
      groups: [
        { at: 0, path: "workflow", units: [["notification", 6]], interval: 0.9 },
        { at: 0.4, path: "event", units: [["notification", 6]], interval: 0.9 },
      ],
    },
    {
      name: "BLIND SIDE",
      intel: "上路隱形 Bug，下路衝突對。",
      groups: [
        { at: 0, path: "workflow", units: [["bug", 4]], interval: 1.1 },
        { at: 0.5, path: "event", units: [["conflict", 3], ["notification", 4]], interval: 1.0 },
      ],
    },
    {
      name: "SERVICE FLOOD",
      intel: "電梯路線大量通知 + 少量坦克。",
      groups: [
        { at: 0, path: "event", units: [["notification", 10]], interval: 0.55 },
        { at: 1.5, path: "event", units: [["burnout", 1]], interval: 2 },
        { at: 0, path: "workflow", units: [["conflict", 2]], interval: 1.6 },
      ],
    },
    {
      name: "CROSS TRAFFIC",
      intel: "兩路交錯推進，考驗轉火。",
      groups: [
        { at: 0, path: "workflow", units: [["ticketZombie", 4], ["notification", 4]], interval: 0.85 },
        { at: 2.0, path: "event", units: [["bug", 4], ["conflict", 2]], interval: 0.95 },
        { at: 5.0, path: "workflow", units: [["handoffGhost", 3]], interval: 1.0 },
      ],
    },
    {
      name: "HANDOFF STORM",
      intel: "Handoff Ghost 走電梯捷徑，速度快。",
      groups: [
        { at: 0, path: "event", units: [["handoffGhost", 6]], interval: 0.75 },
        { at: 1.0, path: "workflow", units: [["burnout", 2], ["notification", 6]], interval: 0.9 },
      ],
    },
    {
      name: "STACKED QUEUE",
      intel: "復活 Ticket 與隱形單位雙線壓制。",
      groups: [
        { at: 0, path: "workflow", units: [["ticketZombie", 6]], interval: 0.95 },
        { at: 0.5, path: "event", units: [["bug", 5], ["handoffGhost", 3]], interval: 0.85 },
        { at: 4.0, path: "event", units: [["conflict", 3]], interval: 1.2 },
      ],
    },
    {
      name: "TWO INBOXES",
      intel: "每條路線各自帶一種優先問題。",
      groups: [
        { at: 0, path: "workflow", units: [["burnout", 2], ["bug", 4]], interval: 1.0 },
        { at: 0.3, path: "event", units: [["ticketZombie", 5], ["handoffGhost", 4]], interval: 0.8 },
        { at: 6.0, path: "workflow", units: [["notification", 8]], interval: 0.5 },
        { at: 6.5, path: "event", units: [["notification", 8]], interval: 0.5 },
      ],
    },
    {
      name: "RE-SUBMISSION+",
      intel: "雙路小怪掩護審閱迴圈。兩路都要守！",
      groups: [
        { at: 0, path: "workflow", units: [["reviewLoop", 1]], interval: 1 },
        { at: 1.5, path: "workflow", units: [["notification", 6], ["bug", 3]], interval: 0.7 },
        { at: 1.5, path: "event", units: [["handoffGhost", 5], ["ticketZombie", 4]], interval: 0.75 },
        { at: 9.0, path: "event", units: [["burnout", 2], ["conflict", 3]], interval: 1.0 },
      ],
    },
  ],
  waveClearBonus: {
    0: 1,
    2: 2,
    4: 2,
    6: 3,
  },
  waveRewards: {
    1: ["espresso", "sticky", "keyboard"],
    3: ["stapler", "firewall", "powerBank"],
    5: ["backup", "copier", "espresso"],
  },
};
