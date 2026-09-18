import { apiFetchBrowser } from "./api-browser";
import { ApiError } from "./api-shared";
import { clearAuthTokenCookie, setAuthTokenCookie } from "./auth-token";
import type { AuthResponse, Role } from "./types";

const ROLE_NAME: Record<Role, string> = { teacher: "dosen", student: "mahasiswa" };
const ROLE_OPTION: Record<Role, string> = { teacher: "Dosen", student: "Mahasiswa" };

/** Sama persis dengan pesan backend, supaya kedua penjaga terbaca seragam. */
function roleMismatchMessage(accountRole: Role): string {
  return `Akun ini terdaftar sebagai ${ROLE_NAME[accountRole]}. Pilih peran ${ROLE_OPTION[accountRole]} untuk masuk.`;
}

export interface RegisterInput {
  email: string;
  password: string;
  display_name: string;
  role: Role;
}

/**
 * Login dengan peran yang dipilih di layar.
 *
 * Backend menolak peran yang tidak cocok dengan 403. Pemeriksaan kedua di sini
 * menjaga backend versi lama yang belum memeriksa peran: token tidak disimpan,
 * sehingga tidak ada sesi yang terbentuk untuk peran yang salah.
 */
export async function login(
  email: string,
  password: string,
  role: Role,
): Promise<AuthResponse> {
  const result = await apiFetchBrowser<AuthResponse>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password, role }),
  });
  if (result.profile.role !== role) {
    throw new ApiError(403, { detail: roleMismatchMessage(result.profile.role) });
  }
  setAuthTokenCookie(result.token);
  return result;
}

export async function register(input: RegisterInput): Promise<AuthResponse> {
  const result = await apiFetchBrowser<AuthResponse>("/api/auth/register", {
    method: "POST",
    body: JSON.stringify(input),
  });
  setAuthTokenCookie(result.token);
  return result;
}

export function logout(): void {
  clearAuthTokenCookie();
}

export function homePathForRole(role: Role): string {
  return role === "teacher" ? "/dashboard" : "/student";
}
