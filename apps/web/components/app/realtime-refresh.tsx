"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

import { browserClient } from "@/lib/db/browser";

/**
 * Ricarica i dati della pagina (server components) quando cambiano le
 * tabelle indicate, con Supabase Realtime. Le modifiche ravvicinate vengono
 * raggruppate in un solo aggiornamento.
 */
export function RealtimeRefresh({
  tables,
  filter,
  delay = 400,
}: {
  tables: string[];
  /** Filtro Realtime applicato a tutte le tabelle, es. "chat_id=eq.123". */
  filter?: string;
  delay?: number;
}) {
  const router = useRouter();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const key = tables.join(",");

  useEffect(() => {
    const db = browserClient();
    const channel = db.channel(`refresh:${key}:${filter ?? "*"}`);
    for (const table of key.split(",")) {
      channel.on("postgres_changes", { event: "*", schema: "public", table, ...(filter ? { filter } : {}) }, () => {
        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(() => router.refresh(), delay);
      });
    }
    channel.subscribe();
    return () => {
      if (timer.current) clearTimeout(timer.current);
      void db.removeChannel(channel);
    };
  }, [router, key, filter, delay]);

  return null;
}
