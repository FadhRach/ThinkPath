// Token login disimpan di cookie biasa (bukan httpOnly) agar bisa dibaca
// client component maupun server component. Cukup untuk MVP.
//
// Batas yang perlu diketahui: karena bukan httpOnly, skrip mana pun di halaman
// ini bisa membacanya, sehingga XSS berarti token terambil. Memperbaikinya
// menuntut pemindahan sesi ke sisi server, bukan tambalan di berkas ini.
export const AUTH_COOKIE_NAME = "thinkpath_token";

const COOKIE_MAX_AGE_SECONDS = 7 * 24 * 60 * 60;

/**
 * Flag `secure` hanya dipasang di HTTPS.
 *
 * Tanpa penjagaan ini, cookie tidak akan pernah tersimpan saat pengembangan
 * lokal lewat http://localhost, dan login akan gagal secara membingungkan.
 * Di produksi (Vercel selalu HTTPS) flag ini aktif, sehingga peramban menolak
 * mengirim token lewat koneksi HTTP polos.
 */
function cookieFlags(): string {
  const secure =
    typeof window !== "undefined" && window.location.protocol === "https:"
      ? "; secure"
      : "";
  return `path=/; samesite=lax${secure}`;
}

export function setAuthTokenCookie(token: string): void {
  document.cookie = `${AUTH_COOKIE_NAME}=${token}; ${cookieFlags()}; max-age=${COOKIE_MAX_AGE_SECONDS}`;
}

export function clearAuthTokenCookie(): void {
  document.cookie = `${AUTH_COOKIE_NAME}=; ${cookieFlags()}; max-age=0`;
}

export function readAuthTokenFromBrowser(): string | null {
  const match = document.cookie
    .split("; ")
    .find((entry) => entry.startsWith(`${AUTH_COOKIE_NAME}=`));
  return match ? match.slice(AUTH_COOKIE_NAME.length + 1) : null;
}
