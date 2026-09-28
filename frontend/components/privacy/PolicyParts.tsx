import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export function PolicySection({
  id,
  number,
  title,
  children,
}: {
  id: string;
  number?: number;
  title: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-6 space-y-4">
      <h2 className="text-xl font-bold tracking-tight text-foreground">
        {number ? <span className="mr-2 text-primary tabular-nums">{number}.</span> : null}
        {title}
      </h2>
      <div className="space-y-4 text-body leading-relaxed text-foreground/90">{children}</div>
    </section>
  );
}

/** Rujukan pasal, dibuat redup supaya kalimat utamanya tetap mudah dibaca. */
export function Ref({ children }: { children: ReactNode }) {
  return <span className="text-body-sm text-muted-foreground">({children})</span>;
}

export function Bullets({ items }: { items: ReactNode[] }) {
  return (
    <ul className="list-disc space-y-2 pl-5 marker:text-primary">
      {items.map((item, index) => (
        <li key={index}>{item}</li>
      ))}
    </ul>
  );
}

/**
 * Tabel di layar lebar, kartu bertumpuk di ponsel. Tabel empat kolom yang
 * digeser ke samping di layar 390 px nyaris tidak terbaca, padahal isi
 * kebijakan wajib mudah dipahami (Penjelasan Pasal 27 UU PDP).
 */
export function PolicyTable({
  columns,
  rows,
  className,
}: {
  columns: string[];
  rows: ReactNode[][];
  className?: string;
}) {
  return (
    <div className={className}>
      <div className="hidden overflow-hidden rounded-xl border border-border md:block">
        <table className="w-full border-collapse text-left text-body-sm">
          <thead className="bg-muted/60">
            <tr>
              {columns.map((column) => (
                <th
                  key={column}
                  scope="col"
                  className="px-4 py-2.5 font-semibold text-foreground"
                >
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border bg-card">
            {rows.map((row, rowIndex) => (
              <tr key={rowIndex} className="align-top">
                {row.map((cell, cellIndex) => (
                  <td
                    key={cellIndex}
                    className={cn(
                      "px-4 py-3 text-foreground/90",
                      cellIndex === 0 && "font-semibold text-foreground",
                    )}
                  >
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="space-y-3 md:hidden">
        {rows.map((row, rowIndex) => (
          <div key={rowIndex} className="rounded-xl border border-border bg-card p-4">
            <p className="font-semibold text-foreground">{row[0]}</p>
            <dl className="mt-2 space-y-2 text-body-sm">
              {row.slice(1).map((cell, cellIndex) =>
                // Sel kosong di tabel cukup dibiarkan kosong; di kartu, label
                // tanpa isi hanya terbaca seperti data yang hilang.
                cell === "" || cell === null ? null : (
                  <div key={cellIndex}>
                    <dt className="text-caption font-semibold uppercase tracking-wide text-muted-foreground">
                      {columns[cellIndex + 1]}
                    </dt>
                    <dd className="text-foreground/90">{cell}</dd>
                  </div>
                ),
              )}
            </dl>
          </div>
        ))}
      </div>
    </div>
  );
}

export function ExternalLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="font-medium text-primary underline-offset-2 hover:underline"
    >
      {children}
    </a>
  );
}
