import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface Props {
  eyebrow: string;
  className?: string;
  children: React.ReactNode;
}

/** Kartu seksi standar: eyebrow kecil berwarna primary di atas isi. */
export function SectionCard({ eyebrow, className, children }: Props) {
  return (
    <Card className={cn("space-y-3 p-5 shadow-soft", className)}>
      <p className="caption-eyebrow text-primary">{eyebrow}</p>
      {children}
    </Card>
  );
}
