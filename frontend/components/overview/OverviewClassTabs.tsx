"use client";

import { useState } from "react";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export interface OverviewTab {
  id: string;
  label: string;
  /** Mahasiswa yang tertinggal minimal satu tingkat dari target. */
  belowCount: number;
  content: React.ReactNode;
}

interface Props {
  tabs: OverviewTab[];
  initialId?: string;
}

/**
 * Satu kelas terlihat pada satu waktu.
 *
 * Dulu seluruh set grafik (peta, sebaran, tren, tabel) diulang ke bawah untuk
 * setiap kelas, sehingga halaman memanjang dan kelas kedua tampak seperti
 * salinan kelas pertama. Kelas terpilih disimpan di query `?kelas=` supaya
 * bertahan saat halaman dimuat ulang atau tautannya dibagikan.
 */
export function OverviewClassTabs({ tabs, initialId }: Props) {
  const first = tabs[0]?.id ?? "";
  const [active, setActive] = useState(
    tabs.some((tab) => tab.id === initialId) ? (initialId as string) : first,
  );

  function handleChange(value: string) {
    setActive(value);
    const url = new URL(window.location.href);
    url.searchParams.set("kelas", value);
    window.history.replaceState(null, "", url);
  }

  return (
    <Tabs value={active} onValueChange={handleChange} className="space-y-5">
      {/* Nama kelas panjang di layar sempit: daftar tab bergulir di wadahnya
          sendiri, halaman tidak ikut melebar. */}
      <div className="-mx-4 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:px-0 [&::-webkit-scrollbar]:hidden">
        <TabsList
          aria-label="Pilih kelas"
          className="h-auto w-max gap-1 rounded-xl border border-border bg-card p-1 shadow-soft"
        >
          {tabs.map((tab) => (
            <TabsTrigger
              key={tab.id}
              value={tab.id}
              className="gap-2 rounded-lg px-3.5 py-2 text-body-sm text-muted-foreground hover:text-foreground data-[state=active]:bg-secondary data-[state=active]:text-secondary-foreground data-[state=active]:shadow-none"
            >
              {tab.label}
              {tab.belowCount > 0 ? (
                <span className="rounded-full bg-warning-soft px-2 py-0.5 text-caption font-semibold text-warning">
                  {tab.belowCount} tertinggal
                </span>
              ) : null}
            </TabsTrigger>
          ))}
        </TabsList>
      </div>

      {tabs.map((tab) => (
        <TabsContent key={tab.id} value={tab.id} className="mt-0">
          {tab.content}
        </TabsContent>
      ))}
    </Tabs>
  );
}
