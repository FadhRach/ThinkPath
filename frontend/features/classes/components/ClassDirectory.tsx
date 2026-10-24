"use client";

import { useMemo, useState, type ReactNode } from "react";

import { EmptyState } from "@/components/shared/EmptyState";
import { SearchInput } from "@/components/shared/IconInput";

interface ClassDirectoryProps<T extends { id: string }> {
  items: T[];
  /** Teks yang dicari untuk satu kelas. */
  searchText: (item: T) => string;
  renderCard: (item: T) => ReactNode;
  placeholder: string;
  emptyCaption: string;
}

/** Daftar kelas dengan pencarian, dipakai halaman dosen dan mahasiswa. */
export function ClassDirectory<T extends { id: string }>({
  items,
  searchText,
  renderCard,
  placeholder,
  emptyCaption,
}: ClassDirectoryProps<T>) {
  const [query, setQuery] = useState("");
  const visible = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase("id");
    return needle
      ? items.filter((item) => searchText(item).toLocaleLowerCase("id").includes(needle))
      : items;
  }, [items, query, searchText]);

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground" aria-live="polite">
          <strong className="text-foreground">{visible.length}</strong> kelas ditampilkan
        </p>
        <div className="w-full sm:max-w-xs">
          <SearchInput
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={placeholder}
            aria-label="Cari kelas"
          />
        </div>
      </div>

      {visible.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {visible.map((item) => (
            <div key={item.id}>{renderCard(item)}</div>
          ))}
        </div>
      ) : (
        <EmptyState title="Kelas tidak ditemukan" caption={emptyCaption} />
      )}
    </div>
  );
}
