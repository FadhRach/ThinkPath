export type Urgency = "overdue" | "soon" | "later" | "none";

const SOON_MS = 48 * 60 * 60 * 1000;

/** Seberapa mendesak sebuah tenggat: lewat, kurang dari 48 jam, masih lama, atau tanpa tenggat. */
export function urgencyOf(deadline: string | null, now: number = Date.now()): Urgency {
  if (!deadline) return "none";
  const left = new Date(deadline).getTime() - now;
  if (left < 0) return "overdue";
  return left < SOON_MS ? "soon" : "later";
}
