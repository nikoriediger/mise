"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense } from "react";
import { spring } from "@/components/motion";
import { t } from "@/i18n";

const links = [
  { href: "/", label: t.nav.recipes, match: (p: string) => p === "/" || (p.startsWith("/recipes/") && p !== "/recipes/new") },
  { href: "/cookbooks", label: t.nav.cookbooks, match: (p: string) => p.startsWith("/cookbooks") },
  { href: "/family", label: t.nav.family, match: (p: string) => p.startsWith("/family") },
];

export function NavLinks() {
  // Reading the URL is request-time data, so the highlighted version streams in.
  return (
    <Suspense fallback={<Links pathname={null} />}>
      <ActiveLinks />
    </Suspense>
  );
}

function ActiveLinks() {
  return <Links pathname={usePathname()} />;
}

function Links({ pathname }: { pathname: string | null }) {
  return (
    <div className="flex items-center gap-1">
      {links.map((link) => {
        const active = pathname !== null && link.match(pathname);
        return (
          <Link
            key={link.href}
            href={link.href}
            className={`relative rounded-full px-3 py-1.5 text-sm transition-colors ${
              active ? "text-forest-900" : "text-muted hover:text-forest-800"
            }`}
          >
            {active && (
              <motion.span
                layoutId="nav-pill"
                className="absolute inset-0 rounded-full bg-sage-200/70 shadow-[inset_0_1px_0_rgb(255_255_255/0.6)]"
                transition={spring}
              />
            )}
            <span className="relative">{link.label}</span>
          </Link>
        );
      })}
    </div>
  );
}
