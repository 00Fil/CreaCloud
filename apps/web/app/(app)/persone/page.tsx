import { ChevronRight, GraduationCap, Phone, Plus, UserRound } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

import { createFamily, upsertTutor } from "@/app/(app)/actions/people";
import { Badge, Button, Card, CardHeader, cn, Empty, Field, Input, PageHeader } from "@/components/ui";
import { sessionClient } from "@/lib/db/clients";

type Search = { tab?: string; q?: string; genitore?: string; studente?: string };

export default async function PeoplePage({ searchParams }: { searchParams: Promise<Search> }) {
  const sp = await searchParams;
  const db = await sessionClient();
  if (sp.genitore || sp.studente) {
    const { data } = await db
      .from(sp.genitore ? "parents" : "students")
      .select("family_id")
      .eq("id", (sp.genitore ?? sp.studente)!)
      .maybeSingle();
    if (data) redirect(`/persone/famiglia/${data.family_id}`);
  }
  const tab = sp.tab === "tutor" ? "tutor" : "famiglie";
  const q = (sp.q ?? "").trim().toLowerCase();

  return (
    <>
      <PageHeader eyebrow="Anagrafiche" title="Persone">
        Famiglie con genitori e figli, e i tutor del centro.
      </PageHeader>

      <div className="mb-5 flex flex-wrap items-center gap-2">
        {(["famiglie", "tutor"] as const).map((t) => (
          <Link
            key={t}
            href={`/persone?tab=${t}`}
            className={cn(
              "rounded-full border px-4 py-1.5 text-sm font-semibold capitalize",
              tab === t ? "border-pervinca bg-pervinca/10 text-pervinca-strong" : "text-ink-soft hover:bg-ink/5",
            )}
          >
            {t}
          </Link>
        ))}
        <form className="ml-auto w-full sm:w-72">
          <input type="hidden" name="tab" value={tab} />
          <Input name="q" defaultValue={sp.q} placeholder="Cerca per nome" />
        </form>
      </div>

      {tab === "famiglie" ? <Families q={q} /> : <Tutors q={q} />}
    </>
  );
}

async function Families({ q }: { q: string }) {
  const db = await sessionClient();
  const [{ data: families }, { data: parents }, { data: students }, { data: chats }] = await Promise.all([
    db.from("families").select("id, name, active").order("name"),
    db.from("parents").select("id, family_id, first_name, last_name, phone, is_primary"),
    db.from("students").select("id, family_id, first_name, last_name, school_level, phone, active"),
    db.from("chats").select("parent_id, student_id, needs_attention"),
  ]);
  const withChat = new Set((chats ?? []).flatMap((c) => [c.parent_id, c.student_id]).filter(Boolean));
  const list = (families ?? []).filter((f) => {
    if (!q) return true;
    const names = [f.name, ...(parents ?? []).filter((p) => p.family_id === f.id).map((p) => `${p.first_name} ${p.last_name}`), ...(students ?? []).filter((s) => s.family_id === f.id).map((s) => `${s.first_name} ${s.last_name}`)];
    return names.some((n) => n.toLowerCase().includes(q));
  });

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
      <Card>
        <CardHeader title={`${list.length} famiglie`} subtitle="Genitori e figli: tutti possono scrivere al centro" />
        {list.length ? (
          <ul className="divide-y">
            {list.map((f) => {
              const ps = (parents ?? []).filter((p) => p.family_id === f.id);
              const ss = (students ?? []).filter((s) => s.family_id === f.id && s.active);
              return (
                <li key={f.id}>
                  <Link href={`/persone/famiglia/${f.id}`} className="group flex items-start gap-4 px-5 py-4 hover:bg-ink/[0.03]">
                    <div className="min-w-0 flex-1">
                      <p className="font-serif text-lg leading-tight">{f.name}</p>
                      <div className="mt-2 flex flex-col gap-1.5 border-l-2 border-pervinca/30 pl-3 text-sm">
                        {ps.map((p) => (
                          <span key={p.id} className="flex items-center gap-2">
                            <UserRound className="size-3.5 text-pervinca" />
                            {p.first_name} {p.last_name}
                            {p.phone && <Phone className={cn("size-3", withChat.has(p.id) ? "text-ok" : "text-muted")} />}
                          </span>
                        ))}
                        {ss.map((s) => (
                          <span key={s.id} className="flex items-center gap-2 pl-4 text-ink-soft">
                            <GraduationCap className="size-3.5 text-pesca" />
                            {s.first_name}
                            {s.school_level && <Badge>{s.school_level}</Badge>}
                            {s.phone && <Phone className={cn("size-3", withChat.has(s.id) ? "text-ok" : "text-muted")} />}
                          </span>
                        ))}
                      </div>
                    </div>
                    <ChevronRight className="mt-1 size-5 text-muted transition group-hover:translate-x-0.5" />
                  </Link>
                </li>
              );
            })}
          </ul>
        ) : (
          <Empty>Nessuna famiglia trovata.</Empty>
        )}
      </Card>

      <Card className="h-fit">
        <CardHeader title="Nuova famiglia" />
        <form action={createFamily} className="flex flex-col gap-3 p-5">
          <Field label="Nome famiglia">
            <Input name="family_name" placeholder="es. Famiglia Bianchi" required />
          </Field>
          <p className="label-caps pt-2 text-pervinca">Genitore</p>
          <div className="grid grid-cols-2 gap-2">
            <Input name="parent_first_name" placeholder="Nome" />
            <Input name="parent_last_name" placeholder="Cognome" />
          </div>
          <Input name="parent_phone" placeholder="Telefono WhatsApp" inputMode="tel" />
          <p className="label-caps pt-2 text-pesca">Figlio/a</p>
          <div className="grid grid-cols-2 gap-2">
            <Input name="student_first_name" placeholder="Nome" />
            <Input name="student_last_name" placeholder="Cognome" />
          </div>
          <Input name="school_level" placeholder="Classe, es. 2 media" />
          <Button variant="primary" className="mt-2">
            <Plus /> Crea
          </Button>
        </form>
      </Card>
    </div>
  );
}

