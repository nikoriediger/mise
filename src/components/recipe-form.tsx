"use client";

import Image from "next/image";
import Link from "next/link";
import { useRef, useState } from "react";
import { saveRecipe, type ImageState } from "@/app/actions/recipes";
import { recipeFormTools } from "@/features/registry";
import { compressImage, extensionFor } from "@/lib/image-compress";
import { createClient } from "@/lib/supabase/client";
import { IMAGE_BUCKET, type ImageRole, type RecipeDraft, type RecipeWithImages } from "@/lib/types";
import { t } from "@/i18n";

type FormImage = {
  key: string;
  id?: string;
  storage_path?: string;
  file?: File;
  url: string;
  role: ImageRole;
  is_cover: boolean;
};

type Fields = {
  title: string;
  servings: string;
  prep_minutes: string;
  cook_minutes: string;
  ingredients: string;
  steps: string;
  notes: string;
  category: string;
  tags: string;
};

type Props = {
  cookbookId: string;
  recipe?: RecipeWithImages;
};

export function RecipeForm({ cookbookId, recipe }: Props) {
  const [recipeId] = useState(() => recipe?.id ?? crypto.randomUUID());
  const [fields, setFields] = useState<Fields>(() => toFields(recipe));
  const [images, setImages] = useState<FormImage[]>(() =>
    (recipe?.images ?? []).map((img) => ({
      key: img.id,
      id: img.id,
      storage_path: img.storage_path,
      url: img.url,
      role: img.role,
      is_cover: img.is_cover,
    })),
  );
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (name: keyof Fields) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setFields((f) => ({ ...f, [name]: e.target.value }));

  function addFiles(files: FileList | File[], role: ImageRole) {
    const added = [...files].map((file) => ({
      key: crypto.randomUUID(),
      file,
      url: URL.createObjectURL(file),
      role,
      is_cover: false,
    }));
    setImages((current) => [...current, ...added]);
  }

  function updateImage(key: string, change: Partial<FormImage>) {
    setImages((current) =>
      current.map((img) => {
        if (img.key === key) return { ...img, ...change };
        // Only one cover image
        if (change.is_cover) return { ...img, is_cover: false };
        return img;
      }),
    );
  }

  function removeImage(key: string) {
    setImages((current) => {
      const img = current.find((i) => i.key === key);
      if (img?.file) URL.revokeObjectURL(img.url);
      return current.filter((i) => i.key !== key);
    });
  }

  function prefill(draft: Partial<RecipeDraft>, sourceFiles: File[]) {
    setFields((f) => ({ ...f, ...toFields(draft) }));
    if (sourceFiles.length) addFiles(sourceFiles, "source");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!fields.title.trim()) {
      setError(t.form.titleRequired);
      return;
    }
    setPending(true);
    setError(null);

    const supabase = createClient();
    let uploadFailed = false;
    const uploaded = await Promise.all(
      images.map(async (img) => {
        if (!img.file) return img;
        try {
          const blob = await compressImage(img.file);
          const path = `${cookbookId}/${recipeId}/${crypto.randomUUID()}.${extensionFor(blob.type)}`;
          const { error } = await supabase.storage
            .from(IMAGE_BUCKET)
            .upload(path, blob, { contentType: blob.type });
          if (error) throw error;
          // Keep the local preview, but remember the upload so a retry doesn't re-upload.
          return { ...img, file: undefined, storage_path: path };
        } catch {
          uploadFailed = true;
          return img;
        }
      }),
    );
    setImages(uploaded);
    if (uploadFailed) {
      setError(t.form.uploadFailed);
      setPending(false);
      return;
    }

    const sortOrder = { gallery: 0, source: 0 };
    const imageStates: ImageState[] = uploaded.map((img) => ({
      id: img.id,
      storage_path: img.storage_path!,
      role: img.role,
      sort_order: sortOrder[img.role]++,
      is_cover: img.role === "gallery" && img.is_cover,
    }));

    try {
      const result = await saveRecipe({
        id: recipeId,
        cookbookId,
        isNew: !recipe,
        draft: toDraft(fields),
        images: imageStates,
      });
      // On success the action redirects, so we only get here on error.
      if (result?.error) setError(result.error);
    } catch (err) {
      // redirect() is delivered as a thrown navigation signal; let Next handle it.
      if (isRedirect(err)) throw err;
      setError(t.common.error);
    }
    setPending(false);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <h1 className="font-serif text-3xl font-semibold">{recipe ? t.form.editTitle : t.form.newTitle}</h1>

      {!recipe && recipeFormTools.map((Tool, i) => <Tool key={i} onPrefill={prefill} />)}

      <div>
        <label className="label" htmlFor="title">{t.form.title}</label>
        <input id="title" className="input text-lg" value={fields.title} onChange={set("title")} placeholder={t.form.titlePlaceholder} required />
      </div>

      <div className="grid grid-cols-3 gap-3">
        <NumberField id="servings" label={t.form.servings} value={fields.servings} onChange={set("servings")} />
        <NumberField id="prep_minutes" label={t.form.prepMinutes} value={fields.prep_minutes} onChange={set("prep_minutes")} />
        <NumberField id="cook_minutes" label={t.form.cookMinutes} value={fields.cook_minutes} onChange={set("cook_minutes")} />
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <div>
          <label className="label" htmlFor="ingredients">{t.form.ingredients}</label>
          <textarea id="ingredients" className="input min-h-48 font-mono text-sm" value={fields.ingredients} onChange={set("ingredients")} />
          <p className="hint">{t.form.ingredientsHint}</p>
        </div>
        <div>
          <label className="label" htmlFor="steps">{t.form.steps}</label>
          <textarea id="steps" className="input min-h-48" value={fields.steps} onChange={set("steps")} />
          <p className="hint">{t.form.stepsHint}</p>
        </div>
      </div>

      <div>
        <label className="label" htmlFor="notes">{t.form.notes}</label>
        <textarea id="notes" className="input min-h-24" value={fields.notes} onChange={set("notes")} />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="category">{t.form.category}</label>
          <input id="category" className="input" value={fields.category} onChange={set("category")} placeholder={t.form.categoryPlaceholder} />
        </div>
        <div>
          <label className="label" htmlFor="tags">{t.form.tags}</label>
          <input id="tags" className="input" value={fields.tags} onChange={set("tags")} />
          <p className="hint">{t.form.tagsHint}</p>
        </div>
      </div>

      <ImageSection
        title={t.form.photos}
        addLabel={t.form.addPhotos}
        role="gallery"
        images={images.filter((img) => img.role === "gallery")}
        onAdd={(files) => addFiles(files, "gallery")}
        onUpdate={updateImage}
        onRemove={removeImage}
      />
      <ImageSection
        title={t.form.sources}
        addLabel={t.form.addSources}
        role="source"
        images={images.filter((img) => img.role === "source")}
        onAdd={(files) => addFiles(files, "source")}
        onUpdate={updateImage}
        onRemove={removeImage}
      />

      {error && <p className="text-sm text-red-700">{error}</p>}

      <div className="sticky bottom-0 -mx-4 flex gap-3 border-t border-line bg-cream/95 px-4 py-3 backdrop-blur">
        <button className="btn-primary" disabled={pending}>{pending ? t.common.saving : t.common.save}</button>
        <Link href={recipe ? `/recipes/${recipe.id}` : "/"} className="btn-secondary">{t.common.cancel}</Link>
      </div>
    </form>
  );
}

