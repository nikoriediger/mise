import type { Metadata } from "next";
import { LoginForm } from "@/components/auth-forms";
import { getI18n } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.auth.signIn };
}

export default function LoginPage() {
  return <LoginForm />;
}
