import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { SignupForm } from "@/components/auth-forms";
import { createClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/data";
import { getI18n } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.auth.signUp };
}

export default async function SignupPage({ searchParams }: PageProps<"/[lang]/signup">) {
  const { t } = await getI18n();
  return (
    <Suspense fallback={<p className="text-sm text-muted">{t.common.loading}</p>}>
      <Signup searchParams={searchParams} />
    </Suspense>
  );
}

async function Signup({ searchParams }: Pick<PageProps<"/[lang]/signup">, "searchParams">) {
  const { t } = await getI18n();
  const { invite } = await searchParams;
  const supabase = await createClient();

  if (typeof invite === "string" && invite) {
    const { data } = isUuid(invite)
      ? await supabase.rpc("get_invite", { p_token: invite })
      : { data: null };
    const familyName: string | undefined = data?.[0]?.family_name;
    if (!familyName) {
      return <Message text={t.auth.invalidInvite} />;
    }
    return <SignupForm invite={invite} familyName={familyName} />;
  }

  const { data: mode } = await supabase.rpc("get_signup_mode");
  if (mode !== "open") {
    return <Message text={t.auth.signupDisabled} />;
  }
  return <SignupForm />;
}

async function Message({ text }: { text: string }) {
  const { t } = await getI18n();
  return (
    <div className="space-y-4 text-sm">
      <p>{text}</p>
      <Link href="/login" className="font-medium text-accent hover:underline">{t.auth.signIn}</Link>
    </div>
  );
}
