/* eslint-disable @next/next/no-img-element -- small signed profile photos */

const sizes = {
  xs: "size-5 text-[10px]",
  sm: "size-7 text-xs",
  md: "size-10 text-sm",
  lg: "size-24 text-3xl",
} as const;

/** Round profile photo, or the first letter of the name on a soft green background. */
export function Avatar({ url, name, size = "sm", className = "" }: { url: string | null | undefined; name: string; size?: keyof typeof sizes; className?: string }) {
  const base = `inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full ${sizes[size]} ${className}`;
  if (url) return <img src={url} alt="" className={`${base} object-cover`} />;
  return (
    <span aria-hidden className={`${base} bg-gradient-to-br from-sage-200 to-mint-200 font-semibold text-forest-800`}>
      {(name || "?").charAt(0).toUpperCase()}
    </span>
  );
}
