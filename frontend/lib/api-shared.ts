// Dipisah dari api.ts agar bisa dipakai fetcher server maupun browser
// tanpa menyeret import next/headers ke client bundle.

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
