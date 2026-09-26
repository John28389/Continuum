"use server";

import { redirect } from "next/navigation";

import { ptBR } from "@/lib/i18n/pt-BR";
import { createClient } from "@/lib/supabase/server";
import { safeRedirectPath, signInSchema } from "@/lib/validation/auth";

export interface SignInState {
  readonly error?: string;
}

/**
 * Sign in with email and password.
 *
 * Password rather than a magic link because this is a daily-use tool, and a
 * mail round-trip on every sign-in is exactly the kind of friction the product
 * exists to remove.
 *
 * There is deliberately no sign-up action. The deployment is single-user, and
 * registration is disabled in the Supabase project itself, so the absence here
 * is the second layer rather than the only one.
 */
export async function signIn(_previous: SignInState, formData: FormData): Promise<SignInState> {
  const parsed = signInSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    next: formData.get("next") ?? undefined,
  });

  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const field = issue?.path[0];

    if (field === "email") {
      return {
        error: issue?.message === "required" ? ptBR.auth.emailRequired : ptBR.auth.emailInvalid,
      };
    }
    return { error: ptBR.auth.passwordRequired };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });

  if (error) {
    // One message for every failure. Distinguishing "no such account" from
    // "wrong password" would let anyone enumerate which addresses are
    // registered.
    return { error: ptBR.auth.invalidCredentials };
  }

  redirect(safeRedirectPath(parsed.data.next));
}
