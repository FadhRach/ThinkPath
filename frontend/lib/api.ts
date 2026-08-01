import { cookies } from "next/headers";

import { ApiError, joinUrl, parseResponseBody } from "./api-shared";
import { AUTH_COOKIE_NAME } from "./auth-token";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL;

export { ApiError };

export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  if (!BACKEND_URL) {
    throw new Error("NEXT_PUBLIC_BACKEND_URL belum diset.");
  }

  const token = cookies().get(AUTH_COOKIE_NAME)?.value ?? null;
  const headers = new Headers(init.headers);
  headers.set("Accept", "application/json");
  if (!headers.has("Content-Type") && init.body) {
    headers.set("Content-Type", "application/json");
  }
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const response = await fetch(joinUrl(BACKEND_URL, path), {
    ...init,
    headers,
    cache: "no-store",
  });

  const body = await parseResponseBody(response);

  if (!response.ok) {
    throw new ApiError(response.status, body);
  }

  return body as T;
}
