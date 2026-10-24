"use client";

import { useState, useSyncExternalStore, useTransition } from "react";
import { createInvite, removeMember, revokeInvite } from "@/app/actions/cookbook";
import { ConfirmDialog } from "@/components/dialog";
import type { Invite } from "@/lib/data";
import { formatDate, t } from "@/i18n";

export function InvitePanel({ invites }: { invites: Invite[] }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState(false);
  const origin = useSyncExternalStore(noopSubscribe, () => window.location.origin, () => "");

  const link = (token: string) => `${origin}/signup?invite=${token}`;

  return (
    <section className="space-y-4">
      <div>
        <h2 className="font-serif text-xl font-semibold">{t.cookbook.invite}</h2>
        <p className="mt-1 text-sm text-muted">{t.cookbook.inviteHint}</p>
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
        {t.cookbook.createInvite}
      </button>
      {error && <p className="text-sm text-red-700">{t.common.error}</p>}

      {invites.length > 0 && (
        <div>
          <h3 className="label">{t.cookbook.openInvites}</h3>
          <ul className="space-y-2">
            {invites.map((invite) => (
              <li key={invite.token} className="card flex flex-wrap items-center gap-2 p-3">
                <code className="min-w-0 flex-1 truncate text-xs">{link(invite.token)}</code>
                <span className="text-xs text-muted">
                  {t.cookbook.expires} {formatDate(invite.expires_at)}
                </span>
                <CopyButton text={link(invite.token)} />
                <button
                  className="btn-secondary px-2 py-1 text-xs"
                  onClick={() => startTransition(() => revokeInvite(invite.token))}
                >
                  {t.cookbook.revoke}
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
      {copied ? t.cookbook.copied : t.cookbook.copy}
    </button>
  );
}

export function RemoveMemberButton({ userId }: { userId: string }) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  return (
    <>
      <button className="btn-danger px-2 py-1 text-xs" disabled={pending} onClick={() => setOpen(true)}>
        {t.cookbook.removeMember}
      </button>
      <ConfirmDialog
        open={open}
        message={t.cookbook.removeConfirm}
        confirmLabel={t.cookbook.removeMember}
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
