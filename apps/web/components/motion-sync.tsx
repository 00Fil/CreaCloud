"use client";

import { useEffect } from "react";
import { MOTION_KEY, normalizeMotion } from "@/lib/ui/motion";

/** Keep open tabs in sync without waiting for a page navigation. */
export function MotionSync() {
  useEffect(() => {
    const sync = (event: StorageEvent) => {
      if (event.key === MOTION_KEY || event.key === null) {
        document.documentElement.dataset.motion = normalizeMotion(
          event.newValue,
        );
      }
    };
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, []);
  return null;
}
