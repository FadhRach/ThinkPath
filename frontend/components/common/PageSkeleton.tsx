import { Skeleton } from "@/components/ui/skeleton";

interface Props {
  /** Bentuk kasar halaman tujuan: kartu grid, tabel, atau detail dua kolom. */
  variant?: "cards" | "table" | "detail";
}

export function PageSkeleton({ variant = "cards" }: Props) {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-8 w-64" />
      </div>

      {variant === "cards" ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-40 rounded-2xl" />
          ))}
        </div>
      ) : null}

      {variant === "table" ? (
        <div className="space-y-3 rounded-2xl border border-border bg-card p-5">
          <Skeleton className="h-5 w-1/3" />
          {[0, 1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      ) : null}

      {variant === "detail" ? (
        <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
          <div className="space-y-4">
            <Skeleton className="h-48 rounded-2xl" />
            <Skeleton className="h-64 rounded-2xl" />
          </div>
          <div className="space-y-4">
            <Skeleton className="h-40 rounded-2xl" />
            <Skeleton className="h-40 rounded-2xl" />
          </div>
        </div>
      ) : null}
    </div>
  );
}
