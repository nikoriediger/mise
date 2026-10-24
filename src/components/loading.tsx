import { t } from "@/i18n";

export function Loading() {
  return <p className="py-12 text-center text-sm text-muted">{t.common.loading}</p>;
}
