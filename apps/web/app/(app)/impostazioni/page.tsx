/* eslint-disable @next/next/no-img-element */
import { Trash2 } from "lucide-react";

import {
  addCenterHours,
  addClosure,
  addRoom,
  addSubject,
  waxumConnect,
  waxumLogout,
  removeSetting,
  saveGeneral,
  toggleRoom,
} from "@/app/(app)/actions/settings";
import { AutoRefresh } from "@/components/auto-refresh";
import { Badge, Button, Card, CardHeader, cn, Field, Input, PageHeader } from "@/components/ui";
import { microUsdToEur } from "@/lib/ai/pricing";
import { loadRates } from "@/lib/billing/load";
import { sessionClient } from "@/lib/db/clients";
import { loadSettings } from "@/lib/db/repo";
import { formatEuro } from "@/lib/domain/billing";
import { hhmm, monthStart, romeToInstant, shortDate, todayRome, WEEKDAYS, WEEKDAYS_SHORT } from "@/lib/domain/time";
import { WaxumChannel, waxumConfigFromEnv } from "@/lib/whatsapp/waxum";

const WAXUM_STATE: Record<string, [string, "ok" | "warn" | "danger" | "neutral"]> = {
  logged_in: ["collegato", "ok"],
  waiting_for_qr: ["inquadra il QR", "warn"],
  waiting_for_pair_code: ["in attesa del codice di abbinamento", "warn"],
  connecting: ["connessione in corso", "neutral"],
  connected: ["socket connesso, autenticazione in corso", "neutral"],
  disconnected: ["scollegato: premi Collega", "warn"],
  paused: ["sessione in pausa", "warn"],
  socket_offline: ["login salvato, socket offline: ricollega", "warn"],
  missing: ["sessione da creare", "warn"],
  unauthorized: ["token Waxum non valido o permessi insufficienti", "danger"],
  unreachable: ["Waxum non raggiungibile", "danger"],
};

