interface Props {
  signals: string[] | null;
  /** Baris yang sudah tampil di panel lain (misalnya bukti di Asal Skor AI). */
  exclude?: string[];
}

/**
 * Temuan singkat dari analisis. Pada jalur heuristik dua baris pertamanya
 * adalah bukti sinyal skor AI yang sama persis dengan panel Asal Skor AI, jadi
 * baris yang sudah tampil di sana dibuang agar tidak dibaca dua kali.
 */
export function uniqueSignals(signals: string[] | null, exclude: string[] = []): string[] {
  if (!Array.isArray(signals)) return [];
  const seen = new Set(exclude.map((line) => line.trim()));
  return signals.filter((signal) => signal.trim() && !seen.has(signal.trim()));
}

export function SignalList({ signals, exclude }: Props) {
  const items = uniqueSignals(signals, exclude);
  if (items.length === 0) {
    return (
      <p className="text-body-sm text-muted-foreground">
        Sinyal teks belum tersedia. Klik Analisis Ulang untuk menghitungnya.
      </p>
    );
  }
  return (
    <ul className="space-y-2">
      {items.map((signal) => (
        <li key={signal} className="flex items-start gap-2 text-body-sm text-foreground">
          <span className="mt-1.5 block h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
          {signal}
        </li>
      ))}
    </ul>
  );
}
