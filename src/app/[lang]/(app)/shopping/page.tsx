import type { Metadata } from "next";
import { Suspense } from "react";
import { Loading } from "@/components/loading";
import { ShoppingList } from "@/components/shopping-list";
import { listShoppingItems } from "@/lib/data";
import { getI18n } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.shopping.title };
}

export default function ShoppingPage() {
  return (
    <Suspense fallback={<Loading />}>
      <Shopping />
    </Suspense>
  );
}

async function Shopping() {
  const items = await listShoppingItems();
  return (
    <div className="mx-auto max-w-2xl">
      <ShoppingList items={items} />
    </div>
  );
}
