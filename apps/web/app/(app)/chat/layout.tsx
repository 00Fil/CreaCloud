import { ChatList, type ChatListItem } from "@/components/chat-list";
import { ChatPanes } from "@/components/chat-panes";
import { LiveRefresh } from "@/components/live-refresh";
import { sessionClient } from "@/lib/db/clients";
import { hhmm, romeParts, todayRome } from "@/lib/domain/time";
import { roleOf } from "@/lib/chat/role";

function when(iso: string | null): string {
  if (!iso) return "";
  const p = romeParts(new Date(iso));
  return p.date === todayRome() ? hhmm(p.minutes) : `${p.date.slice(8, 10)}/${p.date.slice(5, 7)}`;
}

export default async function ChatLayout({ children }: { children: React.ReactNode }) {
  const db = await sessionClient();
  const { data } = await db
    .from("chats")
    .select("id, display_name, phone, parent_id, student_id, tutor_id, mode, takeover_until, last_message_at, last_message_preview, unread_count, needs_attention")
    .order("last_message_at", { ascending: false, nullsFirst: false })
    .limit(500);
  const now = Date.now();
  const chats: ChatListItem[] = (data ?? []).map((c) => ({
    id: c.id,
    name: c.display_name || c.phone,
    phone: c.phone,
    role: roleOf(c),
    manual: c.mode === "manuale" || Boolean(c.takeover_until && new Date(c.takeover_until).getTime() > now),
    when: when(c.last_message_at),
    preview: c.last_message_preview,
    unread: c.unread_count,
    attention: c.needs_attention,
  }));
  return (
    <ChatPanes
      list={
        <>
          <ChatList chats={chats} />
          <LiveRefresh tables={["chats"]} />
        </>
      }
    >
      {children}
    </ChatPanes>
  );
}
