export const MOTION_KEY = "creacloud.motion";
export type MotionPreference = "system" | "off";
export function normalizeMotion(value: unknown): MotionPreference {
  return value === "off" ? "off" : "system";
}

/** Runs before paint; localStorage can be unavailable in private/restricted contexts. */
export const motionBootstrap = `(()=>{try{document.documentElement.dataset.motion=localStorage.getItem("${MOTION_KEY}") === "off" ? "off" : "system"}catch{document.documentElement.dataset.motion="system"}})()`;
