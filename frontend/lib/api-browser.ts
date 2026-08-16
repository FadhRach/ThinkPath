import { fetchApi, resolveJson } from "./api-shared";
import { readAuthTokenFromBrowser } from "./auth-token";

// Fetcher sisi client (lib/api.ts server-only karena memakai next/headers).
// Dipakai oleh client component untuk mutasi.
export async function apiFetchBrowser<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const response = await fetchApi(path, init, readAuthTokenFromBrowser());
  return resolveJson<T>(response);
}
