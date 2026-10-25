import { buildHeaders, resolveJson, withNetworkErrors } from "./request";

// Semua panggilan API dari browser lewat jembatan same-origin /bff, yang
// menyisipkan token dari cookie HttpOnly. Browser tidak memegang token.
// Hanya unggahan besar yang langsung ke API, dengan tiket (direct.ts).
const BFF_PREFIX = "/bff";

function bffFetch(path: string, init: RequestInit = {}): Promise<Response> {
  return withNetworkErrors(
    fetch(`${BFF_PREFIX}${path}`, {
      ...init,
      headers: buildHeaders(init),
      credentials: "same-origin",
    }),
  );
}

export async function apiFetchBrowser<T>(path: string, init: RequestInit = {}): Promise<T> {
  return resolveJson<T>(await bffFetch(path, init));
}
