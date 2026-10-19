"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import {
  MOTION_KEY,
  normalizeMotion,
  type MotionPreference,
} from "@/lib/ui/motion";
import { Card, CardHeader } from "./ui";

const CHANGE_EVENT = "creacloud:motion";
let fallback: MotionPreference = "system";
let sessionOverride: MotionPreference | null = null;
function snapshot() {
  if (sessionOverride) return sessionOverride;
  try {
    return normalizeMotion(localStorage.getItem(MOTION_KEY));
  } catch {
    return fallback;
  }
}
function subscribe(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener(CHANGE_EVENT, callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(CHANGE_EVENT, callback);
  };
}

export function MotionPreferences() {
  const preference = useSyncExternalStore(
    subscribe,
    snapshot,
    () => "system" as const,
  );
  const [feedback, setFeedback] = useState("");
  useEffect(() => {
    document.documentElement.dataset.motion = snapshot();
  }, [preference]);
  return (
    <Card>
      <CardHeader
        title="Comfort e accessibilità"
        subtitle="Preferenze di questo browser, senza modificare quelle del centro"
      />
      <div className="space-y-3 p-5 text-sm">
        <label htmlFor="motion-preference" className="block font-semibold">
          Animazioni e microinterazioni
        </label>
        <select
          id="motion-preference"
          aria-describedby="motion-help"
          value={preference}
          className="min-h-11 w-full rounded-xl border bg-surface px-3.5 py-2.5 text-ink focus:border-pervinca focus:ring-4 focus:ring-pervinca/15"
          onChange={(event) => {
            const next = normalizeMotion(event.target.value);
            fallback = next;
            let saved = true;
            try {
              localStorage.setItem(MOTION_KEY, next);
              sessionOverride = null;
            } catch {
              saved = false;
              sessionOverride = next;
            }
            document.documentElement.dataset.motion = next;
            window.dispatchEvent(new Event(CHANGE_EVENT));
            setFeedback(
              saved
                ? "Preferenza salvata in questo browser."
                : "Preferenza applicata per questa sessione. Il browser non consente il salvataggio.",
            );
          }}
        >
          <option value="system">Discrete (automatiche)</option>
          <option value="off">Disattivate</option>
        </select>
        <p id="motion-help" className="text-ink-soft">
          Transizioni brevi, senza effetti decorativi continui. Se il
          dispositivo richiede di ridurre il movimento, le animazioni vengono
          disattivate anche in modalità discreta. I messaggi di stato restano
          sempre visibili.
        </p>
        <p role="status" className="min-h-5 text-xs text-ink-soft">
          {feedback}
        </p>
      </div>
    </Card>
  );
}
