"use client";

import Link from "next/link";
import { useActionState } from "react";
import { signIn, signUp } from "@/app/actions/auth";
import { t } from "@/i18n";

export function LoginForm() {
  const [state, action, pending] = useActionState(signIn, undefined);

  return (
    <form action={action} className="space-y-4">
      <h2 className="font-serif text-xl font-semibold">{t.auth.signIn}</h2>
      <div>
        <label className="label" htmlFor="email">{t.auth.email}</label>
        <input className="input" id="email" name="email" type="email" autoComplete="email" required />
      </div>
      <div>
        <label className="label" htmlFor="password">{t.auth.password}</label>
        <input className="input" id="password" name="password" type="password" autoComplete="current-password" required />
      </div>
      {state?.error && <p className="text-sm text-red-700">{state.error}</p>}
      <button className="btn-primary w-full" disabled={pending}>
        {pending ? t.common.loading : t.auth.signIn}
      </button>
      <p className="text-center text-sm text-muted">
        {t.auth.noAccount}{" "}
        <Link href="/signup" className="font-medium text-accent hover:underline">{t.auth.signUp}</Link>
      </p>
    </form>
  );
}

export function SignupForm({ invite, familyName }: { invite?: string; familyName?: string }) {
  const [state, action, pending] = useActionState(signUp, undefined);

  if (state?.message) {
    return <p className="text-sm">{state.message}</p>;
  }

  return (
    <form action={action} className="space-y-4">
      <h2 className="font-serif text-xl font-semibold">{t.auth.signUp}</h2>
      {familyName && (
        <p className="rounded-lg bg-cream p-3 text-sm">
          {t.auth.invitedTo} <strong>{familyName}</strong>
        </p>
      )}
      {invite && <input type="hidden" name="invite" value={invite} />}
      <div>
        <label className="label" htmlFor="display_name">{t.auth.displayName}</label>
        <input className="input" id="display_name" name="display_name" autoComplete="given-name" required />
      </div>
      {!invite && (
        <div>
          <label className="label" htmlFor="family_name">{t.auth.familyName}</label>
          <input className="input" id="family_name" name="family_name" placeholder={t.auth.familyNameDefault} />
        </div>
      )}
      <div>
        <label className="label" htmlFor="email">{t.auth.email}</label>
        <input className="input" id="email" name="email" type="email" autoComplete="email" required />
      </div>
      <div>
        <label className="label" htmlFor="password">{t.auth.password}</label>
        <input className="input" id="password" name="password" type="password" autoComplete="new-password" minLength={8} required />
      </div>
      {state?.error && <p className="text-sm text-red-700">{state.error}</p>}
      <button className="btn-primary w-full" disabled={pending}>
        {pending ? t.common.loading : t.auth.signUp}
      </button>
      <p className="text-center text-sm text-muted">
        {t.auth.haveAccount}{" "}
        <Link href="/login" className="font-medium text-accent hover:underline">{t.auth.signIn}</Link>
      </p>
    </form>
  );
}
