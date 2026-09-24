"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { MaterialRow } from "@/components/materials/MaterialRow";
import { MaterialSearch } from "@/components/materials/MaterialSearch";
import { Card } from "@/components/ui/card";
import { groupByTopic, matchesQuery, type TopicGroup } from "@/lib/materials";
import type { Material } from "@/lib/types";
import { cn } from "@/lib/utils";

interface Props {
  materials: Material[];
  now: number;
  /** Dosen pemilik kelas: tombol ubah dan hapus di tiap materi. */
  manage?: boolean;
}

/** id materi di hash alamat, misalnya dari notifikasi "Materi baru". */
function useHashTarget(): string | null {
  const [target, setTarget] = useState<string | null>(null);
  useEffect(() => {
    const read = () => setTarget(window.location.hash.slice(1) || null);
    read();
    window.addEventListener("hashchange", read);
    return () => window.removeEventListener("hashchange", read);
  }, []);
  return target;
}

// Tinggi header yang menempel ditambah deretan chip topik di ponsel.
const READING_LINE = 140;

function currentHash(): string {
  try {
    return decodeURIComponent(window.location.hash.slice(1));
  } catch {
    return "";
  }
}

/** Topik yang sedang dibaca, untuk menandai posisinya di indeks. */
function useActiveTopic(anchorKey: string): string | null {
  const [active, setActive] = useState<string | null>(null);
  useEffect(() => {
    const anchors = anchorKey ? anchorKey.split("|") : [];
    if (anchors.length === 0) return;
    let frame = 0;

    const update = () => {
      frame = 0;
      const sections = anchors
        .map((id) => document.getElementById(id))
        .filter((element): element is HTMLElement => element !== null);
      if (sections.length === 0) return;

      // Topik yang baru dipilih dari indeks, atau topik tempat materi dari
      // notifikasi berada, tetap ditandai selama masih terlihat. Topik di dasar
      // halaman tidak pernah bisa naik sampai atas layar, dan tanpa ini indeks
      // akan menandai topik sebelumnya.
      const hash = currentHash();
      const target = hash ? document.getElementById(hash) : null;
      const chosen = target
        ? sections.find((section) => section === target || section.contains(target))
        : undefined;
      if (chosen) {
        const rect = chosen.getBoundingClientRect();
        if (rect.top < window.innerHeight / 2 && rect.bottom > READING_LINE) {
          setActive(chosen.id);
          return;
        }
      }
      let current = sections[0].id;
      for (const section of sections) {
        if (section.getBoundingClientRect().top <= READING_LINE) current = section.id;
      }
      setActive(current);
    };
    const schedule = () => {
      if (!frame) frame = window.requestAnimationFrame(update);
    };

    update();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    window.addEventListener("hashchange", schedule);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      window.removeEventListener("hashchange", schedule);
    };
  }, [anchorKey]);
  return active;
}

/**
 * Deretan chip topik di ponsel. Chip yang aktif digeser ke dalam layar,
 * hanya ke samping, supaya halaman tidak ikut melompat naik-turun.
 */
function TopicChips({ groups, active }: { groups: TopicGroup[]; active: string | null }) {
  const listRef = useRef<HTMLUListElement>(null);
  useEffect(() => {
    const list = listRef.current;
    const chip = active ? list?.querySelector<HTMLElement>(`[data-anchor="${active}"]`) : null;
    if (!list || !chip) return;
    const left = chip.offsetLeft - list.offsetLeft;
    const right = left + chip.offsetWidth;
    if (left < list.scrollLeft || right > list.scrollLeft + list.clientWidth) {
      list.scrollTo({ left: Math.max(0, left - 16), behavior: "smooth" });
    }
  }, [active]);

  return (
    <ul
      ref={listRef}
      className="flex gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      {groups.map((group) => {
        const current = group.anchor === active;
        return (
          <li key={group.anchor} data-anchor={group.anchor} className="shrink-0">
            <a
              href={`#${group.anchor}`}
              aria-current={current ? "location" : undefined}
              className={cn(
                "flex items-center gap-2 rounded-full border px-3 py-1.5 text-body-sm transition",
                current
                  ? "border-primary bg-secondary font-semibold text-secondary-foreground"
                  : "border-border bg-card text-muted-foreground hover:border-primary/50 hover:text-foreground",
              )}
            >
              <span className="max-w-[14rem] truncate">{group.label}</span>
              <span
                className={cn(
                  "rounded-full px-1.5 text-caption tabular-nums",
                  current ? "bg-card/70" : "bg-muted",
                )}
              >
                {group.materials.length}
              </span>
            </a>
          </li>
        );
      })}
    </ul>
  );
}

