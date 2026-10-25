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
  /** Elemen di sebelah kanan kolom cari (mis. form gabung kelas). */
  toolbarEnd?: ReactNode;
}

/** Daftar kelas dengan pencarian, dipakai halaman dosen dan mahasiswa. */
export function ClassDirectory<T extends { id: string }>({
  items,
  searchText,
  renderCard,
  placeholder,
  emptyCaption,
  toolbarEnd,
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
      {/* Ponsel: jumlah + gabung kelas satu baris, pencarian di bawahnya. Desktop: jumlah di kiri,
          pencarian dan gabung kelas di kanan. `order` mengatur urutan tanpa menggandakan elemen. */}
      <div className="flex flex-wrap items-center gap-3 lg:flex-nowrap">
        <p
          className="order-1 w-fit shrink-0 rounded-lg border border-border bg-card px-3.5 py-2 text-sm text-muted-foreground lg:mr-auto"
          aria-live="polite"
        >
          <strong className="text-foreground">{visible.length}</strong> kelas
          <span className="max-sm:sr-only"> ditampilkan</span>
        </p>
        <div className="order-3 w-full sm:w-72 sm:flex-none lg:order-2 lg:w-72">
          <SearchInput
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={placeholder}
            aria-label="Cari kelas"
          />
        </div>
        {toolbarEnd ? (
          <div className="order-2 min-w-0 flex-1 sm:flex-none lg:order-3">{toolbarEnd}</div>
        ) : null}
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
