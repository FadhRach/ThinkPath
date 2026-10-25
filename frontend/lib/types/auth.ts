import type { EducationLevel, Role } from "./common";

export interface Profile {
  id: string;
  email: string;
  display_name: string | null;
  role: Role;
  education_level: EducationLevel | "" | null;
  created_at: string;
}

export interface AuthResponse {
  profile: Profile;
}

export type ConsentState = "given" | "withdrawn" | "outdated" | "none";

export type ConsentActionKind = "given" | "updated" | "withdrawn";

export interface ConsentHistoryEntry {
  id: string;
  action: ConsentActionKind;
  policy_version: string;
  items: string[];
  /** Asal catatan: register, reaccept, withdraw, seed; kosong pada data lama. */
  source: string;
  created_at: string;
}

export interface DeletionImpact {
  role: Role;
  classes: number;
  submissions: number;
  files: number;
  /** Hanya dosen. */
  students?: number;
}

/** Keadaan persetujuan pemrosesan data pribadi beserta rekam jejaknya. */
export interface ConsentStatus {
  current_version: string;
  status: ConsentState;
  items: string[];
  given_at: string | null;
  history: ConsentHistoryEntry[];
}

/** Balasan saat persetujuan diberikan atau ditarik: token lama sudah usang. */
// Token tidak ada di sini: jembatan /bff memindahkannya ke cookie HttpOnly.
export interface ConsentChangeResponse {
  consent: ConsentStatus;
}
