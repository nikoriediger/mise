import type { Metadata } from "next";
import { Suspense } from "react";
import { LanguageList } from "@/components/language-switcher";
import { Loading } from "@/components/loading";
import { NotificationSettings } from "@/components/notification-settings";
import { PasswordForm, ProfileForm } from "@/components/profile-form";
import { getCurrentUser, getMyProfile } from "@/lib/data";
import { getI18n } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.profile.title };
}

export default function ProfilePage() {
  return (
    <Suspense fallback={<Loading />}>
      <Profile />
    </Suspense>
  );
}

async function Profile() {
  const { t } = await getI18n();
  const [profile, user] = await Promise.all([getMyProfile(), getCurrentUser()]);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="font-serif text-3xl font-semibold text-forest-900 sm:text-4xl">{t.profile.title}</h1>
        <p className="mt-1 text-sm text-muted">
          {t.profile.email}: {user.email}
        </p>
      </div>
      <ProfileForm profile={profile} />
      <NotificationSettings notifyNotes={profile.notify_notes} notifyNewRecipes={profile.notify_new_recipes} />
      <section className="card space-y-3 p-5 sm:p-6">
        <h2 className="font-serif text-xl font-semibold text-forest-900">{t.lang.title}</h2>
        <LanguageList />
      </section>
      <PasswordForm />
    </div>
  );
}
