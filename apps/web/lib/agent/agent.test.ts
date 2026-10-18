import { beforeEach, describe, expect, it } from "vitest";

import type { LlmProvider, LlmRequest } from "@/lib/ai/llm";

import { safeFreeText } from "./decide";
import { MemoryRepo } from "./memory-repo";
import { handleInbound, type AgentDeps } from "./pipeline";
import { quickYesNo, resolveDate } from "./resolve";
import type { Interpretation } from "./schema";
import type { LessonInfo, OutboundChannel } from "./types";

// lunedì 19 ottobre 2026, 10:00 a Roma
const NOW = new Date("2026-10-19T08:00:00Z");

function interp(over: Partial<Interpretation>): Interpretation {
  return {
    intento: "altro",
    confidenza: 0.95,
    studente_ref: null,
    lezione_ref: null,
    vincolo_ref: null,
    domanda: null,
    vincolo: null,
    disponibilita: null,
    assenza: null,
    richiesta_lezioni: null,
    modifica_lezioni: null,
    spostamento: null,
    annullamento: null,
    trascrizione: null,
    risposta: "",
    ...over,
  };
}

class ScriptedProvider implements LlmProvider {
  readonly name = "fake";
  readonly supportsAudio = false;
  calls: LlmRequest[] = [];
  constructor(private readonly answers: Interpretation[]) {}
  async generate(req: LlmRequest) {
    this.calls.push(req);
    const json = this.answers.shift();
    if (!json) throw new Error("nessuna risposta preparata");
    return { json, raw: JSON.stringify(json), model: req.model, usage: { inputTokens: 6000, cachedInputTokens: 0, outputTokens: 300, audioInputTokens: 0 } };
  }
}

class FakeChannel implements OutboundChannel {
  readonly provider = "test";
  sent: { phone: string; text: string }[] = [];
  async send(phone: string, text: string) {
    this.sent.push({ phone, text });
    return { providerMessageId: `w${this.sent.length}` };
  }
}

let repo: MemoryRepo;
let channel: FakeChannel;

function setup(fast: Interpretation[], smart: Interpretation[] = []) {
  const f = new ScriptedProvider(fast);
  const s = new ScriptedProvider(smart);
  const deps: AgentDeps = {
    repo,
    channel,
    fast: { provider: f, model: "gemini-3.1-flash-lite" },
    smart: { provider: s, model: "gemini-3-flash" },
    now: () => NOW,
  };
  return { deps, f, s };
}

function lesson(over: Partial<LessonInfo>): LessonInfo {
  return {
    id: "les1",
    date: "2026-10-21",
    start_min: 17 * 60,
    end_min: 18 * 60,
    status: "programmata",
    mode: "presenza",
    subject: "Matematica",
    tutor_id: "t1",
    tutor_name: "Rossi",
    student_ids: ["luca"],
    student_names: ["Luca"],
    request_id: "req1",
    ...over,
  };
}

beforeEach(() => {
  repo = new MemoryRepo();
  channel = new FakeChannel();
  repo.parents.push({ id: "p1", family_id: "f1", first_name: "Anna", last_name: "Bianchi" });
  repo.students.push(
    { id: "luca", family_id: "f1", first_name: "Luca", last_name: "Bianchi", school_level: "2 media" },
    { id: "sara", family_id: "f1", first_name: "Sara", last_name: "Bianchi", school_level: "4 elementare" },
  );
  repo.tutors.push({ id: "t1", first_name: "Marco", last_name: "Rossi" });
  repo.subjectList.push({ id: "mat", name: "Matematica" }, { id: "ing", name: "Inglese" });
});

const sportInterp = () =>
  interp({
    intento: "nuovo_vincolo",
    studente_ref: "S1",
    vincolo: {
      ricorrenza: "settimanale",
      giorni_settimana: [1],
      data: null,
      dalle: "17:00",
      alle: "18:30",
      categoria: "sport",
      descrizione: "allenamento di calcio",
      priorita_proposta: 1,
      fino_al: null,
    },
  });

