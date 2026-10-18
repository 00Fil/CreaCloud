export function roleOf(c: { parent_id: string | null; student_id: string | null; tutor_id: string | null }) {
  if (c.parent_id) return "Genitore";
  if (c.student_id) return "Studente";
  if (c.tutor_id) return "Tutor";
  return "Sconosciuto";
}
