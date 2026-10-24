"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

// Analisis dikerjakan worker di server; halaman memuat ulang datanya sampai
// selesai. Berhenti sendiri setelah beberapa menit supaya tab yang terlupa
// tidak menembak server selamanya.
const INTERVAL_MS = 3_000;
const GIVE_UP_MS = 5 * 60_000;

/** Pasang hanya saat ada analisis yang belum selesai; copot sendiri saat data baru tiba. */
export function AnalysisPoller() {
  const router = useRouter();

  useEffect(() => {
    const started = Date.now();
    const timer = window.setInterval(() => {
      if (document.visibilityState !== "visible") return;
      if (Date.now() - started > GIVE_UP_MS) {
        window.clearInterval(timer);
        return;
      }
      router.refresh();
    }, INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [router]);

  return null;
}