async function Tutors({ q }: { q: string }) {
  const db = await sessionClient();
  const [{ data: tutors }, { data: subjects }, { data: links }] = await Promise.all([
    db.from("tutors").select("id, first_name, last_name, phone, modes, active").order("last_name"),
    db.from("subjects").select("id, name"),
    db.from("tutor_subjects").select("tutor_id, subject_id"),
  ]);
  const name = new Map((subjects ?? []).map((s) => [s.id, s.name]));
  const list = (tutors ?? []).filter((t) => !q || `${t.first_name} ${t.last_name}`.toLowerCase().includes(q));
  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
      <Card>
        <CardHeader title={`${list.length} tutor`} />
        {list.length ? (
          <ul className="divide-y">
            {list.map((t) => (
              <li key={t.id}>
                <Link href={`/persone/tutor/${t.id}`} className="group flex items-center gap-4 px-5 py-4 hover:bg-ink/[0.03]">
                  <span className="flex size-10 items-center justify-center rounded-full bg-pesca/20 font-serif text-pesca-deep">{t.first_name[0]}</span>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">
                      {t.first_name} {t.last_name} {!t.active && <Badge tone="warn">non attivo</Badge>}
                    </p>
                    <p className="mt-1 flex flex-wrap gap-1">
                      {(links ?? [])
                        .filter((l) => l.tutor_id === t.id)
                        .map((l) => (
                          <Badge key={l.subject_id} tone="pervinca">
                            {name.get(l.subject_id)}
                          </Badge>
                        ))}
                      {t.modes.includes("online") && <Badge>online</Badge>}
                    </p>
                  </div>
                  <ChevronRight className="size-5 text-muted transition group-hover:translate-x-0.5" />
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <Empty>Nessun tutor.</Empty>
        )}
      </Card>
      <Card className="h-fit">
        <CardHeader title="Nuovo tutor" />
        <form action={upsertTutor} className="flex flex-col gap-3 p-5">
          <div className="grid grid-cols-2 gap-2">
            <Input name="first_name" placeholder="Nome" required />
            <Input name="last_name" placeholder="Cognome" />
          </div>
          <Input name="phone" placeholder="Telefono WhatsApp" inputMode="tel" />
          <Field label="Compenso orario (€)">
            <Input name="hourly_rate" inputMode="decimal" placeholder="es. 12" />
          </Field>
          <div className="flex gap-4 text-sm">
            <label className="flex items-center gap-2">
              <input type="checkbox" name="modes" value="presenza" defaultChecked /> In presenza
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" name="modes" value="online" /> Online
            </label>
          </div>
          <Button variant="primary" className="mt-2">
            <Plus /> Crea
          </Button>
        </form>
      </Card>
    </div>
  );
}
