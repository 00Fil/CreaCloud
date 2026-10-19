import { GraduationCap, MessageCircle, Plus, UserRound } from "lucide-react";
import { redirect } from "next/navigation";

import { createFamily, upsertTutor } from "@/app/(app)/actions/people";
import { FamilyEntry, TutorEntry } from "@/components/entries/people";
import { DataTable, type Row } from "@/components/kit/data-table";
import { Sheet } from "@/components/kit/sheet";
import { Tabs } from "@/components/kit/tabs";
import { Badge, PageHeader } from "@/components/ui";
import { monthStatements } from "@/lib/billing/load";
import { sessionClient } from "@/lib/db/clients";
import { formatEuro, formatHours } from "@/lib/domain/billing";
import {
  monthLabel,
  monthStart,
  todayRome,
  WEEKDAYS_SHORT,
} from "@/lib/domain/time";

type Search = {
  tab?: string;
  nuova?: string;
  genitore?: string;
  studente?: string;
};

export default async function PeoplePage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  const sp = await searchParams;
  const db = await sessionClient();
  // collegamenti diretti dalle chat
  if (sp.genitore || sp.studente) {
    const { data } = await db
      .from(sp.genitore ? "parents" : "students")
      .select("family_id")
      .eq("id", (sp.genitore ?? sp.studente)!)
      .maybeSingle();
    if (data) redirect(`/persone/famiglia/${data.family_id}`);
  }
  const month = monthStart(todayRome());

  const [
    statements,
    { data: parents },
    { data: students },
    { data: chats },
    { data: links },
    { data: subjects },
    { data: reqLinks },
    { data: constraints },
    { data: availability },
  ] = await Promise.all([
    monthStatements(db, month),
    db
      .from("parents")
      .select("id, family_id, first_name, last_name, phone, is_primary"),
    db
      .from("students")
      .select(
        "id, family_id, first_name, last_name, school_level, phone, active",
      ),
    db.from("chats").select("id, parent_id, student_id, tutor_id"),
    db.from("tutor_subjects").select("tutor_id, subject_id"),
    db.from("subjects").select("id, name"),
    db
      .from("lesson_request_students")
      .select("student_id, lesson_requests(status, sessions_per_week, kind)"),
    db.from("student_constraints").select("student_id, priority_confirmed"),
    db
      .from("tutor_availability")
      .select("tutor_id, weekday, start_min, end_min"),
  ]);
  const { data: tutorRows } = await db
    .from("tutors")
    .select("id, first_name, last_name, phone, modes, active")
    .order("last_name");

  const chatOf = new Map<string, string>();
  for (const c of chats ?? [])
    for (const k of [c.parent_id, c.student_id, c.tutor_id])
      if (k) chatOf.set(k, c.id);
  const subjectName = new Map(
    (subjects ?? []).map((s) => [s.id, s.name as string]),
  );
  const perWeek = new Map<string, number>();
  for (const l of reqLinks ?? []) {
    const r = l.lesson_requests as unknown as {
      status: string;
      sessions_per_week: number;
      kind: string;
    } | null;
    if (r?.status === "attiva" && r.kind === "ricorrente")
      perWeek.set(
        l.student_id,
        (perWeek.get(l.student_id) ?? 0) + r.sessions_per_week,
      );
  }
  const toConfirm = new Set(
    (constraints ?? [])
      .filter((c) => !c.priority_confirmed)
      .map((c) => c.student_id),
  );

  // ------------------------------------------------------------ famiglie
  const familyRows: Row[] = statements.families
    .filter((f) => f.family.active)
    .map(({ family, statement }) => {
      const ps = (parents ?? [])
        .filter((p) => p.family_id === family.id)
        .sort((a, b) => Number(b.is_primary) - Number(a.is_primary));
      const ss = (students ?? []).filter(
        (s) => s.family_id === family.id && s.active,
      );
      const weekly = ss.reduce((a, s) => a + (perWeek.get(s.id) ?? 0), 0);
      const due = Math.max(0, statement.saldo);
      const pending = ss.some((s) => toConfirm.has(s.id));
      const status = pending
        ? "da_confermare"
        : due > 0
          ? "da_saldare"
          : weekly === 0
            ? "senza_lezioni"
            : "ok";
      const kids = (
        <span className="flex flex-wrap gap-1.5">
          {ss.map((s) => (
            <Badge key={s.id} tone="pesca">
              <GraduationCap aria-hidden="true" className="size-3" />
              {s.first_name}
              {s.school_level && (
                <span className="font-normal opacity-80">
                  · {s.school_level}
                </span>
              )}
            </Badge>
          ))}
          {!ss.length && <span className="text-muted">nessuno</span>}
        </span>
      );
      const parentLine = ps.length
        ? ps.map((p) => `${p.first_name} ${p.last_name}`.trim()).join(", ")
        : "Nessun genitore";
      const whatsapp =
        ps.some((p) => chatOf.has(p.id)) || ss.some((s) => chatOf.has(s.id));
      return {
        id: family.id,
        href: `/persone/famiglia/${family.id}`,
        search: [
          family.name,
          parentLine,
          ...ss.map((s) => `${s.first_name} ${s.last_name}`),
          ...ps.map((p) => p.phone ?? ""),
        ].join(" "),
        filter: status,
        sort: { name: family.name, kids: ss.length, weekly, due },
        cells: {
          name: (
            <span className="flex flex-col">
              <span>{family.name}</span>
              <span className="text-xs font-normal text-muted">
                {parentLine}
              </span>
            </span>
          ),
          kids,
          weekly: weekly ? (
            `${weekly} a sett.`
          ) : (
            <span className="text-muted">—</span>
          ),
          whatsapp: whatsapp ? (
            <Badge tone="ok">
              <MessageCircle aria-hidden="true" className="size-3" /> attiva
            </Badge>
          ) : (
            <span className="text-xs text-muted">mai scritto</span>
          ),
          due: due ? (
            <span className="font-semibold text-pesca-deep dark:text-pesca">
              {formatEuro(due)}
            </span>
          ) : (
            <span className="text-muted">—</span>
          ),
          status: pending ? (
            <Badge tone="warn">impegni da confermare</Badge>
          ) : null,
        },
        mobile: (
          <span className="flex flex-col gap-1.5">
            <span className="flex items-center gap-2">
              <span className="font-serif text-lg leading-tight">
                {family.name}
              </span>
              {pending && <Badge tone="warn">da confermare</Badge>}
              {due > 0 && (
                <span className="ml-auto text-sm font-semibold text-pesca-deep">
                  {formatEuro(due)}
                </span>
              )}
            </span>
            <span className="text-xs text-muted">{parentLine}</span>
            {kids}
          </span>
        ),
      };
    });

  // ------------------------------------------------------------ tutor
  const tutorStats = new Map(
    statements.tutors.map((t) => [t.tutor.id, t.statement]),
  );
  const tutorRowsView: Row[] = (tutorRows ?? []).map((t) => {
    const subs = (links ?? [])
      .filter((l) => l.tutor_id === t.id)
      .map((l) => subjectName.get(l.subject_id) ?? "");
    const av = (availability ?? []).filter((a) => a.tutor_id === t.id);
    const weekMin = av.reduce((a, w) => a + (w.end_min - w.start_min), 0);
    const days = [...new Set(av.map((a) => a.weekday))]
      .sort()
      .map((d) => WEEKDAYS_SHORT[d])
      .join(" ");
    const st = tutorStats.get(t.id);
    const due = Math.max(0, st?.residuo ?? 0);
    const name = `${t.first_name} ${t.last_name}`.trim();
    return {
      id: t.id,
      href: `/persone/tutor/${t.id}`,
      search: `${name} ${subs.join(" ")} ${t.phone ?? ""}`,
      filter: t.active
        ? av.length
          ? "attivi"
          : "senza_disponibilita"
        : "non_attivi",
      sort: {
        name: t.last_name || t.first_name,
        avail: weekMin,
        hours: st?.maturato.minutes ?? 0,
        due,
      },
      cells: {
        name: (
          <span className="flex items-center gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-pesca/20 font-serif text-pesca-deep">
              {t.first_name[0]}
            </span>
            <span className="flex flex-col">
              <span>{name}</span>
              <span className="text-xs font-normal text-muted">
                {t.modes.join(" e ")}
              </span>
            </span>
          </span>
        ),
        subjects: (
          <span className="flex flex-wrap gap-1">
            {subs.map((s) => (
              <Badge key={s} tone="pervinca">
                {s}
              </Badge>
            ))}
            {!subs.length && <span className="text-muted">—</span>}
          </span>
        ),
        avail: weekMin ? (
          <span className="flex flex-col">
            <span>{formatHours(weekMin)}</span>
            <span className="text-xs text-muted">{days}</span>
          </span>
        ) : (
          <Badge tone="warn">da inserire</Badge>
        ),
        hours: st ? formatHours(st.maturato.minutes) : "—",
        due: due ? (
          <span className="font-semibold">{formatEuro(due)}</span>
        ) : (
          <span className="text-muted">—</span>
        ),
        status: !t.active ? <Badge>non attivo</Badge> : null,
      },
      mobile: (
        <span className="flex flex-col gap-1.5">
          <span className="flex items-center gap-2">
            <span className="font-serif text-lg leading-tight">{name}</span>
            {!t.active && <Badge>non attivo</Badge>}
            {due > 0 && (
              <span className="ml-auto text-sm font-semibold">
                {formatEuro(due)}
              </span>
            )}
          </span>
          <span className="flex flex-wrap gap-1">
            {subs.map((s) => (
              <Badge key={s} tone="pervinca">
                {s}
              </Badge>
            ))}
          </span>
          <span className="text-xs text-muted">
            {weekMin
              ? `${formatHours(weekMin)} disponibili · ${days}`
              : "Disponibilità da inserire"}
          </span>
        </span>
      ),
    };
  });

  const newFamily = (
    <Sheet
      variant="primary"
      defaultOpen={sp.nuova === "famiglia"}
      trigger={
        <>
          <Plus aria-hidden="true" /> Nuova famiglia
        </>
      }
      title="Nuova famiglia"
      description="Basta il nome della famiglia: genitore e figlio si possono aggiungere anche dopo."
    >
      <FamilyEntry action={createFamily} />
    </Sheet>
  );
  const newTutor = (
    <Sheet
      variant="primary"
      defaultOpen={sp.nuova === "tutor"}
      trigger={
        <>
          <Plus aria-hidden="true" /> Nuovo tutor
        </>
      }
      title="Nuovo tutor"
      description="Dopo la creazione si aprono la sua scheda, le materie e la disponibilità."
    >
      <TutorEntry action={upsertTutor} />
    </Sheet>
  );

  return (
    <>
      <PageHeader eyebrow="Anagrafiche" title="Persone">
        {familyRows.length} famiglie e{" "}
        {tutorRowsView.filter((t) => t.filter !== "non_attivi").length} tutor
        attivi. Importi di {monthLabel(month)}.
      </PageHeader>
      <Tabs
        initial={sp.tab}
        items={[
          {
            id: "famiglie",
            label: "Famiglie",
            icon: <UserRound aria-hidden="true" className="size-4" />,
            badge: familyRows.length,
            content: (
              <DataTable
                placeholder="Cerca famiglia, genitore, figlio o telefono"
                toolbar={newFamily}
                rows={familyRows}
                initialSort={{ key: "name", dir: 1 }}
                filters={[
                  { value: "da_confermare", label: "Impegni da confermare" },
                  { value: "da_saldare", label: "Da saldare" },
                  { value: "senza_lezioni", label: "Senza lezioni" },
                ]}
                columns={[
                  { key: "name", header: "Famiglia", sortable: true },
                  { key: "kids", header: "Figli" },
                  { key: "weekly", header: "Lezioni", sortable: true },
                  { key: "whatsapp", header: "WhatsApp" },
                  {
                    key: "due",
                    header: "Da saldare",
                    align: "right",
                    sortable: true,
                  },
                  { key: "status", header: "" },
                ]}
                empty="Nessuna famiglia corrisponde alla ricerca."
              />
            ),
          },
          {
            id: "tutor",
            label: "Tutor",
            icon: <GraduationCap aria-hidden="true" className="size-4" />,
            badge: tutorRowsView.length,
            content: (
              <DataTable
                placeholder="Cerca tutor o materia"
                toolbar={newTutor}
                rows={tutorRowsView}
                initialSort={{ key: "name", dir: 1 }}
                filters={[
                  { value: "attivi", label: "Attivi" },
                  {
                    value: "senza_disponibilita",
                    label: "Senza disponibilità",
                  },
                  { value: "non_attivi", label: "Non attivi" },
                ]}
                columns={[
                  { key: "name", header: "Tutor", sortable: true },
                  { key: "subjects", header: "Materie" },
                  { key: "avail", header: "Disponibilità", sortable: true },
                  {
                    key: "hours",
                    header: "Ore nel mese",
                    align: "right",
                    sortable: true,
                  },
                  {
                    key: "due",
                    header: "Da pagare",
                    align: "right",
                    sortable: true,
                  },
                  { key: "status", header: "" },
                ]}
                empty="Nessun tutor corrisponde alla ricerca."
              />
            ),
          },
        ]}
      />
    </>
  );
}
