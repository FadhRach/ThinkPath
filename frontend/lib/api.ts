import { createSupabaseServerClient } from "./supabase/server";

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

async function getAccessToken(): Promise<string | null> {
  const supabase = createSupabaseServerClient();
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

function joinUrl(base: string, path: string): string {
  return `${base.replace(/\/$/, "")}/${path.replace(/^\//, "")}`;
}

export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  if (!BACKEND_URL) {
    throw new Error("NEXT_PUBLIC_BACKEND_URL belum diset.");
  }

  const token = await getAccessToken();
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

  const isJson = response.headers.get("content-type")?.includes("application/json");
  const body = isJson ? await response.json() : await response.text();

  if (!response.ok) {
    throw new ApiError(response.status, body);
  }

  return body as T;
}
