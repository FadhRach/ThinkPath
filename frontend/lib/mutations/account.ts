import { apiFetchBrowser } from "@/lib/api/browser";
import { PRIVACY_POLICY_VERSION } from "@/lib/privacy";
import type { ConsentChangeResponse, DeletionImpact, EducationLevel, Profile } from "@/lib/types";

export interface UpdateProfileInput {
  display_name?: string;
  education_level?: EducationLevel;
}

/** Email dan peran sengaja tidak bisa diubah dari sini: keduanya menjadi dasar
 *  kepemilikan kelas dan submission yang sudah tersimpan. */
export function updateProfile(input: UpdateProfileInput) {
  return apiFetchBrowser<Profile>("/api/me", {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

/**
 * Menyetujui ulang versi kebijakan yang berlaku (akun lama, versi baru, atau
 * setelah ditarik). Pendaftaran baru menyetujui lewat form daftar. Jembatan /bff
 * memasang token baru ke cookie karena klaim persetujuan di token lama sudah
 * usang, dan layout membaca klaim itu untuk memutuskan perlu tidaknya layar persetujuan.
 */
export async function giveConsent() {
  const result = await apiFetchBrowser<ConsentChangeResponse>("/api/me/consent", {
    method: "POST",
    body: JSON.stringify({ policy_version: PRIVACY_POLICY_VERSION }),
  });
  return result.consent;
}

/** Menarik persetujuan. Pemrosesan baru berhenti seketika di server. */
export async function withdrawConsent() {
  const result = await apiFetchBrowser<ConsentChangeResponse>("/api/me/consent/withdraw", {
    method: "POST",
  });
  return result.consent;
}

/** Mengganti kata sandi; sesi di perangkat lain dicabut server, sesi ini tetap. */
export function changePassword(currentPassword: string, newPassword: string) {
  return apiFetchBrowser<{ detail: string }>("/api/me/password", {
    method: "POST",
    body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }),
  });
}

export function fetchDeletionImpact() {
  return apiFetchBrowser<DeletionImpact>("/api/me/deletion-impact");
}

/** Menghapus akun beserta datanya; tidak bisa dibatalkan. Jembatan /bff menghapus cookie sesi. */
export function deleteAccount(password: string, confirm: string) {
  return apiFetchBrowser<void>("/api/me", {
    method: "DELETE",
    body: JSON.stringify({ password, confirm }),
  });
}

/** Minta tautan atur ulang sandi. Jawaban sama untuk email terdaftar atau tidak. */
export function requestPasswordReset(email: string) {
  return apiFetchBrowser<{ detail: string }>("/api/auth/password-reset", {
    method: "POST",
    body: JSON.stringify({ email }),
  });
}

export function confirmPasswordReset(token: string, newPassword: string) {
  return apiFetchBrowser<{ detail: string }>("/api/auth/password-reset/confirm", {
    method: "POST",
    body: JSON.stringify({ token, new_password: newPassword }),
  });
}
