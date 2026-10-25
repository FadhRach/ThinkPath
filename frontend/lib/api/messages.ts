import {
  ApiConfigurationError,
  ApiError,
  CONFIGURATION_ERROR_MESSAGE,
  NETWORK_ERROR_MESSAGE,
  NetworkError,
  SERVER_ERROR_MESSAGE,
} from "./errors";

// DRF mengembalikan {"detail": "..."} untuk error umum, dan pesan dari validate()
// serializer di {"non_field_errors": [...]}. Respons validasi 400 juga dapat
// menyimpan pesan di field, misalnya {"email": ["Email sudah terdaftar."]}.
function backendMessage(body: unknown, includeFieldErrors = false): string | null {
  if (typeof body !== "object" || body === null) {
    return null;
  }
  // ValidationError("pesan") di view DRF dibalas sebagai ["pesan"], tanpa kunci.
  if (Array.isArray(body)) {
    return typeof body[0] === "string" ? body[0] : null;
  }
  const { detail, non_field_errors: nonField } = body as {
    detail?: unknown;
    non_field_errors?: unknown;
  };
  if (typeof detail === "string") {
    return detail;
  }
  if (Array.isArray(nonField) && typeof nonField[0] === "string") {
    return nonField[0];
  }
  if (includeFieldErrors) {
    // DRF puts registration errors such as an existing email under the field
    // name. Keep the backend's actionable message instead of a generic failure.
    for (const value of Object.values(body)) {
      if (Array.isArray(value) && typeof value[0] === "string") {
        return value[0];
      }
    }
  }
  return null;
}

/** Pesan yang aman ditampilkan ke pengguna untuk galat apa pun dari lapisan API. */
export function getApiErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiConfigurationError) {
    return CONFIGURATION_ERROR_MESSAGE;
  }
  if (error instanceof NetworkError) {
    return NETWORK_ERROR_MESSAGE;
  }
  if (error instanceof ApiError) {
    const message = backendMessage(error.body, error.status === 400);
    if (message) {
      return message;
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
