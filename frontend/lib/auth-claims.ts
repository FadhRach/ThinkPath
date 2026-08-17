import { cookies } from "next/headers";

import { AUTH_COOKIE_NAME } from "./auth-token";
import type { Role } from "./types";

export interface AuthClaims {
  sub: string;
  email: string;
  role: Role;
}

// Membaca payload JWT TANPA verifikasi tanda tangan. Ini disengaja: klaim di
// sini hanya menentukan tampilan (item nav per peran, redirect antar-peran)
// tanpa panggilan jaringan, sehingga layout bisa merender seketika. Semua data
// sungguhan tetap diminta ke backend, yang memverifikasi tanda tangan token.
export function readAuthClaims(): AuthClaims | null {
  const token = cookies().get(AUTH_COOKIE_NAME)?.value;
  if (!token) return null;

  const parts = token.split(".");
  if (parts.length !== 3) return null;

  try {
    const payload: unknown = JSON.parse(
      Buffer.from(parts[1], "base64url").toString("utf8"),
    );
    if (typeof payload !== "object" || payload === null) return null;

    const { sub, email, role, exp } = payload as Record<string, unknown>;
    if (typeof exp === "number" && exp * 1000 < Date.now()) return null;
    if (typeof sub !== "string" || typeof email !== "string") return null;
    if (role !== "teacher" && role !== "student") return null;

    return { sub, email, role };
  } catch {
    return null;
  }
}
