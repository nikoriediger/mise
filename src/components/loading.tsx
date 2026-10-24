import { getI18n } from "@/i18n/server";

export async function Loading() {
  const { t } = await getI18n();
  return (
    <div className="flex flex-col items-center gap-3 py-20 text-sm text-muted">
      <span className="size-8 animate-spin rounded-full border-2 border-sage-200 border-t-forest-700" />
      {t.common.loading}
    </div>
  );
}
