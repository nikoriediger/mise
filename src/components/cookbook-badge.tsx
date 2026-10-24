import Link from "next/link";
import type { Cookbook } from "@/lib/types";

/** Small pill showing which cookbook something belongs to. */
export function CookbookBadge({ cookbook, link = false, className = "" }: { cookbook: Pick<Cookbook, "id" | "name" | "emoji">; link?: boolean; className?: string }) {
  const content = (
    <>
      <span aria-hidden>{cookbook.emoji}</span>
      <span className="truncate">{cookbook.name}</span>
    </>
  );
  const classes = `inline-flex max-w-full items-center gap-1.5 rounded-full bg-sage-100/90 px-2.5 py-0.5 text-xs font-medium text-forest-800 ${className}`;

  return link ? (
    <Link href={`/cookbooks/${cookbook.id}`} className={`${classes} transition-colors hover:bg-sage-200`}>
      {content}
    </Link>
  ) : (
    <span className={classes}>{content}</span>
  );
}
