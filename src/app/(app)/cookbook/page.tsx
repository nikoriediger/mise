import type { Metadata } from "next";
import { Suspense } from "react";
import { InvitePanel, RemoveMemberButton } from "@/components/cookbook-controls";
import { Loading } from "@/components/loading";
import { getCookbookDetails, getCurrentUser } from "@/lib/data";
import { t } from "@/i18n";

export const metadata: Metadata = { title: t.cookbook.title };

export default function CookbookPage() {
  return (
    <Suspense fallback={<Loading />}>
      <Cookbook />
    </Suspense>
  );
}

async function Cookbook() {
  const user = await getCurrentUser();
  const { cookbook, members, invites } = await getCookbookDetails();
  const isOwner = cookbook.role === "owner";

  return (
    <div className="max-w-2xl space-y-8">
      <div>
        <p className="text-sm font-medium uppercase tracking-wide text-accent">{t.cookbook.title}</p>
        <h1 className="font-serif text-3xl font-semibold">{cookbook.cookbook_name}</h1>
      </div>

      <section>
        <h2 className="mb-3 font-serif text-xl font-semibold">{t.cookbook.members}</h2>
        <ul className="card divide-y divide-line">
          {members.map((m) => (
            <li key={m.user_id} className="flex items-center gap-3 px-4 py-3">
              <span className="mr-auto">
                {m.display_name || "—"}
                {m.user_id === user.id && <span className="text-muted"> ({t.cookbook.you})</span>}
              </span>
              <span className="text-sm text-muted">{m.role === "owner" ? t.cookbook.owner : t.cookbook.member}</span>
              {isOwner && m.user_id !== user.id && <RemoveMemberButton userId={m.user_id} />}
            </li>
          ))}
        </ul>
      </section>

      {isOwner && <InvitePanel invites={invites} />}
    </div>
  );
}
