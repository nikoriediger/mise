import type { Metadata } from "next";
import { LoginForm } from "@/components/auth-forms";
import { t } from "@/i18n";

export const metadata: Metadata = { title: t.auth.signIn };

export default function LoginPage() {
  return <LoginForm />;
}
