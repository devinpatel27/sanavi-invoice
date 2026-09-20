import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  ADMIN_ONLY_PREFIXES,
  STAFF_ALLOWED_PREFIXES,
} from "@/lib/nav";

const PUBLIC_PATHS = ["/login"];

export default auth((req) => {
  const { nextUrl } = req;
  const pathname = nextUrl.pathname;
  const isPublic = PUBLIC_PATHS.some((path) => pathname.startsWith(path));

  if (isPublic) {
    return NextResponse.next();
  }

  if (!req.auth) {
    const loginUrl = new URL("/login", nextUrl.origin);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  const role = req.auth.user.role;

  if (role === "STAFF") {
    const allowed = STAFF_ALLOWED_PREFIXES.some((prefix) =>
      pathname.startsWith(prefix)
    );
    if (!allowed) {
      return NextResponse.redirect(new URL("/invoices/upload", nextUrl.origin));
    }
    return NextResponse.next();
  }

  // ADMIN: block nothing in the app shell; admin-only prefixes are informational
  // for sidebar. Keep explicit guard if somehow a restricted path is added later.
  const isAdminOnlyPath = ADMIN_ONLY_PREFIXES.some((prefix) =>
    pathname.startsWith(prefix)
  );
  if (isAdminOnlyPath && role !== "ADMIN") {
    return NextResponse.redirect(new URL("/invoices/upload", nextUrl.origin));
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    "/((?!api/auth|_next/static|_next/image|favicon.ico|apple-icon.png|manifest.webmanifest|icons/|sanvicasa-logo.png).*)",
  ],
};
