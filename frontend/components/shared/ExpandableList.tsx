"use client";

import { useState, type ReactNode } from "react";

import { Button } from "@/components/ui/button";

interface ExpandableListProps<T> {
  items: T[];
  /** Baris yang langsung terlihat; sisanya dibuka lewat tombol supaya halaman tetap ringkas. */
  visible?: number;
  getKey: (item: T) => string;
  renderItem: (item: T) => ReactNode;
}

/** Daftar bergaris yang memotong panjangnya, dengan tombol "Tampilkan N lainnya". */
export function ExpandableList<T>({
  items,
  visible = 5,
  getKey,
  renderItem,
}: ExpandableListProps<T>) {
  const [expanded, setExpanded] = useState(false);
  const shown = expanded ? items : items.slice(0, visible);
  return (
    <>
      <ul className="divide-y divide-border/70">
        {shown.map((item) => (
          <li key={getKey(item)}>{renderItem(item)}</li>
        ))}
      </ul>
      {items.length > visible ? (
        <div className="border-t border-border/70 px-4 py-2 sm:px-5">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setExpanded((value) => !value)}
          >
            {expanded ? "Tampilkan lebih sedikit" : `Tampilkan ${items.length - visible} lainnya`}
          </Button>
        </div>
      ) : null}
    </>
  );
}
