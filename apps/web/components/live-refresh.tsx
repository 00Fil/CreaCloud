"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

import { browserClient } from "@/lib/db/browser";

/** Aggiorna la pagina quando cambiano le tabelle indicate (Supabase Realtime). */
export function LiveRefresh({ tables, filter, onMount }: { tables: string[]; filter?: string; onMount?: () => Promise<void> }) {
  const router = useRouter();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mounted = useRef(onMount);
  mounted.current = onMount;
  const key = tables.join(",");

  useEffect(() => {
    void mounted.current?.();
    const db = browserClient();
    const channel = db.channel(`live-${key}-${filter ?? "all"}`);
    for (const table of key.split(",")) {
      channel.on(
        "postgres_changes",
        { event: "*", schema: "public", table, ...(filter && table === "messages" ? { filter } : {}) },
        () => {
          if (timer.current) clearTimeout(timer.current);
          timer.current = setTimeout(() => router.refresh(), 250);
        },
      );
    }
    channel.subscribe();
    return () => {
      void db.removeChannel(channel);
    };
  }, [router, key, filter]);
  return null;
}
