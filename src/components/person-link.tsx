import Link from "next/link";
import { Avatar } from "@/components/avatar";

/** Avatar + name linking to a family member's profile. */
export function PersonLink({
  userId,
  name,
  avatarUrl,
  size = "sm",
  label,
  className = "",
}: {
  userId: string;
  name: string;
  avatarUrl: string | null;
  size?: "xs" | "sm" | "md";
  /** Text next to the avatar (defaults to the name). */
  label?: React.ReactNode;
  className?: string;
}) {
  return (
    <Link
      href={`/people/${userId}`}
      className={`inline-flex min-h-9 items-center gap-1.5 rounded-full pr-2 transition-colors hover:bg-sage-100 hover:text-forest-900 ${className}`}
    >
      <Avatar url={avatarUrl} name={name} size={size} />
      <span className="underline-offset-2 hover:underline">{label ?? (name || "…")}</span>
    </Link>
  );
}
