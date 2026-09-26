"use client";

import { useActionState } from "react";

import { signIn, type SignInState } from "./actions";
import { ptBR } from "@/lib/i18n/pt-BR";

const initialState: SignInState = {};

export function LoginForm({ next }: { next?: string }) {
  const [state, formAction, pending] = useActionState(signIn, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-5" noValidate>
      {next ? <input type="hidden" name="next" value={next} /> : null}

      <div className="flex flex-col gap-2">
        <label htmlFor="email" className="text-sm font-medium">
          {ptBR.auth.email}
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          autoFocus
          required
          aria-describedby={state.error ? "signin-error" : undefined}
          className="rounded-[--radius-base] border border-border-strong bg-surface-raised px-3 py-2 text-base outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="password" className="text-sm font-medium">
          {ptBR.auth.password}
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          aria-describedby={state.error ? "signin-error" : undefined}
          className="rounded-[--radius-base] border border-border-strong bg-surface-raised px-3 py-2 text-base outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </div>

      {state.error ? (
        <p id="signin-error" role="alert" className="text-sm text-danger">
          {state.error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="rounded-[--radius-base] bg-mission px-4 py-2.5 text-sm font-medium text-mission-foreground transition-opacity disabled:opacity-60"
      >
        {pending ? ptBR.auth.signingIn : ptBR.auth.signIn}
      </button>
    </form>
  );
}
