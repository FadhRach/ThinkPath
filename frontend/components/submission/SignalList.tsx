interface Props {
  signals: string[] | null;
}

export function SignalList({ signals }: Props) {
  if (!Array.isArray(signals) || signals.length === 0) {
    return (
      <p className="text-body-sm text-muted-foreground">
        Sinyal teks belum tersedia. Klik Analisis Ulang untuk menghitungnya.
      </p>
    );
  }
  return (
    <ul className="space-y-2">
      {signals.map((signal) => (
        <li key={signal} className="flex items-start gap-2 text-body-sm text-foreground">
          <span className="mt-1.5 block h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
          {signal}
        </li>
      ))}
    </ul>
  );
}
