interface Props {
  signals: Record<string, number> | null;
}

const SIGNAL_LABELS: Record<string, string> = {
  perplexity: "Perplexity",
  burstiness: "Burstiness",
  style_deviation: "Deviasi gaya",
};

export function SignalList({ signals }: Props) {
  if (!signals || Object.keys(signals).length === 0) {
    return (
      <p className="text-body-sm text-ink-muted">
        Sinyal teks belum tersedia untuk tugas ini.
      </p>
    );
  }
  return (
    <ul className="grid grid-cols-3 gap-3 text-body-sm">
      {Object.entries(signals).map(([key, value]) => (
        <li key={key} className="border border-border rounded-card p-3 bg-paper">
          <p className="caption-eyebrow">{SIGNAL_LABELS[key] ?? key}</p>
          <p className="text-ink mt-1 font-display text-display-2">{value}</p>
        </li>
      ))}
    </ul>
  );
}
