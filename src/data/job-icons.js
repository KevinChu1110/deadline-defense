/**
 * CC0 496 Pixel Art Icons (RPG) — job weapon badges.
 * Source: OpenGameArt "496 Pixel Art Icons for Medieval/Fantasy RPG" (CC0).
 * Not MapleStory official art.
 */

/** @type {Record<string, string>} */
export const JOB_ICON = {
  hero: "/icons/W_Sword015.png",
  paladin: "/icons/W_Sword009.png",
  dark_knight: "/icons/W_Spear007.png",
  mage: "/icons/S_Holy01.png",
  fire_mage: "/icons/S_Fire04.png",
  ice_mage: "/icons/S_Ice04.png",
  bowmaster: "/icons/W_Bow02.png",
  marksman: "/icons/W_Bow03.png",
  shadow_bandit: "/icons/W_Dagger005.png",
  night_envoy: "/icons/W_Dagger010.png",
  gunslinger: "/icons/W_Gun002.png",
  buccaneer: "/icons/W_Axe003.png",
  soul_swordsman: "/icons/W_Sword001.png",
  flame_wizard: "/icons/S_Fire01.png",
  wind_breaker: "/icons/W_Bow01.png",
  night_walker: "/icons/W_Dagger001.png",
  thunder_breaker: "/icons/S_Thunder01.png",
  // heroes
  aran: "/icons/W_Axe001.png",
  evan: "/icons/W_Staff08.png",
  mercedes: "/icons/W_Bow02.png",
  phantom: "/icons/W_Dagger001.png",
  luminous: "/icons/S_Magic01.png",
};

/** Family chip / fallback icons */
export const FAMILY_ICON = {
  warrior: "/icons/W_Sword001.png",
  mage: "/icons/W_Staff04.png",
  archer: "/icons/W_Bow01.png",
  thief: "/icons/W_Dagger001.png",
  pirate: "/icons/W_Gun001.png",
};

export function getJobIcon(jobId, family) {
  return JOB_ICON[jobId] || FAMILY_ICON[family] || "/icons/Ac_Medal01.png";
}
