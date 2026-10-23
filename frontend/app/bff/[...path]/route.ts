import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";

import { AUTH_COOKIE_NAME, AUTH_COOKIE_MAX_AGE_SECONDS } from "@/lib/auth-token";

// Jembatan antara browser dan API Django. Token sesi hanya hidup di cookie
// HttpOnly yang dibaca di sini; JavaScript di halaman tidak pernah
// memegangnya, jadi XSS tidak bisa mencurinya.
//
// Badan permintaan dibatasi 4,5 MB oleh fungsi Vercel. Unggahan besar
// (dokumen 10 MB, audio 5 MB) tidak lewat sini; mereka memakai tiket unggah
// langsung ke API (lib/upload-ticket.ts).

export const dynamic = "force-dynamic";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL;
const LOGOUT_PATH = "api/auth/logout";

function backendUrl(path: string[], search: string): string | null {
  if (!BACKEND_URL) return null;
  const joined = path.join("/");
  // Hanya rute API. Tanpa batas ini jembatan ini bisa dipakai membaca /health dan sejenisnya.
  if (!joined.startsWith("api/") || joined.includes("..")) return null;
  return `${BACKEND_URL.replace(/\/$/, "")}/${joined}${search}`;
}

function setSessionCookie(response: NextResponse, token: string, secure: boolean) {
  response.cookies.set({
    name: AUTH_COOKIE_NAME,
    value: token,
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/",
    maxAge: AUTH_COOKIE_MAX_AGE_SECONDS,
  });
}

function clearSessionCookie(response: NextResponse) {
  response.cookies.set({ name: AUTH_COOKIE_NAME, value: "", path: "/", maxAge: 0 });
}

async function handle(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
): Promise<NextResponse> {
  const { path } = await params;
  const target = backendUrl(path, request.nextUrl.search);
  if (!target) {
    return NextResponse.json({ detail: "Rute tidak ditemukan." }, { status: 404 });
  }

  const method = request.method.toUpperCase();
  const mutating = method !== "GET" && method !== "HEAD";
  if (mutating) {
    // Cookie SameSite=Lax sudah menahan POST lintas situs; ini lapis kedua.
    const origin = request.headers.get("origin");
    if (origin && origin !== request.nextUrl.origin) {
      return NextResponse.json({ detail: "Asal permintaan tidak diizinkan." }, { status: 403 });
    }
  }

  const headers = new Headers({ Accept: "application/json" });
  const contentType = request.headers.get("content-type");
  if (contentType) headers.set("Content-Type", contentType);
  const token = (await cookies()).get(AUTH_COOKIE_NAME)?.value;
  if (token) headers.set("Authorization", `Bearer ${token}`);

  let upstream: Response;
  try {
    upstream = await fetch(target, {
      method,
      headers,
      body: mutating ? await request.arrayBuffer() : undefined,
      cache: "no-store",
    });
  } catch {
    return NextResponse.json(
      { detail: "Tidak dapat menghubungi server ThinkPath." },
      { status: 502 },
    );
  }

  const secure = request.nextUrl.protocol === "https:" || request.headers.get("x-forwarded-proto") === "https";
  const upstreamType = upstream.headers.get("content-type") ?? "";
  const raw = await upstream.arrayBuffer();

  let body: BodyInit | null = raw.byteLength ? raw : null;
  let tokenToSet: string | null = null;
  if (upstreamType.includes("application/json") && raw.byteLength) {
    try {
      const json = JSON.parse(new TextDecoder().decode(raw)) as Record<string, unknown>;
      if (typeof json === "object" && json !== null && typeof json.token === "string") {
        // Token tidak pernah sampai ke browser: dipindah ke cookie HttpOnly.
        tokenToSet = json.token;
        delete json.token;
        body = JSON.stringify(json);
      }
    } catch {
      // Badan bukan JSON valid; teruskan apa adanya.
    }
  }

  const response = new NextResponse(body, {
    status: upstream.status,
    headers: {
      ...(upstreamType ? { "Content-Type": upstreamType } : {}),
      "Cache-Control": "no-store",
    },
  });
  if (tokenToSet && upstream.ok) setSessionCookie(response, tokenToSet, secure);
  // Logout selalu menghapus cookie, juga bila sesinya sudah mati di server.
  // Akun yang berhasil dihapus juga: sesinya sudah hilang bersama akunnya.
  const joined = path.join("/");
  if (joined === LOGOUT_PATH || (method === "DELETE" && joined === "api/me" && upstream.ok)) {
    clearSessionCookie(response);
  }
  return response;
}

export { handle as GET, handle as POST, handle as PUT, handle as PATCH, handle as DELETE };