/** Indeks topik di sisi kiri layar lebar. */
function TopicList({ groups, active }: { groups: TopicGroup[]; active: string | null }) {
  return (
    <ul className="max-h-[calc(100vh-13rem)] space-y-0.5 overflow-y-auto">
      {groups.map((group) => {
        const current = group.anchor === active;
        return (
          <li key={group.anchor}>
            <a
              href={`#${group.anchor}`}
              aria-current={current ? "location" : undefined}
              className={cn(
                "flex items-start justify-between gap-2 rounded-lg px-3 py-2 text-body-sm transition",
                current
                  ? "bg-secondary font-semibold text-secondary-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              <span className="line-clamp-2">{group.label}</span>
              <span
                className={cn(
                  "mt-0.5 shrink-0 rounded-full px-1.5 text-caption tabular-nums",
                  current ? "bg-card/70" : "bg-muted",
                )}
              >
                {group.materials.length}
              </span>
            </a>
          </li>
        );
      })}
    </ul>
  );
}

/**
 * Materi satu kelas, dikelompokkan per topik dengan indeks untuk melompat.
 * Di layar lebar indeks menempel di kiri seperti daftar topik Google
 * Classroom; di ponsel menjadi deretan chip yang ikut menempel di atas,
 * jadi topik lain selalu satu ketukan jauhnya.
 */
export function ClassMaterialBrowser({ materials, now, manage = false }: Props) {
  const [query, setQuery] = useState("");
  const target = useHashTarget();
  const visible = useMemo(
    () => materials.filter((material) => matchesQuery(material, query)),
    [materials, query],
  );
  const groups = useMemo(() => groupByTopic(visible), [visible]);
  const active = useActiveTopic(groups.map((group) => group.anchor).join("|"));
  const searching = query.trim().length > 0;
  const search = (
    <MaterialSearch value={query} onChange={setQuery} placeholder="Cari materi di kelas ini" />
  );

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[15rem_minmax(0,1fr)] lg:items-start">
      <aside className="hidden space-y-3 lg:sticky lg:top-24 lg:block">
        {search}
        {groups.length > 0 ? (
          <nav aria-label="Topik">
            <p className="caption-eyebrow mb-1.5 px-3">Topik</p>
            <TopicList groups={groups} active={active} />
          </nav>
        ) : null}
      </aside>

      <div className="min-w-0 space-y-5">
        <div className="lg:hidden">{search}</div>
        {groups.length > 1 ? (
          <nav
            aria-label="Topik"
            className="sticky top-16 z-10 -mx-4 bg-background/90 px-4 py-2 backdrop-blur sm:-mx-6 sm:px-6 lg:hidden"
          >
            <TopicChips groups={groups} active={active} />
          </nav>
        ) : null}

        {searching ? (
          <p className="text-body-sm text-muted-foreground" aria-live="polite">
            {visible.length > 0
              ? `${visible.length} materi cocok dengan "${query.trim()}".`
              : `Tidak ada materi yang cocok dengan "${query.trim()}". Coba kata lain, misalnya nomor pertemuan.`}
          </p>
        ) : null}

        {groups.map((group) => (
          <section
            key={group.anchor}
            id={group.anchor}
            className="scroll-mt-32 space-y-2 lg:scroll-mt-24"
          >
            <div className="flex items-center gap-2">
              <h2 className="text-body font-bold text-foreground">{group.label}</h2>
              <span className="rounded-full bg-muted px-2 py-0.5 text-caption tabular-nums text-muted-foreground">
                {group.materials.length}
              </span>
            </div>
            <Card className="overflow-hidden shadow-soft">
              <ul className="divide-y divide-border">
                {group.materials.map((material) => (
                  <MaterialRow
                    key={material.id}
                    material={material}
                    now={now}
                    manage={manage}
                    highlighted={target === `materi-${material.id}`}
                  />
                ))}
              </ul>
            </Card>
          </section>
        ))}
      </div>
    </div>
  );
}
