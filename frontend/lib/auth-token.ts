// Nama cookie sesi. Cookie ini HttpOnly dan hanya ditulis oleh jembatan
// /bff (app/bff/[...path]/route.ts); JavaScript di browser tidak bisa
// membacanya. Komponen server membacanya lewat next/headers.
export const AUTH_COOKIE_NAME = "thinkpath_token";

// Sama dengan masa berlaku sesi di backend (AUTH_TOKEN_LIFETIME_DAYS).
export const AUTH_COOKIE_MAX_AGE_SECONDS = 7 * 24 * 60 * 60;
