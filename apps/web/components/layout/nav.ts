import {
  CalendarDays,
  CalendarRange,
  LayoutDashboard,
  MessageCircle,
  Settings,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";

export type NavCountKey = "actions" | "chats";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  count?: NavCountKey;
  /** Parole per la ricerca rapida. */
  keywords?: string;
}

export const NAV_GROUPS: { label: string; items: NavItem[] }[] = [
  {
    label: "Ogni giorno",
    items: [
      { href: "/", label: "Oggi", icon: LayoutDashboard, count: "actions", keywords: "home approvazioni da fare" },
      { href: "/chat", label: "Chat", icon: MessageCircle, count: "chats", keywords: "whatsapp messaggi" },
      { href: "/calendario", label: "Calendario", icon: CalendarDays, keywords: "lezioni settimana agenda" },
    ],
  },
  {
    label: "Organizzazione",
    items: [
      { href: "/persone", label: "Persone", icon: Users, keywords: "famiglie studenti genitori tutor anagrafiche" },
      { href: "/piano", label: "Pianificazione", icon: CalendarRange, keywords: "piano mese motore orari" },
      { href: "/conti", label: "Conti", icon: Wallet, keywords: "pagamenti compensi soldi incassi" },
    ],
  },
  {
    label: "Centro",
    items: [{ href: "/impostazioni", label: "Impostazioni", icon: Settings, keywords: "whatsapp orari aule materie tariffe" }],
  },
];

export const NAV_ITEMS = NAV_GROUPS.flatMap((g) => g.items);

/** Voci della barra in basso su telefono. */
export const MOBILE_NAV = ["/", "/chat", "/calendario", "/persone"];

export function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}

/** Collegamenti "Nuovo …": le pagine aprono il pannello giusto leggendo `?nuovo=`. */
export const QUICK_CREATE = [
  { href: "/persone?nuovo=famiglia", label: "Famiglia", description: "Genitore e figli" },
  { href: "/persone?tab=tutor&nuovo=tutor", label: "Tutor", description: "Insegnante e materie" },
  { href: "/conti?nuovo=pagamento", label: "Pagamento", description: "Incasso da una famiglia" },
  { href: "/conti?tab=tutor&nuovo=compenso", label: "Compenso tutor", description: "Pagamento a un tutor" },
] as const;
