import { cache } from "react";

import { apiFetch } from "@/lib/api/server";
import type { ConsentStatus, Profile } from "@/lib/types";

// Dibungkus React cache() supaya layout + page dalam satu render berbagi satu
// request /api/me, bukan memanggilnya dua kali.
export const getMe = cache(() => apiFetch<Profile>("/api/me"));

export function getConsent() {
  return apiFetch<ConsentStatus>("/api/me/consent");
}
