import type { Metadata } from "next";
import Image from "next/image";

import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Accesso" };

const ERRORS: Record<string, string> = {
  credenziali: "Email o password non corrette.",
  non_abilitato: "Questo account non è abilitato al coordinamento.",
};

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ errore?: string; next?: string }> }) {
  const { errore, next } = await searchParams;
  return (
    <main className="grid min-h-dvh lg:grid-cols-[1.1fr_1fr]">
      <section className="chat-wallpaper relative hidden flex-col justify-between overflow-hidden p-12 lg:flex" aria-hidden>
        <div className="flex items-center gap-3">
          <Image src="/logo.png" alt="" width={44} height={44} className="rounded-full" priority />
          <span className="font-heading text-xl">Creattivamente</span>
        </div>
        <div className="max-w-md space-y-4">
          <p className="font-heading text-4xl leading-tight text-balance">
            Lezioni, famiglie e WhatsApp del centro, in un unico posto.
          </p>
          <p className="text-muted-foreground">
            L’assistente risponde e organizza; tu controlli, approvi e intervieni quando serve.
          </p>
        </div>
        <p className="label-caps text-pesca-strong">Coordinamento</p>
      </section>
      <section className="flex items-center justify-center px-5 py-12">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <Image src="/logo.png" alt="Logo Creattivamente" width={48} height={48} className="rounded-full" priority />
            <div>
              <p className="font-heading text-2xl leading-none">Creattivamente</p>
              <p className="label-caps mt-1.5 text-pesca-strong">Coordinamento</p>
            </div>
          </div>
          <h1 className="font-heading text-3xl">Bentornato</h1>
          <p className="mt-1.5 mb-8 text-muted-foreground">Accedi con l’account del centro.</p>
          <LoginForm next={next ?? "/"} initialError={errore ? (ERRORS[errore] ?? "Accesso non riuscito.") : null} />
        </div>
      </section>
    </main>
  );
}
