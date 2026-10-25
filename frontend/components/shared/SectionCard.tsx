import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface SectionCardProps {
  eyebrow: string;
  className?: string;
  children: React.ReactNode;
}

/** Kartu seksi standar: judul kecil berwarna aksen di atas isi. */
export function SectionCard({ eyebrow, className, children }: SectionCardProps) {
  return (
    <Card variant="raised" className={cn("space-y-3 p-5", className)}>
      <p className="caption-eyebrow text-brand-ink">{eyebrow}</p>
      {children}
    </Card>
  );
}
