import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";

const COOKIE_NAME = "placid_session";
const ROOT = (process.env.ROOT_DOMAIN || "placidcrm.com").toLowerCase();

// Two jobs:
//  1. Custom-domain hosting — a business connects yourbusiness.com.au and any
//     non-platform host is rewritten to /domain-site/<host>/<path>, which looks
//     the site up by customDomain. Those pages are public: no auth.
//  2. Guard the admin app (/dashboard/*). Public tenant sites (/sites/*), auth
//     pages, API routes and static assets stay open.
export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|gif|svg|webp|ico|css|js|map|txt|xml|woff|woff2)$).*)",
  ],
};

function isPlatformHost(host: string): boolean {
  return (
    host === ROOT ||
    host.endsWith(`.${ROOT}`) ||
    host === "localhost" ||
    host.startsWith("127.0.0.1") ||
    host.startsWith("0.0.0.0") ||
    /^\d{1,3}(\.\d{1,3}){3}$/.test(host) // raw IP (health checks)
  );
}

async function isValidSession(token: string | undefined): Promise<boolean> {
  if (!token) return false;
  const secret = process.env.AUTH_SECRET;
  if (!secret) return false;
  try {
    await jwtVerify(token, new TextEncoder().encode(secret));
    return true;
  } catch {
    return false;
  }
}

export async function middleware(req: NextRequest) {
  const host = (req.headers.get("host") ?? "").toLowerCase().replace(/:\d+$/, "");
  const { pathname, search } = req.nextUrl;

  // 1) Connected custom domain → serve that business's site.
  if (host && !isPlatformHost(host)) {
    if (
      pathname.startsWith("/api/") ||
      pathname.startsWith("/_next/") ||
      pathname.startsWith("/domain-site/")
    ) {
      return NextResponse.next();
    }
    const url = req.nextUrl.clone();
    url.pathname = `/domain-site/${encodeURIComponent(host)}${pathname === "/" ? "" : pathname}`;
    url.search = search;
    return NextResponse.rewrite(url);
  }

  // 2) Platform host: only the dashboard needs a session.
  if (!pathname.startsWith("/dashboard")) return NextResponse.next();
  if (await isValidSession(req.cookies.get(COOKIE_NAME)?.value)) return NextResponse.next();

  const loginUrl = new URL("/login", req.url);
  loginUrl.searchParams.set("next", pathname);
  return NextResponse.redirect(loginUrl);
}
