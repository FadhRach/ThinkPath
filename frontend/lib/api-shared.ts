// Inti fetcher yang dipakai server (lib/api.ts) maupun browser
// (lib/api-browser.ts), tanpa menyeret import next/headers ke client bundle.
// Kedua sisi hanya berbeda pada sumber token dan kebijakan cache/401.

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL;

export class ApiError extends Error {
  status: number;
  body: unknown;

  constructor(status: number, body: unknown, message?: string) {
    super(message ?? `API error ${status}`);
    this.status = status;
    this.body = body;
  }
}

export function joinUrl(base: string, path: string): string {
  return `${base.replace(/\/$/, "")}/${path.replace(/^\//, "")}`;
}

export async function parseResponseBody(response: Response): Promise<unknown> {
  const isJson = response.headers.get("content-type")?.includes("application/json");
  return isJson ? response.json() : response.text();
}

/** Kirim request ke backend dengan header standar + Bearer token bila ada. */
export function fetchApi(
  path: string,
  init: RequestInit,
  token: string | null,
): Promise<Response> {
  if (!BACKEND_URL) {
    throw new Error("NEXT_PUBLIC_BACKEND_URL belum diset.");
  }

  const headers = new Headers(init.headers);
  headers.set("Accept", "application/json");
  if (!headers.has("Content-Type") && init.body) {
    headers.set("Content-Type", "application/json");
  }
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  return fetch(joinUrl(BACKEND_URL, path), { ...init, headers });
}

/** Baca body respons; non-2xx dilempar sebagai ApiError. */
export async function resolveJson<T>(response: Response): Promise<T> {
  const body = await parseResponseBody(response);
  if (!response.ok) {
    throw new ApiError(response.status, body);
  }
  return body as T;
}

// DRF mengembalikan {"detail": "..."} untuk error umum; error validasi per-field
// tidak diterjemahkan dan diwakili pesan fallback berbahasa Indonesia.
export function getApiErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiError) {
    const body = error.body;
    if (
      typeof body === "object" &&
      body !== null &&
      "detail" in body &&
      typeof (body as { detail: unknown }).detail === "string"
    ) {
      return (body as { detail: string }).detail;
    }
    if (error.status === 401) {
      return "Sesi login berakhir. Masuk ulang terlebih dahulu.";
    }
  }
  return fallback;
}
