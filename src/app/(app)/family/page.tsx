import type { Metadata } from "next";
import { Suspense } from "react";
import { InvitePanel, RemoveMemberButton } from "@/components/family-controls";
import { Loading } from "@/components/loading";
import { getFamilyDetails, getCurrentUser } from "@/lib/data";
import { t } from "@/i18n";

export const metadata: Metadata = { title: t.family.title };

export default function FamilyPage() {
  return (
    <Suspense fallback={<Loading />}>
      <Family />
    </Suspense>
  );
}

async function Family() {
  const user = await getCurrentUser();
  const { family, members, invites } = await getFamilyDetails();
  const isOwner = family.role === "owner";

  return (
    <div className="max-w-2xl space-y-8">
      <div>
        <p className="text-sm font-medium uppercase tracking-wide text-accent">{t.family.title}</p>
        <h1 className="font-serif text-3xl font-semibold">{family.family_name}</h1>
      </div>

      <section>
        <h2 className="mb-3 font-serif text-xl font-semibold">{t.family.members}</h2>
        <ul className="card divide-y divide-line">
          {members.map((m) => (
            <li key={m.user_id} className="flex items-center gap-3 px-4 py-3">
              <span className="mr-auto">
                {m.display_name || "—"}
                {m.user_id === user.id && <span className="text-muted"> ({t.family.you})</span>}
              </span>
              <span className="text-sm text-muted">{m.role === "owner" ? t.family.owner : t.family.member}</span>
              {isOwner && m.user_id !== user.id && <RemoveMemberButton userId={m.user_id} />}
            </li>
          ))}
        </ul>
      </section>

      {isOwner && <InvitePanel invites={invites} />}
    </div>
  );
}