describe("vincoli", () => {
  it("chiede conferma, poi registra con priorità limitata alla categoria", async () => {
    const chat = repo.addChat({ phone: "+39333", parent_id: "p1" });
    const { deps, f, s } = setup([sportInterp()], [sportInterp()]);
    const out = await handleInbound(deps, chat.id, repo.receive(chat.id, "Luca il martedì ha calcio dalle 17 alle 18 e mezza"));
    expect(out.status).toBe("risposto");
    expect(channel.sent[0].text).toContain("Luca: allenamento di calcio, ogni martedì, 17:00–18:30");
    expect(channel.sent[0].text).toContain("Confermi?");
    expect(f.calls).toHaveLength(1);
    expect(s.calls).toHaveLength(1); // i vincoli passano dal modello più capace

    const events = repo.aiEvents.length;
    await handleInbound(deps, chat.id, repo.receive(chat.id, "sì"));
    expect(repo.aiEvents.length).toBe(events); // il "sì" non costa nulla
    expect(repo.applied).toEqual([
      expect.objectContaining({ type: "aggiungi_vincolo", studentId: "luca", priority: 2, weekdays: [1], startMin: 1020, endMin: 1110 }),
    ]);
    expect(channel.sent[1].text).toContain("Registrato");
  });

  it("chiede di cosa si tratta se la categoria manca", async () => {
    const chat = repo.addChat({ phone: "+39333", parent_id: "p1" });
    const unknown = sportInterp();
    unknown.vincolo!.categoria = "sconosciuta";
    const { deps } = setup([unknown], [unknown]);
    await handleInbound(deps, chat.id, repo.receive(chat.id, "Luca il martedì dalle 17 non può"));
    expect(channel.sent[0].text).toContain("Di che impegno si tratta per Luca?");
    expect(repo.chats.get(chat.id)!.state.awaiting).toBeDefined();
    expect(repo.applied).toEqual([]);
  });

  it("segnala al coordinatore le lezioni in conflitto", async () => {
    repo.lessonList.push(lesson({ date: "2026-10-20" }));
    const chat = repo.addChat({ phone: "+39333", parent_id: "p1" });
    const { deps } = setup([sportInterp()], [sportInterp()]);
    await handleInbound(deps, chat.id, repo.receive(chat.id, "..."));
    expect(channel.sent[0].text).toContain("Si sovrappone");
    await handleInbound(deps, chat.id, repo.receive(chat.id, "ok"));
    expect(repo.pendingActions.map((p) => p.kind)).toEqual(["conflitto_vincolo"]);
  });
});

describe("annullamenti", () => {
  it("con più di 24 ore: annullata senza addebito dopo conferma", async () => {
    repo.lessonList.push(lesson({ date: "2026-10-21" }));
    const chat = repo.addChat({ phone: "+39333", parent_id: "p1" });
    const { deps } = setup([interp({ intento: "annulla_lezione", studente_ref: "S1", lezione_ref: "L1", annullamento: { motivo: "gita" } })]);
    await handleInbound(deps, chat.id, repo.receive(chat.id, "mercoledì Luca non viene"));
    expect(channel.sent[0].text).toContain("non viene addebitata");
    await handleInbound(deps, chat.id, repo.receive(chat.id, "Si"));
    expect(repo.applied[0]).toMatchObject({ type: "annulla_lezione", status: "annullata_in_tempo" });
    expect(repo.pendingActions).toEqual([]);
  });

  it("con meno di 24 ore: avvisa dell'addebito e segnala al coordinatore", async () => {
    repo.lessonList.push(lesson({ date: "2026-10-19", start_min: 17 * 60 }));
    const chat = repo.addChat({ phone: "+39333", parent_id: "p1" });
    const { deps } = setup([interp({ intento: "annulla_lezione", studente_ref: "S1", lezione_ref: "L1", annullamento: { motivo: "febbre" } })]);
    await handleInbound(deps, chat.id, repo.receive(chat.id, "oggi Luca ha la febbre"));
    expect(channel.sent[0].text).toContain("meno di 24 ore");
    await handleInbound(deps, chat.id, repo.receive(chat.id, "si"));
    expect(repo.applied[0]).toMatchObject({ status: "annullata_tardiva" });
    expect(repo.pendingActions[0]).toMatchObject({ kind: "annullamento_tardivo", reason: "febbre" });
  });

  it("un riferimento inventato non passa: chiede quale lezione", async () => {
    repo.lessonList.push(lesson({ id: "a", date: "2026-10-21" }), lesson({ id: "b", date: "2026-10-23", subject: "Inglese" }));
    const chat = repo.addChat({ phone: "+39333", parent_id: "p1" });
    const { deps } = setup([interp({ intento: "annulla_lezione", studente_ref: "S1", lezione_ref: "L99" })]);
    await handleInbound(deps, chat.id, repo.receive(chat.id, "annulla la lezione"));
    expect(channel.sent[0].text).toContain("Quale lezione intendi?");
    expect(repo.chats.get(chat.id)!.state.pending).toBeUndefined();
  });

  it("il no annulla la conferma in sospeso", async () => {
    repo.lessonList.push(lesson({}));
    const chat = repo.addChat({ phone: "+39333", parent_id: "p1" });
    const { deps } = setup([interp({ intento: "annulla_lezione", studente_ref: "S1", lezione_ref: "L1" })]);
    await handleInbound(deps, chat.id, repo.receive(chat.id, "annulla"));
    await handleInbound(deps, chat.id, repo.receive(chat.id, "no"));
    expect(repo.applied).toEqual([]);
    expect(repo.chats.get(chat.id)!.state.pending).toBeUndefined();
  });
});

