"use client";

import { ChevronRight, FolderOpen } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

import { MaterialRow } from "@/components/materials/MaterialRow";
import { MaterialSearch } from "@/components/materials/MaterialSearch";
import { Card } from "@/components/ui/card";
import { formatDate } from "@/lib/formatting";
import { classAccent, groupByTopic, isRecent, matchesQuery } from "@/lib/materials";
import type { Material } from "@/lib/types";
import { cn } from "@/lib/utils";

export interface ClassFolder {
  id: string;
  name: string;
  /** Mata kuliah dan dosen, sudah dirangkai server. */
  detail: string;
  materials: Material[];
}

interface Props {
  folders: ClassFolder[];
  /** Seluruh materi lintas kelas, terbaru di atas. */
  materials: Material[];
  now: number;
}

// Cukup untuk "apa yang terakhir dibagikan" tanpa mengulang isi folder kelas.
const RECENT_LIMIT = 5;

function FolderCard({ folder, now }: { folder: ClassFolder; now: number }) {
  const topics = groupByTopic(folder.materials).length;
  const fresh = folder.materials.filter((material) => isRecent(material, now)).length;
  const latest = folder.materials[0];

  return (
    <Link
      href={`/student/materi/${folder.id}`}
      className="group flex min-w-0 flex-col gap-4 rounded-2xl border border-border bg-card p-5 shadow-soft transition hover:border-primary/50 hover:shadow-soft-lg"
    >
      <div className="flex items-start justify-between gap-3">
        <span
          aria-hidden="true"
          className={cn("grid h-11 w-11 place-items-center rounded-xl", classAccent(folder.id))}
        >
          <FolderOpen className="h-5 w-5" />
        </span>
        {fresh > 0 ? (
          <span className="rounded-full bg-primary px-2.5 py-0.5 text-caption font-bold text-primary-foreground">
            {fresh} baru
          </span>
        ) : null}
      </div>
      <div className="min-w-0">
        <p className="font-bold text-foreground group-hover:text-primary">{folder.name}</p>
        {folder.detail ? (
          <p className="truncate text-body-sm text-muted-foreground">{folder.detail}</p>
        ) : null}
      </div>
      <div className="mt-auto flex items-center gap-2 border-t border-border pt-3 text-caption text-muted-foreground">
        <span>
          {folder.materials.length > 0
            ? `${folder.materials.length} materi · ${topics} topik`
            : "Belum ada materi"}
        </span>
        {latest ? (
          <span className="ml-auto truncate">Terakhir {formatDate(latest.created_at)}</span>
        ) : null}
        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition group-hover:translate-x-0.5 group-hover:text-primary" />
      </div>
    </Link>
  );
}

/**
 * Halaman awal Materi: satu pencarian untuk semua kelas, lalu folder per
 * kelas. Mahasiswa yang sudah tahu kelasnya cukup satu klik; yang ingat
 * judulnya saja langsung mengetik.
 */
export function MaterialsHome({ folders, materials, now }: Props) {
  const [query, setQuery] = useState("");
  const searching = query.trim().length > 0;
  const results = useMemo(
    () => (searching ? materials.filter((material) => matchesQuery(material, query)) : []),
    [materials, query, searching],
  );
  const recent = materials.slice(0, RECENT_LIMIT);

  return (
    <div className="space-y-6">
      <div className="max-w-2xl">
        <MaterialSearch
          value={query}
          onChange={setQuery}
          placeholder="Cari materi, topik, atau pertemuan"
        />
      </div>

      {searching ? (
        <section className="space-y-3" aria-live="polite">
          <p className="text-body-sm text-muted-foreground">
            {results.length > 0
              ? `${results.length} materi cocok dengan "${query.trim()}".`
              : `Tidak ada materi yang cocok dengan "${query.trim()}". Coba kata lain, misalnya nomor pertemuan atau nama kelas.`}
          </p>
          {results.length > 0 ? (
            <Card className="overflow-hidden shadow-soft">
              <ul className="divide-y divide-border">
                {results.map((material) => (
                  <MaterialRow key={material.id} material={material} now={now} showLocation />
                ))}
              </ul>
            </Card>
          ) : null}
        </section>
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <section className="min-w-0 space-y-3 lg:col-span-2">
            <h2 className="text-body font-bold text-foreground">Kelas kamu</h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {folders.map((folder) => (
                <FolderCard key={folder.id} folder={folder} now={now} />
              ))}
            </div>
          </section>

          <section className="min-w-0 space-y-3">
            <h2 className="text-body font-bold text-foreground">Terakhir dibagikan</h2>
            {recent.length > 0 ? (
              <Card className="overflow-hidden shadow-soft">
                <ul className="divide-y divide-border">
                  {recent.map((material) => (
                    <MaterialRow
                      key={material.id}
                      material={material}
                      now={now}
                      showLocation
                      compact
                    />
                  ))}
                </ul>
              </Card>
            ) : (
              <p className="rounded-2xl border border-dashed border-border bg-card px-5 py-8 text-center text-body-sm text-muted-foreground">
                Belum ada materi dari dosenmu. Lonceng notifikasi memberi tahu setiap ada
                yang baru.
              </p>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
