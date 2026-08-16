import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { ApiError, fetchApi, resolveJson } from "./api-shared";
import { AUTH_COOKIE_NAME } from "./auth-token";

export { ApiError };

// Fetcher sisi server (server component). Selalu no-store: data penilaian
// harus segar; kecepatan navigasi ditangani loading.tsx + staleTimes router.
export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = cookies().get(AUTH_COOKIE_NAME)?.value ?? null;
  const response = await fetchApi(path, { ...init, cache: "no-store" }, token);

  if (response.status === 401) {
    // Token kedaluwarsa/tidak sah di tengah sesi: langsung ke login, bukan
    // halaman error. Aman karena fetcher ini hanya dipakai server component.
    redirect("/login");
  }

  return resolveJson<T>(response);
}
