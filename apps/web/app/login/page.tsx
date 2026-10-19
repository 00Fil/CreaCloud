import Image from "next/image";
import { redirect } from "next/navigation";

import { Button, Card, Field, Input } from "@/components/ui";
import { sessionClient } from "@/lib/db/clients";

async function login(formData: FormData) {
  "use server";
  const db = await sessionClient();
  const { error } = await db.auth.signInWithPassword({
    email: String(formData.get("email") ?? ""),
    password: String(formData.get("password") ?? ""),
  });
  if (error) redirect("/login?errore=credenziali");
  const next = String(formData.get("next") ?? "/");
  redirect(next.startsWith("/") && !next.startsWith("//") ? next : "/");
}

const ERRORS: Record<string, string> = {
  credenziali: "Email o password non corrette.",
  non_abilitato: "Questo account non è abilitato al coordinamento.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ errore?: string; next?: string }>;
}) {
  const { errore, next } = await searchParams;
  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-10">
      <Card className="w-full max-w-sm p-7">
        <div className="mb-7 flex items-center gap-3">
          <Image
            src="/logo.png"
            alt="Logo Creattivamente"
            width={52}
            height={52}
            className="rounded-full"
          />
          <div>
            <h1 className="text-2xl leading-none">Creattivamente</h1>
            <p className="label-caps mt-1.5 text-pesca">Coordinamento</p>
          </div>
        </div>
        <form action={login} className="flex flex-col gap-4">
          <input type="hidden" name="next" value={next ?? "/"} />
          <Field label="Email">
            <Input name="email" type="email" autoComplete="email" required />
          </Field>
          <Field label="Password">
            <Input
              name="password"
              type="password"
              autoComplete="current-password"
              required
            />
          </Field>
          {errore && (
            <p role="alert" className="text-sm text-danger">
              {ERRORS[errore] ?? "Accesso non riuscito."}
            </p>
          )}
          <Button type="submit" className="mt-2 w-full">
            Entra
          </Button>
        </form>
      </Card>
    </main>
  );
}
