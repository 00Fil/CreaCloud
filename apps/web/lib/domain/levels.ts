/**
 * Livelli scolastici: il tutor indica i livelli che segue in forma libera
 * ("medie", "superiori", "3 liceo"); la classe dello studente è anch'essa libera
 * ("2 media", "4 elementare", "5 liceo classico"). Si confrontano per fascia.
 */

export type LevelBand = "elementari" | "medie" | "superiori" | "universita";

const norm = (s: string) => s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().trim();

export function levelBand(level: string): LevelBand | null {
  const s = norm(level);
  if (!s) return null;
  if (/univers|laurea/.test(s)) return "universita";
  if (/element|primaria/.test(s)) return "elementari";
  if (/\bmedi[ae]\b|primo grado/.test(s)) return "medie";
  if (/liceo|superior|istituto|tecnic|profession|itis|ipsia|secondo grado/.test(s)) return "superiori";
  return null;
}

/** Il tutor segue lo studente? Nessun livello indicato = tutti. */
export function tutorCoversLevel(tutorLevels: string[], studentLevel: string): boolean {
  if (!tutorLevels.length || !studentLevel.trim()) return true;
  const s = norm(studentLevel);
  const band = levelBand(studentLevel);
  return tutorLevels.some((t) => {
    const n = norm(t);
    if (!n) return false;
    if (n === s || s.includes(n)) return true;
    return band !== null && levelBand(t) === band;
  });
}
