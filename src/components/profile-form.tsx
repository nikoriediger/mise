"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useRef, useState, useTransition } from "react";
import { changePassword, updateProfile } from "@/app/actions/profile";
import { Avatar } from "@/components/avatar";
import { spring } from "@/components/motion";
import { useI18n } from "@/i18n/client";
import { cropSquare, extensionFor } from "@/lib/image-compress";
import { createClient } from "@/lib/supabase/client";
import { AVATAR_BUCKET, type Profile } from "@/lib/types";

export function ProfileForm({ profile }: { profile: Profile }) {
  const { t } = useI18n();
  const [name, setName] = useState(profile.display_name);
  const [bio, setBio] = useState(profile.bio);
  const [photo, setPhoto] = useState<{ file: Blob; url: string } | null>(null);
  const [removePhoto, setRemovePhoto] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);

  const shownPhoto = photo?.url ?? (removePhoto ? null : profile.avatar_url);

  async function pick(file: File | undefined) {
    if (!file) return;
    const blob = await cropSquare(file);
    if (photo) URL.revokeObjectURL(photo.url);
    setPhoto({ file: blob, url: URL.createObjectURL(blob) });
    setRemovePhoto(false);
    setMessage(null);
  }

  function save() {
    startTransition(async () => {
      let avatarPath: string | null | undefined;
      if (photo) {
        const path = `${profile.user_id}/${crypto.randomUUID()}.${extensionFor(photo.file.type)}`;
        const { error } = await createClient().storage.from(AVATAR_BUCKET).upload(path, photo.file, { contentType: photo.file.type });
        if (error) {
          setMessage({ ok: false, text: t.common.error });
          return;
        }
        avatarPath = path;
      } else if (removePhoto) {
        avatarPath = null;
      }
      const result = await updateProfile({ displayName: name, bio, avatarPath });
      if (result.error) setMessage({ ok: false, text: result.error });
      else {
        setMessage({ ok: true, text: t.profile.saved });
        setPhoto(null);
        setRemovePhoto(false);
      }
    });
  }

  return (
    <section className="card space-y-5 p-5 sm:p-6">
      <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-center">
        <motion.div key={shownPhoto ?? "none"} initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={spring}>
          <Avatar url={shownPhoto} name={name} size="lg" className="shadow-lifted ring-4 ring-cream" />
        </motion.div>
        <div className="flex w-full flex-col gap-2 sm:w-auto">
          <span className="label text-center sm:text-left">{t.profile.photo}</span>
          <div className="grid grid-cols-2 gap-2">
            <button type="button" className="btn-secondary min-h-12 sm:min-h-0" onClick={() => cameraRef.current?.click()}>📷 {t.profile.takePhoto}</button>
            <button type="button" className="btn-secondary min-h-12 sm:min-h-0" onClick={() => galleryRef.current?.click()}>🖼 {t.profile.choosePhoto}</button>
          </div>
          {shownPhoto && (
            <button
              type="button"
              className="text-sm text-red-700 underline-offset-2 hover:underline"
              onClick={() => {
                if (photo) URL.revokeObjectURL(photo.url);
                setPhoto(null);
                setRemovePhoto(true);
              }}
            >
              {t.profile.removePhoto}
            </button>
          )}
          <input ref={cameraRef} type="file" accept="image/*" capture="user" hidden onChange={(e) => { pick(e.target.files?.[0]); e.target.value = ""; }} />
          <input ref={galleryRef} type="file" accept="image/*" hidden onChange={(e) => { pick(e.target.files?.[0]); e.target.value = ""; }} />
        </div>
      </div>

      <div>
        <label className="label" htmlFor="profile-name">{t.profile.name}</label>
        <input id="profile-name" className="input" value={name} maxLength={60} placeholder={t.profile.namePlaceholder} onChange={(e) => setName(e.target.value)} />
      </div>
      <div>
        <label className="label" htmlFor="profile-bio">{t.profile.bio}</label>
        <textarea id="profile-bio" className="input min-h-20 [field-sizing:content]" value={bio} maxLength={200} placeholder={t.profile.bioPlaceholder} onChange={(e) => setBio(e.target.value)} />
        <p className="hint text-right">{bio.length}/200</p>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <button className="btn-primary min-h-12 sm:min-h-0" disabled={pending || !name.trim()} onClick={save}>
          {pending ? t.common.saving : t.common.save}
        </button>
        <AnimatePresence>
          {message && (
            <motion.p
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className={`text-sm ${message.ok ? "text-moss-600" : "text-red-700"}`}
            >
              {message.text}
            </motion.p>
          )}
        </AnimatePresence>
      </div>
    </section>
  );
}

export function PasswordForm() {
  const { t } = useI18n();
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <form
      className="card space-y-4 p-5 sm:p-6"
      onSubmit={(e) => {
        e.preventDefault();
        startTransition(async () => {
          const result = await changePassword(password);
          if (result.error) setMessage({ ok: false, text: result.error });
          else {
            setPassword("");
            setMessage({ ok: true, text: t.profile.passwordSaved });
          }
        });
      }}
    >
      <h2 className="font-serif text-xl font-semibold text-forest-900">{t.profile.password}</h2>
      <div>
        <label className="label" htmlFor="new-password">{t.profile.newPassword}</label>
        <input id="new-password" className="input" type="password" autoComplete="new-password" minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} />
      </div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <button className="btn-secondary min-h-12 sm:min-h-0" disabled={pending || password.length < 8}>
          {pending ? t.common.saving : t.profile.changePassword}
        </button>
        {message && <p className={`text-sm ${message.ok ? "text-moss-600" : "text-red-700"}`}>{message.text}</p>}
      </div>
    </form>
  );
}
