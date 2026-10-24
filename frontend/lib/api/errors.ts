// Galat yang dilempar lapisan API dan teks bakunya. Modul ini sengaja tanpa impor
// supaya bisa dipakai di server, browser, maupun tes tanpa membawa apa pun.

// Pesan untuk galat yang bukan kesalahan pengguna. Pesan cadangan tiap form
// menyuruh memeriksa isian, dan itu menyesatkan ketika isiannya benar tetapi
// server atau jaringannya yang bermasalah.
export const SERVER_ERROR_MESSAGE =
  "Server ThinkPath sedang bermasalah. Coba lagi beberapa saat lagi.";
export const NETWORK_ERROR_MESSAGE =
  "Tidak dapat menghubungi server ThinkPath. Periksa koneksi internet, lalu coba lagi.";
export const CONFIGURATION_ERROR_MESSAGE =
  "Layanan ThinkPath belum terhubung. Hubungi pengelola aplikasi.";

export class ApiConfigurationError extends Error {
  constructor() {
    super("NEXT_PUBLIC_BACKEND_URL belum diset.");
    this.name = "ApiConfigurationError";
  }
}

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