describe("tutor", () => {
  it("assenza con lezioni da ricollocare", async () => {
    repo.lessonList.push(lesson({ date: "2026-10-22" }));
    const chat = repo.addChat({ phone: "+39444", tutor_id: "t1" });
    const { deps } = setup([
      interp({
        intento: "assenza_tutor",
        assenza: {
          dal: { tipo: "data", data: "2026-10-22", giorni: null, giorno_settimana: null, settimana_prossima: null },
          al: null,
          dalle: null,
          alle: null,
          motivo: "visita",
        },
      }),
    ]);
    await handleInbound(deps, chat.id, repo.receive(chat.id, "giovedì non ci sono"));
    expect(channel.sent[0].text).toContain("assenza il gio 22/10, tutto il giorno");
    await handleInbound(deps, chat.id, repo.receive(chat.id, "confermo"));
    expect(repo.applied[0]).toMatchObject({ type: "assenza_tutor", from: "2026-10-22", to: "2026-10-22" });
    expect(repo.pendingActions[0].kind).toBe("lezioni_da_ricollocare");
  });
});

describe("controlli", () => {
  it("chat manuale: nessuna chiamata al modello", async () => {
    const chat = repo.addChat({ phone: "+39333", parent_id: "p1", mode: "manuale" });
    const { deps, f } = setup([]);
    const out = await handleInbound(deps, chat.id, repo.receive(chat.id, "ciao"));
    expect(out.status).toBe("ignorato");
    expect(f.calls).toHaveLength(0);
    expect(repo.chats.get(chat.id)!.needs_attention).toBe(true);
  });

  it("tetto di spesa raggiunto: solo bozza, nulla inviato", async () => {
    repo.spentMicroUsd = 20_000_000;
    const chat = repo.addChat({ phone: "+39333", parent_id: "p1" });
    const { deps } = setup([interp({ intento: "saluto", risposta: "Ciao Anna!" })]);
    const out = await handleInbound(deps, chat.id, repo.receive(chat.id, "ciao"));
    expect(out.status).toBe("bozza");
    expect(channel.sent).toEqual([]);
    expect(repo.messages.at(-1)).toMatchObject({ status: "bozza", body: "Ciao Anna!" });
  });

  it("bassa confidenza: passa al secondo livello", async () => {
    const chat = repo.addChat({ phone: "+39333", parent_id: "p1" });
    const { deps, s } = setup(
      [interp({ intento: "saluto", confidenza: 0.4 })],
      [interp({ intento: "info_lezioni", confidenza: 0.9 })],
    );
    await handleInbound(deps, chat.id, repo.receive(chat.id, "quando ha lezione?"));
    expect(s.calls).toHaveLength(1);
    expect(channel.sent[0].text).toContain("non risultano lezioni");
  });

  it("numero sconosciuto: risponde una volta, senza modello", async () => {
    const chat = repo.addChat({ phone: "+39999" });
    const { deps, f } = setup([]);
    await handleInbound(deps, chat.id, repo.receive(chat.id, "buongiorno"));
    await handleInbound(deps, chat.id, repo.receive(chat.id, "?"));
    expect(channel.sent).toHaveLength(1);
    expect(f.calls).toHaveLength(0);
  });

  it("presa in carico: l'AI non risponde", async () => {
    const chat = repo.addChat({ phone: "+39333", parent_id: "p1", takeover_until: "2026-10-19T12:00:00Z" });
    const { deps } = setup([]);
    expect((await handleInbound(deps, chat.id, repo.receive(chat.id, "ciao"))).status).toBe("ignorato");
  });

  it("testo libero con numeri o importi non viene inviato", () => {
    expect(safeFreeText("La lezione costa 20 euro", "x")).toBe("x");
    expect(safeFreeText("Ci vediamo alle 17", "x")).toBe("x");
    expect(safeFreeText("Buona giornata!", "x")).toBe("Buona giornata!");
  });
});

describe("risoluzione", () => {
  it("date", () => {
    const today = "2026-10-19"; // lunedì
    expect(resolveDate({ tipo: "tra_giorni", giorni: 1, data: null, giorno_settimana: null, settimana_prossima: null }, today)).toBe("2026-10-20");
    expect(resolveDate({ tipo: "giorno_settimana", giorno_settimana: 3, data: null, giorni: null, settimana_prossima: null }, today)).toBe("2026-10-22");
    expect(resolveDate({ tipo: "giorno_settimana", giorno_settimana: 1, data: null, giorni: null, settimana_prossima: true }, today)).toBe("2026-10-27");
    expect(resolveDate({ tipo: "data", data: "2031-01-01", giorni: null, giorno_settimana: null, settimana_prossima: null }, today)).toBeNull();
  });
  it("sì/no", () => {
    expect(quickYesNo("Sì!")).toBe("si");
    expect(quickYesNo("va bene grazie")).toBe("si");
    expect(quickYesNo("no")).toBe("no");
    expect(quickYesNo("sì però alle 18")).toBeNull();
    expect(quickYesNo("Ok, grazie!")).toBe("si");
    expect(quickYesNo("No grazie")).toBe("no");
    expect(quickYesNo("forse")).toBeNull();
  });
});
