import { ExternalLink } from "lucide-react";

import { EmptyState } from "@/components/shared/EmptyState";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { MaterialIcon } from "@/features/materials/components/MaterialIcon";
import { describeSource, safeHref } from "@/features/materials/lib/materials";
import { formatDate } from "@/lib/formatting";
import type { Material } from "@/lib/types";

export function StudentClassMaterials({ materials }: { materials: Material[] }) {
  return (
    <Card className="overflow-hidden">
      <div className="border-b border-border/80 px-5 py-4 sm:px-6">
        <h2 className="text-heading font-semibold text-foreground">Materi kelas</h2>
      </div>
      {materials.length ? (
        <ul className="divide-y divide-border/70">
          {materials.map((material) => {
            const source = describeSource(material.url);
            const href = safeHref(material.url);
            return (
              <li
                key={material.id}
                id={`materi-${material.id}`}
                className="flex gap-3.5 px-5 py-4 sm:px-6"
              >
                <MaterialIcon kind={source.kind} />
                <div className="min-w-0 flex-1">
                  {material.topic ? (
                    <p className="caption-eyebrow text-brand-ink">{material.topic}</p>
                  ) : null}
                  <h3 className="mt-0.5 font-bold text-foreground">{material.title}</h3>
                  {material.description ? (
                    <p className="mt-1 line-clamp-2 text-sm leading-relaxed text-muted-foreground">
                      {material.description}
                    </p>
                  ) : null}
                  <p className="mt-2 text-xs text-muted-foreground">
                    {source.label} <span className="mx-1">·</span> {formatDate(material.created_at)}
                  </p>
                </div>
                {href ? (
                  <Button asChild variant="outline" size="sm" className="self-center">
                    <a href={href} target="_blank" rel="noopener noreferrer">
                      Buka
                      <ExternalLink />
                      <span className="sr-only"> {material.title}</span>
                    </a>
                  </Button>
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : (
        <EmptyState
          variant="inline"
          title="Belum ada materi"
          caption="Materi yang dibagikan dosen akan muncul di sini."
        />
      )}
    </Card>
  );
}