function NumberField(props: { id: string; label: string; value: string; onChange: React.ChangeEventHandler<HTMLInputElement> }) {
  return (
    <div>
      <label className="label" htmlFor={props.id}>{props.label}</label>
      <input id={props.id} className="input" type="number" inputMode="numeric" min={0} value={props.value} onChange={props.onChange} />
    </div>
  );
}

function ImageSection(props: {
  title: string;
  addLabel: string;
  role: ImageRole;
  images: FormImage[];
  onAdd: (files: FileList) => void;
  onUpdate: (key: string, change: Partial<FormImage>) => void;
  onRemove: (key: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const otherRole: ImageRole = props.role === "gallery" ? "source" : "gallery";

  return (
    <section>
      <h2 className="label">{props.title}</h2>
      <div className="flex flex-wrap gap-3">
        {props.images.map((img) => (
          <div key={img.key} className="card w-36 overflow-hidden">
            <div className="relative aspect-square bg-line">
              <Image src={img.url} alt="" fill unoptimized className="object-cover" />
              {img.is_cover && (
                <span className="absolute left-1 top-1 rounded bg-accent px-1.5 py-0.5 text-xs text-white">{t.form.cover}</span>
              )}
            </div>
            <div className="flex flex-col p-1 text-xs">
              {props.role === "gallery" && !img.is_cover && (
                <button type="button" className="rounded px-2 py-1 text-left hover:bg-cream" onClick={() => props.onUpdate(img.key, { is_cover: true })}>
                  {t.form.setCover}
                </button>
              )}
              <button type="button" className="rounded px-2 py-1 text-left hover:bg-cream" onClick={() => props.onUpdate(img.key, { role: otherRole, is_cover: false })}>
                {otherRole === "gallery" ? t.form.moveToGallery : t.form.moveToSources}
              </button>
              <button type="button" className="rounded px-2 py-1 text-left text-red-700 hover:bg-red-50" onClick={() => props.onRemove(img.key)}>
                {t.form.remove}
              </button>
            </div>
          </div>
        ))}
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="flex aspect-square w-36 flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-line text-sm text-muted transition hover:border-accent hover:text-accent"
        >
          <span className="text-2xl">+</span>
          {props.addLabel}
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          hidden
          onChange={(e) => {
            if (e.target.files?.length) props.onAdd(e.target.files);
            e.target.value = "";
          }}
        />
      </div>
    </section>
  );
}

function toFields(r?: Partial<Omit<RecipeDraft, "notes" | "category"> & { notes: string | null; category: string | null }>): Fields {
  const num = (n: number | null | undefined) => (n == null ? "" : String(n));
  return {
    title: r?.title ?? "",
    servings: num(r?.servings),
    prep_minutes: num(r?.prep_minutes),
    cook_minutes: num(r?.cook_minutes),
    ingredients: (r?.ingredients ?? []).join("\n"),
    steps: (r?.steps ?? []).join("\n"),
    notes: r?.notes ?? "",
    category: r?.category ?? "",
    tags: (r?.tags ?? []).join(", "),
  };
}

function toDraft(f: Fields): RecipeDraft {
  const num = (s: string) => (s.trim() === "" ? null : Number(s));
  return {
    title: f.title,
    servings: num(f.servings),
    prep_minutes: num(f.prep_minutes),
    cook_minutes: num(f.cook_minutes),
    ingredients: f.ingredients.split("\n"),
    steps: f.steps.split("\n"),
    notes: f.notes,
    category: f.category,
    tags: f.tags.split(","),
  };
}

function isRedirect(err: unknown) {
  return typeof err === "object" && err !== null && "digest" in err && String(err.digest).startsWith("NEXT_REDIRECT");
}
