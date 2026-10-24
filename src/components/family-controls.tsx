"use client";

import { useState, useSyncExternalStore, useTransition } from "react";
import { createInvite, removeMember, revokeInvite } from "@/app/actions/family";
import { ConfirmDialog } from "@/components/dialog";
import type { Invite } from "@/lib/data";
import { useI18n } from "@/i18n/client";

export function InvitePanel({ invites }: { invites: Invite[] }) {
  const { t, date } = useI18n();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState(false);
  const origin = useSyncExternalStore(noopSubscribe, () => window.location.origin, () => "");

  const link = (token: string) => `${origin}/signup?invite=${token}`;

  return (
    <section className="space-y-4">
      <div>
        <h2 className="font-serif text-xl font-semibold">{t.family.invite}</h2>
        <p className="mt-1 text-sm text-muted">{t.family.inviteHint}</p>
      </div>
      <button
        className="btn-primary"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const result = await createInvite();
            setError("error" in result);
          })
        }
      >
        {t.family.createInvite}
      </button>
      {error && <p className="text-sm text-red-700">{t.common.error}</p>}

      {invites.length > 0 && (
        <div>
          <h3 className="label">{t.family.openInvites}</h3>
          <ul className="space-y-2">
            {invites.map((invite) => (
              <li key={invite.token} className="card flex flex-wrap items-center gap-2 p-3">
                <code className="min-w-0 flex-1 truncate text-xs">{link(invite.token)}</code>
                <span className="text-xs text-muted">
                  {t.family.expires} {date(invite.expires_at)}
                </span>
                <CopyButton text={link(invite.token)} />
                <button
                  className="btn-secondary px-2 py-1 text-xs"
                  onClick={() => startTransition(() => revokeInvite(invite.token))}
                >
                  {t.family.revoke}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

const noopSubscribe = () => () => {};

function CopyButton({ text }: { text: string }) {
  const { t } = useI18n();
  const [copied, setCopied] = useState(false);
  return (
    <button
      className="btn-secondary px-2 py-1 text-xs"
      onClick={async () => {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
    >
      {copied ? t.family.copied : t.family.copy}
    </button>
  );
}

export function RemoveMemberButton({ userId }: { userId: string }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  return (
    <>
      <button className="btn-danger px-2 py-1 text-xs" disabled={pending} onClick={() => setOpen(true)}>
        {t.family.removeMember}
      </button>
      <ConfirmDialog
        open={open}
        message={t.family.removeConfirm}
        confirmLabel={t.family.removeMember}
        pending={pending}
        onCancel={() => setOpen(false)}
        onConfirm={() =>
          startTransition(async () => {
            await removeMember(userId);
            setOpen(false);
          })
        }
      />
    </>
  );
}
