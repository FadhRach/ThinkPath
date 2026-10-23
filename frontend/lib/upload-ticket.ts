import { apiFetchBrowser } from "./api-browser";
import { fetchApi } from "./api-shared";

// Fungsi Vercel membatasi badan permintaan 4,5 MB, sedangkan dokumen bisa 10 MB
// dan audio 5 MB. Untuk berkas besar, jembatan /bff menerbitkan tiket pendek
// yang hanya diterima endpoint unggah/ambil berkas, lalu browser berbicara
// langsung ke API. Tiket tidak bisa dipakai untuk apa pun selain itu.
interface Ticket {
  value: string;
  expiresAt: number;
}

let cached: Ticket | null = null;
// Tiket diganti sedikit sebelum habis supaya unggahan lama tidak ditolak di tengah jalan.
const REFRESH_MARGIN_MS = 60_000;

async function ticket(force = false): Promise<string> {
  if (!force && cached && cached.expiresAt - REFRESH_MARGIN_MS > Date.now()) return cached.value;
  const issued = await apiFetchBrowser<{ ticket: string; expires_in: number }>(
    "/api/auth/upload-ticket",
    { method: "POST" },
  );
  cached = { value: issued.ticket, expiresAt: Date.now() + issued.expires_in * 1000 };
  return cached.value;
}

/** Panggilan langsung ke API dengan tiket; satu kali ulang bila tiket ditolak (mis. sesi baru). */
export async function directFetch(path: string, init: RequestInit = {}): Promise<Response> {
  let response = await fetchApi(path, init, await ticket());
  if (response.status === 401) {
    response = await fetchApi(path, init, await ticket(true));
  }
  return response;
}

export function forgetUploadTicket(): void {
  cached = null;
}
