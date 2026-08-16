import { cn } from "@/lib/utils";

interface DataTableProps {
  headers: React.ReactNode[];
  /** Kelas Tailwind min-w-* supaya tabel menggulir horizontal di layar sempit. */
  minWidthClass: string;
  children: React.ReactNode;
}

/** Kerangka tabel standar; isi sel tetap ditulis pemakai lewat <td>. */
export function DataTable({ headers, minWidthClass, children }: DataTableProps) {
  return (
    <div className="overflow-x-auto">
      <table className={cn("w-full border-collapse text-body-sm", minWidthClass)}>
        <thead>
          <tr className="border-b border-border text-left text-muted-foreground">
            {headers.map((header, index) => (
              <th
                key={index}
                className={cn(
                  "py-2 font-medium",
                  index < headers.length - 1 && "pr-4",
                )}
              >
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

export function DataTableRow({ children }: { children: React.ReactNode }) {
  return <tr className="border-b border-border/60 last:border-0">{children}</tr>;
}
