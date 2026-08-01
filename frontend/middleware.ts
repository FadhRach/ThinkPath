import { NextResponse, type NextRequest } from "next/server";

import { AUTH_COOKIE_NAME } from "@/lib/auth-token";

// Matcher membatasi middleware hanya ke path yang butuh login.
export function middleware(request: NextRequest) {
  const hasToken = Boolean(request.cookies.get(AUTH_COOKIE_NAME)?.value);

  if (!hasToken) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/student/:path*"],
};
