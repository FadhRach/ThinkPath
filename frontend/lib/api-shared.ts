// Inti fetcher yang dipakai server (lib/api.ts) maupun browser
// (lib/api-browser.ts), tanpa menyeret import next/headers ke client bundle.
// Kedua sisi hanya berbeda pada sumber token dan kebijakan cache/401.

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL;

// Pesan untuk galat yang bukan kesalahan pengguna. Pesan cadangan tiap form
// menyuruh memeriksa isian, dan itu menyesatkan ketika isiannya benar tetapi
// server atau jaringannya yang bermasalah.
export const SERVER_ERROR_MESSAGE =
  "Server ThinkPath sedang bermasalah. Coba lagi beberapa saat lagi.";
export const NETWORK_ERROR_MESSAGE =
  "Tidak dapat menghubungi server ThinkPath. Periksa koneksi internet, lalu coba lagi.";

export class ApiError extends Error {
  status: number;
  body: unknown;

  constructor(status: number, body: unknown, message?: string) {
    super(message ?? `API error ${status}`);
    this.status = status;
    this.body = body;
  }
}

/** Permintaan tidak sampai ke backend, jadi tidak ada respons untuk dibaca. */
export class NetworkError extends Error {
  constructor(cause: unknown) {
    super(NETWORK_ERROR_MESSAGE, { cause });
    this.name = "NetworkError";
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

  // Di browser maupun di Node, fetch menolak dengan TypeError bila permintaan
  // gagal di tingkat jaringan. Galat lain, termasuk sinyal internal Next.js,
  // diteruskan apa adanya.
  return fetch(joinUrl(BACKEND_URL, path), { ...init, headers }).catch(
    (error: unknown) => {
      throw error instanceof TypeError ? new NetworkError(error) : error;
    },
  );
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
  if (error instanceof NetworkError) {
    return NETWORK_ERROR_MESSAGE;
  }
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
    // 5xx tanpa detail berasal dari galat tak tertangani di Django atau dari
    // platform hosting, misalnya tabel yang migrasinya belum dijalankan.
    if (error.status >= 500) {
      return SERVER_ERROR_MESSAGE;
    }
  }
  return fallback;
}
