"use client";

import * as React from "react";

import { browserClient } from "@/lib/db/browser";

import type { NavCountKey } from "./nav";

type Counts = Record<NavCountKey, number>;

const NavCountsContext = React.createContext<Counts>({ actions: 0, chats: 0 });

/**
 * Contatori del menu (azioni da approvare, chat da leggere), aggiornati in
 * tempo reale senza ricaricare la pagina.
 */
export function NavCountsProvider({ initial, children }: { initial: Counts; children: React.ReactNode }) {
  const [counts, setCounts] = React.useState(initial);

  React.useEffect(() => {
    const db = browserClient();
    let timer: ReturnType<typeof setTimeout> | null = null;
    const reload = async () => {
      const [actions, chats] = await Promise.all([
        db.from("pending_actions").select("id", { count: "exact", head: true }).eq("status", "in_attesa"),
        db.from("chats").select("id", { count: "exact", head: true }).is("archived_at", null).or("unread_count.gt.0,needs_attention.eq.true"),
      ]);
      setCounts({ actions: actions.count ?? 0, chats: chats.count ?? 0 });
    };
    const schedule = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(reload, 500);
    };
    const channel = db
      .channel("nav-counts")
      .on("postgres_changes", { event: "*", schema: "public", table: "pending_actions" }, schedule)
      .on("postgres_changes", { event: "*", schema: "public", table: "chats" }, schedule)
      .subscribe();
    return () => {
      if (timer) clearTimeout(timer);
      void db.removeChannel(channel);
    };
  }, []);

  return <NavCountsContext.Provider value={counts}>{children}</NavCountsContext.Provider>;
}

export function useNavCounts() {
  return React.useContext(NavCountsContext);
}
