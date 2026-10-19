"use client";

import { Eye, EyeOff } from "lucide-react";
import { useActionState, useState } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from "@/components/ui/input-group";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";

import { login, type LoginState } from "./actions";

export function LoginForm({ next, initialError }: { next: string; initialError: string | null }) {
  const [state, formAction, pending] = useActionState<LoginState, FormData>(login, { error: initialError, email: "" });
  const [show, setShow] = useState(false);
  return (
    <form action={formAction} className="grid gap-5">
      <input type="hidden" name="next" value={next} />
      <div className="grid gap-2">
        <Label htmlFor="email">Email</Label>
        <Input id="email" name="email" type="email" autoComplete="email" defaultValue={state.email} required autoFocus />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="password">Password</Label>
        <InputGroup>
          <InputGroupInput id="password" name="password" type={show ? "text" : "password"} autoComplete="current-password" required />
          <InputGroupAddon align="inline-end">
            <InputGroupButton size="icon-xs" onClick={() => setShow((s) => !s)} aria-label={show ? "Nascondi password" : "Mostra password"}>
              {show ? <EyeOff /> : <Eye />}
            </InputGroupButton>
          </InputGroupAddon>
        </InputGroup>
      </div>
      {state.error ? (
        <Alert variant="destructive" role="alert">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      ) : null}
      <Button type="submit" size="lg" disabled={pending} className="mt-1 w-full">
        {pending ? <Spinner /> : null}
        Entra
      </Button>
    </form>
  );
}
