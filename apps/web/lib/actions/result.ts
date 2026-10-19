/** Risultato di un'azione server, condiviso tra server e client. */

export type FieldErrors = Record<string, string>;

export type ActionResult<T = null> =
  | { ok: true; data: T }
  | { ok: false; error: string; fieldErrors?: FieldErrors };
