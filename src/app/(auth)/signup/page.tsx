import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { SignupForm } from "@/components/auth-forms";
import { createClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/data";
import { t } from "@/i18n";

export const metadata: Metadata = { title: t.auth.signUp };

export default function SignupPage({ searchParams }: PageProps<"/signup">) {
  return (
    <Suspense fallback={<p className="text-sm text-muted">{t.common.loading}</p>}>
      <Signup searchParams={searchParams} />
    </Suspense>
  );
}

async function Signup({ searchParams }: Pick<PageProps<"/signup">, "searchParams">) {
  const { invite } = await searchParams;
  const supabase = await createClient();

  if (typeof invite === "string" && invite) {
    const { data } = isUuid(invite)
      ? await supabase.rpc("get_invite", { p_token: invite })
      : { data: null };
    const cookbookName: string | undefined = data?.[0]?.cookbook_name;
    if (!cookbookName) {
      return <Message text={t.auth.invalidInvite} />;
    }
    return <SignupForm invite={invite} cookbookName={cookbookName} />;
  }

  const { data: mode } = await supabase.rpc("get_signup_mode");
  if (mode !== "open") {
    return <Message text={t.auth.signupDisabled} />;
  }
  return <SignupForm />;
}

function Message({ text }: { text: string }) {
  return (
    <div className="space-y-4 text-sm">
      <p>{text}</p>
      <Link href="/login" className="font-medium text-accent hover:underline">{t.auth.signIn}</Link>
    </div>
  );
}
