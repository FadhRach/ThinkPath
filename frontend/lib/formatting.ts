/**
 * Zona waktu tampilan, dipaku dan tidak mengikuti mesin yang merender.
 *
 * Backend menyimpan dan mengirim seluruh waktu dalam UTC (USE_TZ=True,
 * TIME_ZONE="UTC"). Sebelumnya frontend memformatnya tanpa menyebut zona, jadi
 * hasilnya mengikuti zona proses yang kebetulan menjalankannya. Di laptop
 * pengembang yang ber-UTC+7 hasilnya benar; di Vercel yang ber-UTC hasilnya
 * meleset tujuh jam, dan bug itu baru muncul setelah dideploy.
 *
 * Untuk produk ini akibatnya bukan kosmetik. Seluruh pembacaan forensik proses
 * bergantung pada jam yang benar: pengumpulan pukul 02.37 dini hari akan tampil
 * 19.37 dan terlihat wajar, sedangkan pengumpulan pukul 09.00 tampil 02.00 dan
 * terlihat mencurigakan padahal tidak. Sistem akan menyajikan bukti keliru
 * tentang seorang mahasiswa.
 *
 * Dipaku ke satu zona, bukan mengikuti peramban, supaya dosen dan mahasiswa
 * membaca jam yang sama persis ketika membicarakan satu submission. Kampus di
 * WITA atau WIT dapat menggantinya lewat NEXT_PUBLIC_DISPLAY_TIME_ZONE.
 */
export const DISPLAY_TIME_ZONE =
  process.env.NEXT_PUBLIC_DISPLAY_TIME_ZONE || "Asia/Jakarta";

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
    timeZone: DISPLAY_TIME_ZONE,
  });
}

/** Tanggal singkat untuk sumbu waktu, misalnya "12 Mei 2026". */
export function formatDate(iso: string | null): string {
  if (!iso) return "-";
  return new Date(iso).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: DISPLAY_TIME_ZONE,
  });
}

/** Tanggal panjang untuk sapaan, misalnya "Kamis, 13 Agustus 2026". */
export function formatDateLong(date: Date = new Date()): string {
  return date.toLocaleDateString("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: DISPLAY_TIME_ZONE,
  });
}

/**
 * Selisih zona tampilan terhadap UTC pada satu titik waktu, dalam milidetik.
 *
 * Dihitung lewat Intl, bukan lewat angka tetap, supaya tetap benar kalau
 * NEXT_PUBLIC_DISPLAY_TIME_ZONE diganti ke zona yang mengenal waktu musim
 * panas. Indonesia tidak mengenalnya, jadi di setelan bawaan hasilnya selalu
 * tepat.
 */
function zoneOffsetMs(instant: Date): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: DISPLAY_TIME_ZONE,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(instant);

  const at: Record<string, number> = {};
  for (const part of parts) {
    if (part.type !== "literal") at[part.type] = Number(part.value);
  }
  // Sebagian mesin menuliskan tengah malam sebagai jam 24.
  const asIfUtc = Date.UTC(
    at.year,
    at.month - 1,
    at.day,
    at.hour % 24,
    at.minute,
    at.second,
  );
  // Milidetik dibuang dari kedua sisi. Date.UTC selalu menghasilkan milidetik
  // nol, jadi membandingkannya langsung dengan getTime() akan meleset sebesar
  // komponen milidetik masukan.
  return asIfUtc - (instant.getTime() - instant.getUTCMilliseconds());
}

/**
 * ISO UTC menjadi nilai untuk `<input type="datetime-local">`.
 *
 * Locale sv-SE dipakai karena keluarannya sudah berbentuk "YYYY-MM-DD HH.MM",
 * jadi tinggal dirapikan alih alih dirangkai potongan demi potongan.
 */
export function formatDateTimeInput(iso: string | null): string {
  if (!iso) return "";
  const formatted = new Intl.DateTimeFormat("sv-SE", {
    timeZone: DISPLAY_TIME_ZONE,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
  return formatted.replace(" ", "T").replace(".", ":");
}

/**
 * Kebalikannya: isi `<input type="datetime-local">` menjadi ISO UTC.
 *
 * Nilai input tidak menyebut zona, dan `new Date()` akan menafsirkannya sebagai
 * zona peramban. Itu keliru begitu dosen membuka aplikasi dari zona lain:
 * jadwal yang ia ketik akan tersimpan bergeser dari jam yang tertulis di
 * layarnya sendiri. Di sini nilainya ditafsirkan sebagai waktu dinding pada
 * zona tampilan, sama dengan yang dipakai seluruh layar lain.
 */
export function parseDateTimeInput(local: string): string {
  const naive = new Date(`${local}:00.000Z`);
  return new Date(naive.getTime() - zoneOffsetMs(naive)).toISOString();
}
