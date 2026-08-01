// Token login disimpan di cookie biasa (bukan httpOnly) agar bisa dibaca
// client component maupun server component. Cukup untuk MVP.
export const AUTH_COOKIE_NAME = "thinkpath_token";

const COOKIE_MAX_AGE_SECONDS = 7 * 24 * 60 * 60;

export function setAuthTokenCookie(token: string): void {
  document.cookie = `${AUTH_COOKIE_NAME}=${token}; path=/; max-age=${COOKIE_MAX_AGE_SECONDS}; samesite=lax`;
}

export function clearAuthTokenCookie(): void {
  document.cookie = `${AUTH_COOKIE_NAME}=; path=/; max-age=0; samesite=lax`;
}

export function readAuthTokenFromBrowser(): string | null {
  const match = document.cookie
    .split("; ")
    .find((entry) => entry.startsWith(`${AUTH_COOKIE_NAME}=`));
  return match ? match.slice(AUTH_COOKIE_NAME.length + 1) : null;
}
