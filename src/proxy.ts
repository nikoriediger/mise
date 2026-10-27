import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { defaultLocale, isLocale, LOCALE_COOKIE, matchAcceptLanguage, showLanding, type Locale } from "@/i18n/config";

const PUBLIC_PATHS = ["/login", "/signup", "/welcome"];
const LOCALE_PREFIX = /^\/(de|en|it)(?=\/|$)/;
const ONE_YEAR = 60 * 60 * 24 * 365;

/**
 * 1. Refreshes the Supabase session.
 * 2. Sends signed-out users to /login (and signed-in users away from it).
 * 3. Picks the UI language and rewrites /path -> /<lang>/path internally,
 *    so URLs stay language-neutral (invite links, bookmarks, shares).
 */
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet, headers) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
          for (const [key, value] of Object.entries(headers ?? {})) {
            response.headers.set(key, value);
          }
        },
      },
    },
  );

  // Refreshes the session if needed. Must run before any redirect decision.
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  const signedIn = Boolean(claims);

  const { pathname } = request.nextUrl;

  // API routes and files (manifest, icons) aren't localized pages
  if (pathname.startsWith("/api/") || /\.[a-z0-9]+$/i.test(pathname)) {
    return response;
  }

  // An explicit /it/... link switches the language and drops the prefix
  const prefixed = LOCALE_PREFIX.exec(pathname);
  if (prefixed) {
    const redirect = redirectWithCookies(request, response, pathname.slice(prefixed[0].length) || "/", request.nextUrl.search);
    redirect.cookies.set(LOCALE_COOKIE, prefixed[1], { path: "/", maxAge: ONE_YEAR, sameSite: "lax" });
    return redirect;
  }

  const isPublic = PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
  if (!signedIn && !isPublic) {
    return redirectWithCookies(request, response, showLanding && pathname === "/" ? "/welcome" : "/login");
  }
  if (signedIn && isPublic) {
    return redirectWithCookies(request, response, "/");
  }

  const cookieLocale = request.cookies.get(LOCALE_COOKIE)?.value;
  const profileLocale = (claims?.user_metadata as { locale?: string } | undefined)?.locale;
  const locale: Locale = isLocale(cookieLocale)
    ? cookieLocale
    : isLocale(profileLocale)
      ? profileLocale
      : (matchAcceptLanguage(request.headers.get("accept-language")) ?? defaultLocale);

  const url = request.nextUrl.clone();
  url.pathname = `/${locale}${pathname === "/" ? "" : pathname}`;
  const rewrite = NextResponse.rewrite(url, { request: { headers: request.headers } });
  for (const cookie of response.cookies.getAll()) rewrite.cookies.set(cookie);
  // Keep headers set by Supabase (e.g. no-cache after a token refresh), skip Next.js internals
  response.headers.forEach((value, key) => {
    if (!key.toLowerCase().startsWith("x-middleware-")) rewrite.headers.set(key, value);
  });
  if (cookieLocale !== locale) {
    rewrite.cookies.set(LOCALE_COOKIE, locale, { path: "/", maxAge: ONE_YEAR, sameSite: "lax" });
  }
  return rewrite;
}

function redirectWithCookies(request: NextRequest, from: NextResponse, pathname: string, search = "") {
  const url = request.nextUrl.clone();
  url.pathname = pathname;
  url.search = search;
  const redirect = NextResponse.redirect(url);
  for (const cookie of from.cookies.getAll()) {
    redirect.cookies.set(cookie);
  }
  return redirect;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