export default async function SettingsPage() {
  const db = await sessionClient();
  const today = todayRome();
  const waxumCfg = waxumConfigFromEnv();
  const [settings, rates, { data: hours }, { data: closures }, { data: rooms }, { data: subjects }, { data: aiRows }, waxum] = await Promise.all([
    loadSettings(db),
    loadRates(db),
    db.from("center_hours").select("*").order("weekday").order("start_min"),
    db.from("center_closures").select("*").gte("date", today).order("date"),
    db.from("rooms").select("*").order("name"),
    db.from("subjects").select("id, name").order("name"),
    db.from("ai_events").select("cost_micro_usd, tier").gte("created_at", romeToInstant(monthStart(today), 0).toISOString()),
    waxumCfg ? new WaxumChannel(waxumCfg).status() : Promise.resolve(null),
  ]);
  const spent = microUsdToEur((aiRows ?? []).reduce((a, r) => a + Number(r.cost_micro_usd), 0));
  const calls = (aiRows ?? []).length;
  const [waLabel, waTone] = WAXUM_STATE[waxum?.state ?? "unreachable"] ?? [waxum?.state ?? "", "neutral"];
  const euro = (cents: number) => String(cents / 100).replace(".", ",");

  return (
    <>
      {waxum && ["connecting", "connected", "waiting_for_qr", "waiting_for_pair_code"].includes(waxum.state) && <AutoRefresh seconds={5} />}
      <PageHeader eyebrow="Configurazione" title="Impostazioni" />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="WhatsApp · Waxum" subtitle="API self-hosted, sessione dedicata a CreaCloud" />
          <div className="flex flex-col gap-4 p-5 text-sm">
            <p>Invii manuali, risposte AI e messaggi dal telefono usano la sessione Waxum configurata sul server.</p>
            <div className="rounded-2xl border p-4">
              <p className="flex items-center gap-2 font-semibold">
                Numero del centro {waxumCfg ? <Badge tone={waTone}>{waLabel}</Badge> : <Badge tone="warn">Waxum non configurato</Badge>}
              </p>
              {waxumCfg && <p className="mt-1 text-xs text-muted">Sessione: {waxumCfg.sessionId}</p>}
              {waxum?.me && <p className="mt-1 text-xs text-muted">Collegato come {waxum.me}</p>}
              {waxum?.qr && (
                <div className="mt-3 flex flex-col items-center gap-2">
                  <img src={waxum.qr} alt="QR per collegare WhatsApp a Waxum" className="size-56 rounded-xl bg-white p-2" />
                  <p className="text-center text-xs text-muted">Sul telefono: WhatsApp → Dispositivi collegati → Collega un dispositivo.</p>
                </div>
              )}
              {waxumCfg && (
                <div className="mt-3 flex gap-2">
                  <form action={waxumConnect}>
                    <Button size="sm" variant="primary">Collega / riconfigura webhook</Button>
                  </form>
                  {waxum?.state === "logged_in" && <form action={waxumLogout}>
                    <Button size="sm" variant="ghost">Scollega questo numero</Button>
                  </form>}
                </div>
              )}
              <p className="mt-3 text-xs text-muted">
                Scollega rimuove il dispositivo collegato, ma conserva sessione e webhook. Per un nuovo QR premi Collega.
                Non eliminare la sessione Waxum. I gruppi e gli aggiornamenti di stato non attivano l&apos;assistente.
              </p>
              <p className="mt-3 text-xs text-muted">
                Collegamento non ufficiale: il self-hosting non elimina il rischio di limitazioni da WhatsApp.
                L&apos;AI non avvia nuovi contatti salvo esplicita configurazione; il coordinatore può inviare manualmente.
              </p>
            </div>
          </div>
        </Card>

        <Card>
          <CardHeader title="Regole e assistente" />
          <form action={saveGeneral} className="grid grid-cols-2 gap-3 p-5 text-sm">
            <label className="col-span-2 flex items-center gap-2 font-medium">
              <input type="checkbox" name="ai_enabled" defaultChecked={settings.aiEnabled} /> Assistente AI attivo
            </label>
            <Field label="Budget AI mensile (€)" hint={`Speso questo mese: ${formatEuro(Math.round(spent * 100))} in ${calls} chiamate`}>
              <Input name="ai_monthly_budget_eur" defaultValue={String(settings.aiMonthlyBudgetEur).replace(".", ",")} inputMode="decimal" />
            </Field>
            <Field label="Preavviso annullamento (ore)" hint="Prima: non si paga. Dopo: si paga">
              <Input name="cancellation_hours" defaultValue={settings.cancellationHours} inputMode="numeric" />
            </Field>
            <p className="label-caps col-span-2 pt-2 text-muted">Tariffe di default (€/ora)</p>
            <Field label="Famiglia, singola">
              <Input name="default_hourly_rate_cents" defaultValue={euro(rates.defaultHourly)} inputMode="decimal" />
            </Field>
            <Field label="Famiglia, gruppo">
              <Input name="default_group_hourly_rate_cents" defaultValue={euro(rates.defaultGroupHourly)} inputMode="decimal" />
            </Field>
            <Field label="Tutor, singola">
              <Input name="default_tutor_hourly_rate_cents" defaultValue={euro(rates.defaultTutorHourly)} inputMode="decimal" />
            </Field>
            <Field label="Tutor, gruppo">
              <Input name="default_tutor_group_hourly_rate_cents" defaultValue={euro(rates.defaultTutorGroupHourly)} inputMode="decimal" />
            </Field>
            <p className="col-span-2 text-xs text-muted">Oltre il budget l&apos;assistente smette di rispondere da solo e prepara solo bozze da approvare in chat.</p>
            <Button variant="primary" className="col-span-2">Salva</Button>
          </form>
        </Card>

        <Card>
          <CardHeader title="Orari del centro" subtitle="Il motore colloca le lezioni in presenza solo in queste fasce" />
          <div className="grid grid-cols-7 gap-1 p-5 text-center text-xs">
            {WEEKDAYS_SHORT.map((d, i) => (
              <div key={d} className="flex flex-col gap-1">
                <span className="label-caps text-muted">{d}</span>
                {(hours ?? [])
                  .filter((h) => h.weekday === i)
                  .map((h) => (
                    <form key={h.id} action={removeSetting} className="group relative rounded-lg bg-pesca/15 px-1 py-1.5 tabular-nums">
                      <input type="hidden" name="table" value="center_hours" />
                      <input type="hidden" name="id" value={h.id} />
                      {hhmm(h.start_min)}
                      <br />
                      {hhmm(h.end_min)}
                      <button className="absolute -right-1 -top-1 hidden rounded-full bg-surface p-0.5 text-danger shadow group-hover:block" aria-label={`Rimuovi fascia di ${WEEKDAYS[i]}`}>
                        <Trash2 className="size-3" />
                      </button>
                    </form>
                  ))}
              </div>
            ))}
          </div>
          <form action={addCenterHours} className="flex flex-wrap items-center gap-2 border-t p-5 text-sm">
            {WEEKDAYS_SHORT.map((d, i) => (
              <label key={d} className="flex items-center gap-1">
                <input type="checkbox" name="weekday" value={i} defaultChecked={i < 5} /> {d}
              </label>
            ))}
            <Input name="start" placeholder="14:30" className="w-24" required />
            <Input name="end" placeholder="19:30" className="w-24" required />
            <Button size="sm" variant="primary">Aggiungi</Button>
          </form>
        </Card>

        <Card>
          <CardHeader title="Chiusure" subtitle="Festività e ponti: nessuna lezione in questi giorni" />
          <ul className="divide-y text-sm">
            {(closures ?? []).map((c) => (
              <li key={c.date} className="flex items-center gap-3 px-5 py-2">
                <span className="w-32 tabular-nums">{shortDate(c.date)}</span>
                <span className="flex-1 text-muted">{c.note}</span>
                <form action={removeSetting}>
                  <input type="hidden" name="table" value="center_closures" />
                  <input type="hidden" name="id" value={c.date} />
                  <button className="text-muted hover:text-danger" aria-label="Rimuovi chiusura">
                    <Trash2 className="size-4" />
                  </button>
                </form>
              </li>
            ))}
            {!closures?.length && <li className="px-5 py-3 text-muted">Nessuna chiusura in programma.</li>}
          </ul>
          <form action={addClosure} className="flex flex-wrap items-center gap-2 border-t p-5 text-sm">
            <Input name="from" type="date" required className="w-40" />
            <span className="text-muted">al</span>
            <Input name="to" type="date" className="w-40" />
            <Input name="note" placeholder="es. Vacanze di Natale" className="min-w-32 flex-1" />
            <Button size="sm" variant="primary">Aggiungi</Button>
          </form>
        </Card>

        <Card>
          <CardHeader title="Postazioni" subtitle="Aule o tavoli: limitano quante lezioni in presenza si tengono insieme" />
          <ul className="divide-y text-sm">
            {(rooms ?? []).map((r) => (
              <li key={r.id} className="flex items-center gap-3 px-5 py-2">
                <span className={cn("flex-1 font-medium", !r.active && "text-muted line-through")}>{r.name}</span>
                <span className="text-muted">{r.capacity} {r.capacity === 1 ? "posto" : "posti"}</span>
                <form action={toggleRoom}>
                  <input type="hidden" name="id" value={r.id} />
                  <input type="hidden" name="active" value={r.active ? "0" : "1"} />
                  <Button size="sm" variant="ghost">{r.active ? "Disattiva" : "Riattiva"}</Button>
                </form>
              </li>
            ))}
          </ul>
          <form action={addRoom} className="flex gap-2 border-t p-5 text-sm">
            <Input name="name" placeholder="Nome, es. Aula 1" required className="flex-1" />
            <Input name="capacity" placeholder="posti" inputMode="numeric" className="w-20" />
            <Button size="sm" variant="primary">Aggiungi</Button>
          </form>
        </Card>

        <Card>
          <CardHeader title="Materie" />
          <div className="flex flex-wrap gap-2 p-5">
            {(subjects ?? []).map((s) => (
              <form key={s.id} action={removeSetting} className="flex items-center gap-1 rounded-full border py-1 pl-3 pr-1 text-sm">
                <input type="hidden" name="table" value="subjects" />
                <input type="hidden" name="id" value={s.id} />
                {s.name}
                <button className="rounded-full p-1 text-muted hover:text-danger" aria-label={`Rimuovi ${s.name}`} title="Si può rimuovere solo se non è mai stata usata">
                  <Trash2 className="size-3" />
                </button>
              </form>
            ))}
          </div>
          <form action={addSubject} className="flex gap-2 border-t p-5 text-sm">
            <Input name="name" placeholder="es. Latino" required className="flex-1" />
            <Button size="sm" variant="primary">Aggiungi</Button>
          </form>
        </Card>
      </div>
    </>
  );
}
