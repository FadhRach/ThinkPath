export function AuthDivider({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 text-ink-muted">
      <div className="flex-1 h-px bg-border" />
      <span className="caption-eyebrow">{label}</span>
      <div className="flex-1 h-px bg-border" />
    </div>
  );
}
