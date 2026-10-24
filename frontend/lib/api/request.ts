// Inti fetcher yang dipakai server (server.ts), browser (browser.ts), dan unggahan
// langsung (direct.ts), tanpa menyeret import next/headers ke client bundle. Sisi-sisi itu
// hanya berbeda pada sumber token, alamat tujuan, dan kebijakan cache/401.

import { ApiConfigurationError, ApiError, NetworkError } from "./errors";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL;

export function joinUrl(base: string, path: string): string {
  return `${base.replace(/\/$/, "")}/${path.replace(/^\//, "")}`;
}

/** Header standar: JSON, kecuali FormData (peramban mengisi boundary multipart sendiri). */
export function buildHeaders(init: RequestInit, token?: string | null): Headers {
  const headers = new Headers(init.headers);
  headers.set("Accept", "application/json");
  if (!headers.has("Content-Type") && init.body && !(init.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }
  if (token) headers.set("Authorization", `Bearer ${token}`);
  return headers;
}

/**
 * Di browser maupun di Node, fetch menolak dengan TypeError bila permintaan gagal di
 * tingkat jaringan. Galat lain, termasuk sinyal internal Next.js, diteruskan apa adanya.
 */
export function withNetworkErrors(request: Promise<Response>): Promise<Response> {
  return request.catch((error: unknown) => {
    throw error instanceof TypeError ? new NetworkError(error) : error;
  });
}

/** Kirim request ke backend dengan header standar + Bearer token bila ada. */
export function fetchApi(path: string, init: RequestInit, token: string | null): Promise<Response> {
  if (!BACKEND_URL) {
    throw new ApiConfigurationError();
  }
  return withNetworkErrors(
    fetch(joinUrl(BACKEND_URL, path), { ...init, headers: buildHeaders(init, token) }),
  );
}

export async function parseResponseBody(response: Response): Promise<unknown> {
  const isJson = response.headers.get("content-type")?.includes("application/json");
  return isJson ? response.json() : response.text();
}

/** Baca body respons; non-2xx dilempar sebagai ApiError. */
export async function resolveJson<T>(response: Response): Promise<T> {
  const body = await parseResponseBody(response);
  if (!response.ok) {
    // URL ikut di pesan supaya log server menyebut endpoint mana yang gagal;
    // pesan ini tidak pernah ditampilkan ke pengguna.
    throw new ApiError(response.status, body, `API error ${response.status} ${response.url}`);
  }
  return body as T;
}
