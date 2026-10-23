import { NetworkError, resolveJson } from "./api-shared";

// Semua panggilan API dari browser lewat jembatan same-origin /bff, yang
// menyisipkan token dari cookie HttpOnly. Browser tidak memegang token.
// Hanya unggahan besar yang langsung ke API, dengan tiket (lib/upload-ticket.ts).
export const BFF_PREFIX = "/bff";

export function bffFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  headers.set("Accept", "application/json");
  // FormData: biarkan peramban mengisi Content-Type beserta boundary multipart.
  if (!headers.has("Content-Type") && init.body && !(init.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }
  return fetch(`${BFF_PREFIX}${path}`, { ...init, headers, credentials: "same-origin" }).catch(
    (error: unknown) => {
      throw error instanceof TypeError ? new NetworkError(error) : error;
    },
  );
}

export async function apiFetchBrowser<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  return resolveJson<T>(await bffFetch(path, init));
}
