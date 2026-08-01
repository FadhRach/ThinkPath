import { apiFetchBrowser } from "./api-browser";
import { clearAuthTokenCookie, setAuthTokenCookie } from "./auth-token";
import type { AuthResponse, Role } from "./types";

export interface RegisterInput {
  email: string;
  password: string;
  display_name: string;
  role: Role;
}

export async function login(email: string, password: string): Promise<AuthResponse> {
  const result = await apiFetchBrowser<AuthResponse>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  setAuthTokenCookie(result.token);
  return result;
}

export async function register(input: RegisterInput): Promise<AuthResponse> {
  const result = await apiFetchBrowser<AuthResponse>("/api/auth/register", {
    method: "POST",
    body: JSON.stringify(input),
  });
  setAuthTokenCookie(result.token);
  return result;
}

export function logout(): void {
  clearAuthTokenCookie();
}

export function homePathForRole(role: Role): string {
  return role === "teacher" ? "/dashboard" : "/student";
}
