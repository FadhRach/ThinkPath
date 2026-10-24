import { apiFetchBrowser } from "@/lib/api/browser";
import { ApiError } from "@/lib/api/errors";
import { PRIVACY_POLICY_VERSION } from "@/lib/privacy";
import type { AuthResponse, Role } from "@/lib/types";

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
 * menjaga backend versi lama yang belum memeriksa peran.
 */
export async function login(email: string, password: string, role: Role): Promise<AuthResponse> {
  const result = await apiFetchBrowser<AuthResponse>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password, role }),
  });
  if (result.profile.role !== role) {
    throw new ApiError(403, { detail: roleMismatchMessage(result.profile.role) });
  }
  return result;
}

/** Mendaftar sekaligus menyetujui Kebijakan Privasi; server mencatat buktinya di transaksi yang sama. */
export async function register(input: RegisterInput & { agreed: boolean }): Promise<AuthResponse> {
  const { agreed, ...fields } = input;
  // Persetujuan yang dicatat server harus benar-benar berasal dari centang;
  // bukan nilai tetap yang lolos bila tombol terbuka karena refaktor.
  if (!agreed) {
    throw new ApiError(400, { detail: "Setujui Kebijakan Privasi untuk membuat akun." });
  }
  return apiFetchBrowser<AuthResponse>("/api/auth/register", {
    method: "POST",
    body: JSON.stringify({
      ...fields,
      accept_policy: true,
      policy_version: PRIVACY_POLICY_VERSION,
    }),
  });
}

/** Mencabut sesi di server lalu menghapus cookie (jembatan /bff yang menghapusnya). */
export async function logout(): Promise<void> {
  try {
    await apiFetchBrowser<void>("/api/auth/logout", { method: "POST" });
  } catch {
    // Sesi mungkin sudah berakhir; cookie tetap dihapus oleh jembatan.
  }
}

export function homePathForRole(role: Role): string {
  return role === "teacher" ? "/dashboard" : "/student";
}
