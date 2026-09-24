"use client";

import { ExternalLink, Pencil } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { DeleteMaterialButton } from "@/components/materials/DeleteMaterialButton";
import { MaterialIcon } from "@/components/materials/MaterialIcon";
import { formatDate } from "@/lib/formatting";
import { describeSource, isRecent } from "@/lib/materials";
import type { Material } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * Apakah teks yang dipotong dua baris memang terpotong. Diukur, bukan ditebak
 * dari jumlah huruf: ringkasan yang muat di layar lebar bisa terpotong di
 * ponsel, dan tombol "Selengkapnya" yang tidak membuka apa pun membingungkan.
 */
function useIsClamped(text: string) {
  const ref = useRef<HTMLParagraphElement>(null);
  const [clamped, setClamped] = useState(false);
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const measure = () => setClamped(element.scrollHeight > element.clientHeight + 1);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [text]);
  return { ref, clamped };
}

interface Props {
  material: Material;
  /** Waktu render dari server, supaya lencana "Baru" sama di server dan peramban. */
  now: number;
  /** Tampilkan kelas dan topiknya; dipakai di hasil pencarian dan daftar terbaru. */
  showLocation?: boolean;
  /** Tanpa ringkasan, untuk kolom sempit seperti daftar "Baru dibagikan". */
  compact?: boolean;
  /** Tombol ubah dan hapus untuk dosen pemilik kelas. */
  manage?: boolean;
  /** Disorot setelah dibuka dari notifikasi. */
  highlighted?: boolean;
}

export function MaterialRow({
  material,
  now,
  showLocation,
  compact,
  manage,
  highlighted,
}: Props) {
  const [expanded, setExpanded] = useState(false);
  const { ref: descriptionRef, clamped } = useIsClamped(material.description);
  const source = describeSource(material.url);
  const location = [material.class_name, material.topic].filter(Boolean).join(" · ");

  return (
    <li
      id={`materi-${material.id}`}
      className={cn(
        "flex scroll-mt-32 gap-3 px-4 py-4 transition-colors sm:gap-4 sm:px-5 lg:scroll-mt-24",
        highlighted && "bg-secondary/40",
      )}
    >
      <MaterialIcon kind={source.kind} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          {material.url ? (
            <a
              href={material.url}
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-foreground hover:text-primary hover:underline"
            >
              {material.title}
            </a>
          ) : (
            <p className="font-semibold text-foreground">{material.title}</p>
          )}
          {isRecent(material, now) ? (
            <span className="rounded-full bg-primary px-2 py-0.5 text-[0.6875rem] font-bold leading-4 text-primary-foreground">
              Baru
            </span>
          ) : null}
        </div>
        {showLocation && location ? (
          <p className="mt-0.5 truncate text-caption font-medium text-primary">{location}</p>
        ) : null}
        <p className="mt-0.5 text-caption text-muted-foreground">
          {source.label} · {formatDate(material.created_at)}
        </p>
        {material.description && !compact ? (
          <div className="mt-1.5">
            <p
              ref={descriptionRef}
              className={cn(
                "whitespace-pre-line text-body-sm text-muted-foreground",
                !expanded && "line-clamp-2",
              )}
            >
              {material.description}
            </p>
            {expanded || clamped ? (
              <button
                type="button"
                onClick={() => setExpanded((open) => !open)}
                aria-expanded={expanded}
                className="mt-1 text-caption font-semibold text-primary hover:underline"
              >
                {expanded ? "Ringkas" : "Selengkapnya"}
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
      <div className="flex shrink-0 items-start gap-1">
        {material.url ? (
          <a
            href={material.url}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Buka ${material.title} di tab baru`}
            className={cn(
              "inline-flex h-9 items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 text-body-sm font-medium text-foreground transition hover:border-primary/50 hover:text-primary",
              !compact && "sm:px-3",
            )}
          >
            <span className={cn("hidden", !compact && "sm:inline")}>Buka</span>
            <ExternalLink className="h-4 w-4" />
          </a>
        ) : null}
        {manage ? (
          <>
            <Link
              href={`/dashboard/classes/${material.class_id}/materials/${material.id}/edit`}
              aria-label={`Ubah materi ${material.title}`}
              className="grid h-9 w-9 place-items-center rounded-lg text-muted-foreground transition hover:bg-muted hover:text-foreground"
            >
              <Pencil className="h-4 w-4" />
            </Link>
            <DeleteMaterialButton materialId={material.id} title={material.title} />
          </>
        ) : null}
      </div>
    </li>
  );
}
