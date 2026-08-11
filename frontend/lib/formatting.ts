export const BLOOM_LABELS: Record<number, string> = {
  1: "Mengingat",
  2: "Memahami",
  3: "Mengaplikasikan",
  4: "Menganalisis",
  5: "Mengevaluasi",
  6: "Mencipta",
};

export function formatDurationSeconds(seconds: number | null): string {
  if (seconds === null || seconds === undefined) return "-";
  if (seconds < 60) return `${seconds} dtk`;
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  if (minutes < 60) return rest === 0 ? `${minutes} mnt` : `${minutes} mnt ${rest} dtk`;
  const hours = Math.floor(minutes / 60);
  const restMin = minutes % 60;
  return restMin === 0 ? `${hours} jam` : `${hours} jam ${restMin} mnt`;
}

// Tiap entri: [pembagi, unit hasil setelah dibagi]. Mulai dari detik.
const RELATIVE_RANGES: Array<[number, Intl.RelativeTimeFormatUnit]> = [
  [60, "minute"],
  [60, "hour"],
  [24, "day"],
  [7, "week"],
  [4.345, "month"],
  [12, "year"],
];

export function formatRelativeTime(iso: string | null): string {
  if (!iso) return "-";
  const formatter = new Intl.RelativeTimeFormat("id", { numeric: "auto" });
  const diffSeconds = (Date.now() - new Date(iso).getTime()) / 1000;
  let duration = diffSeconds;
  let unit: Intl.RelativeTimeFormatUnit = "second";
  for (const [step, nextUnit] of RELATIVE_RANGES) {
    if (Math.abs(duration) < step) break;
    duration = duration / step;
    unit = nextUnit;
  }
  return formatter.format(-Math.round(duration), unit);
}

export function formatClockHHMM(iso: string | null): string {
  if (!iso) return "-";
  return new Date(iso).toLocaleTimeString("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Tanggal singkat untuk sumbu waktu, misalnya "12 Mei 2026". */
export function formatDate(iso: string | null): string {
  if (!iso) return "-";
  return new Date(iso).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}
