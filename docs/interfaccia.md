# Interfaccia della dashboard

Come è costruita la dashboard (`apps/web`) e le regole da seguire quando si
aggiunge o si modifica una pagina.

## Tecnologie

- **Next.js 16** (App Router, server components, server actions), React 19, TypeScript.
- **shadcn/ui** su Radix (`components/ui/*`), Tailwind CSS v4, icone `lucide-react`.
- **TanStack Table** per le tabelle, **TanStack Query** e **Supabase Realtime** per i dati che cambiano dal vivo (chat).
- **react-hook-form + zod** per i moduli: lo stesso schema valida nel browser e sul server.
- **Supabase** tipizzato: `lib/db/types.ts` è generato dallo schema
  (`npx supabase gen types typescript --local --schema public`, poi `npx prettier --write`).

## Struttura

| Percorso | Contenuto |
|---|---|
| `app/(app)/<pagina>/page.tsx` | Server component: legge i dati con `sessionClient()` e li passa ai componenti client |
| `app/(app)/<pagina>/_components/*` | Componenti della singola pagina |
| `app/(app)/actions/<area>.ts` | Azioni server (`"use server"`) create con `action()` |
| `lib/schemas/<area>.ts` | Schemi zod condivisi da moduli e azioni (niente `"use server"`) |
| `components/ui/*` | Kit shadcn/ui: non si modifica per una singola pagina |
| `components/app/*` | Mattoni comuni: intestazioni, tabelle, pannelli, campi, stati |
| `components/layout/*` | Menu laterale, intestazione, ricerca rapida, barra su telefono |
| `components/whatsapp/*` | Chat WhatsApp |
| `lib/format.ts` | Date, orari, euro, telefoni, dimensioni file in italiano |

## Pagine

```tsx
export default async function Pagina() {
  const db = await sessionClient();
  const { data } = await db.from("rooms").select("id, name").order("name");
  return (
    <PageBody>
      <PageHeader title="Aule" description="…" actions={<NuovaAula />} />
      <Section title="Elenco">…</Section>
    </PageBody>
  );
}
```

- `PageBody` dà larghezza e spaziatura; la chat usa invece tutta l'altezza (`h-full`).
- Le schede di una pagina (`Tabs`) si riflettono nell'URL (`?tab=`), così il link si può condividere e il tasto Indietro funziona.
- `?nuovo=famiglia|tutor|pagamento|compenso` apre il pannello di creazione: lo usano il pulsante "Nuovo" e la ricerca rapida.
- I dati che altri possono cambiare mentre la pagina è aperta si aggiornano con `<RealtimeRefresh tables={[…]} />`.

## Modifiche: azioni e moduli

```ts
// lib/schemas/rooms.ts
export const roomSchema = z.object({ name: z.string().trim().min(1, "Scrivi il nome"), capacity: z.number().int().min(1) });

// app/(app)/actions/rooms.ts
"use server";
export const createRoom = action(roomSchema, async (input, { db, staff }) => {
  ok(await db.from("rooms").insert(input), "creazione aula");
  await audit(db, staff.userId, "crea_aula", "rooms", null, input);
  revalidatePath("/impostazioni");
});
```

- `action()` verifica lo staff, valida l'input e restituisce `{ ok, data }` o `{ ok: false, error, fieldErrors }`: mai eccezioni al browser.
- `ok(res, "cosa")` trasforma gli errori di Supabase in messaggi italiani; `okRow(res, "cosa")` in più garantisce che la riga ci sia (`.single()`); `ActionError` per errori previsti ("La lezione è già annullata").
- Nel browser: `FormPanel` per creare e modificare (pannello laterale su desktop, dal basso su telefono), `useAction` per i pulsanti, `Confirm` prima di eliminare o di mandare messaggi.
- I campi (`components/app/fields.tsx`) tengono i valori nel tipo naturale: euro in centesimi, orari in minuti, date "AAAA-MM-GG", giorni 0 = lunedì.

## Elenchi

`DataTable` (`components/app/data-table`): ricerca senza accenti, filtri a faccette con conteggi, ordinamento, paginazione, riga cliccabile (`rowHref`) e **scheda su telefono** (`mobileCard`). Ogni elenco ha uno stato vuoto (`EmptyState`) con l'azione per iniziare.

## Regole

- **Italiano semplice**, seconda persona ("Scegli il tutor"), frasi brevi. Nessun termine tecnico o id interno visibile.
- **Telefono prima di tutto**: tutto deve funzionare a 360px senza scorrimento orizzontale (`min-w-0` sui figli di grid e flex), con bersagli di almeno 44px (già gestiti dal kit) e testo dei campi a 16px.
- **Accessibilità**: ogni campo ha un'etichetta, ogni pulsante solo icona ha `aria-label`, lo stato non si comunica solo col colore, tutto si usa da tastiera. Animazioni ridotte rispettate (`data-motion="off"` e preferenza di sistema).
- **Tema chiaro e scuro**: solo colori dei token (`bg-card`, `text-muted-foreground`, `bg-pesca-soft`…), mai colori fissi.
- **Date e orari** nel fuso del centro (`lib/domain/time.ts`, `lib/format.ts`), mai `toLocaleString` senza fuso.
- **Azioni con effetti esterni** (messaggi WhatsApp, invio orari) chiedono conferma e dicono a chi arriverà cosa.
