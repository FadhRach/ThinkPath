import { Badge } from "@/components/ui/badge";
import { formatDateLong } from "@/lib/formatting";

interface HomeHeaderProps {
  firstName: string;
  classCount: number;
  /** Keterangan jumlah kelas, mis. "kelas diikuti" atau "kelas diampu". */
  classLabel?: string;
}

/** Sapaan, tanggal hari ini, dan jumlah kelas. Sisanya ada di kartu di bawahnya. */
export function HomeHeader({
  firstName,
  classCount,
  classLabel = "kelas diikuti",
}: HomeHeaderProps) {
  return (
    <header className="space-y-2">
      <h1 className="text-title font-bold text-foreground">Hai, {firstName}</h1>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <p className="text-sm text-muted-foreground">{formatDateLong()}</p>
        <Badge tone="brand" size="md">
          {classCount} {classLabel}
        </Badge>
      </div>
    </header>
  );
}
