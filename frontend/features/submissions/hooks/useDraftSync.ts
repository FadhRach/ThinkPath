"use client";

import { useEffect, useRef, useState } from "react";

import { saveDraft } from "@/lib/mutations";
import type { RichDoc } from "@/lib/types";

// Jeda dari perubahan pertama sampai draf dikirim. Satu pewaktu yang tidak diulang tiap ketikan:
// orang yang mengetik tanpa henti tetap tersimpan berkala. Waktu mulai dan kurva kata dicatat
// SERVER dari simpanan ini.
const AUTOSAVE_DELAY_MS = 3_000;

// Batas badan permintaan keepalive di peramban (64 KB, disisakan sedikit).
const KEEPALIVE_LIMIT = 60_000;

export type SaveState = "idle" | "saving" | "saved" | "error";

/** Isi yang disimpan sebagai draf: tulisan dan dokumen terlampir. */
export function draftKey(doc: RichDoc, documentId: string | null) {
  return JSON.stringify([doc, documentId]);
}

interface Options {
  assignmentId: string;
  /** Jawaban pertama disimpan otomatis; revisi hanya disimpan lewat tombolnya. */
  autosave: boolean;
  /** Tenggat lewat: server menolak draf baru, jadi berhenti mencoba. */
  expired: boolean;
  doc: RichDoc;
  documentId: string | null;
  /** Isi awal (sudah tersimpan di server). */
  initialKey: string;
  initiallySaved: boolean;
}

/**
 * Menyimpan draf jawaban ke server: tertunda 3 detik setelah perubahan, segera saat tab
 * disembunyikan atau halaman ditinggalkan, dan meminta konfirmasi peramban bila ada perubahan yang
 * tidak bisa diandalkan tersimpan (revisi, dokumen besar, atau simpan sebelumnya gagal).
 */
export function useDraftSync({
  assignmentId,
  autosave,
  expired,
  doc,
  documentId,
  initialKey,
  initiallySaved,
}: Options) {
  const [saveState, setSaveState] = useState<SaveState>(initiallySaved ? "saved" : "idle");

  // Nilai terbaru di ref supaya pewaktu dan pendengar tidak dipasang ulang tiap ketikan.
  const latest = useRef({ doc, documentId });
  latest.current = { doc, documentId };
  const savedKey = useRef(initialKey);
  const timer = useRef<number | null>(null);
  const finished = useRef(false);
  const expiredRef = useRef(expired);
  const saveFailed = useRef(false);

  const currentKey = () => draftKey(latest.current.doc, latest.current.documentId);

  /** Ada tulisan yang belum sampai ke server (atau, pada revisi, belum disimpan). */
  function hasUnsaved() {
    return !finished.current && currentKey() !== savedKey.current;
  }

  async function flush({ leaving = false }: { leaving?: boolean } = {}) {
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = null;
    const { doc: current, documentId: linked } = latest.current;
    const key = draftKey(current, linked);
    if (finished.current || key === savedKey.current) return;
    if (expiredRef.current) {
      saveFailed.current = true;
      setSaveState("error");
      return;
    }
    if (!leaving) setSaveState("saving");
    try {
      // Saat meninggalkan halaman, permintaan harus selesai tanpa menunggu halaman ini.
      // Dokumen berisi gambar melewati batas keepalive dan dikirim biasa.
      await saveDraft(
        assignmentId,
        { rich_answer: current, document_id: linked },
        leaving && key.length < KEEPALIVE_LIMIT,
      );
      savedKey.current = key;
      saveFailed.current = false;
      if (!leaving) setSaveState(currentKey() === key ? "saved" : "saving");
    } catch {
      saveFailed.current = true;
      if (leaving) return;
      setSaveState("error");
      schedule(true);
    }
  }

  /**
   * Jadwalkan simpan. Tulisan kosong tidak memulai apa pun di server, jadi tidak dikirim kecuali
   * sudah pernah ada yang tersimpan (`started`).
   */
  function schedule(hasContent: boolean) {
    if (!autosave || timer.current !== null || finished.current || expiredRef.current) return;
    if (!hasContent && savedKey.current === initialKey) return;
    timer.current = window.setTimeout(() => void flush(), AUTOSAVE_DELAY_MS);
  }

  /** Jawaban sudah dikumpulkan: draf tidak perlu disimpan lagi. */
  function finish() {
    finished.current = true;
    if (timer.current !== null) window.clearTimeout(timer.current);
  }

  useEffect(() => {
    expiredRef.current = expired;
  }, [expired]);

  useEffect(() => {
    const onHide = () => {
      if (autosave && document.visibilityState === "hidden") void flush({ leaving: true });
    };
    const onPageHide = () => {
      if (autosave) void flush({ leaving: true });
    };
    // Pada jawaban pertama, simpan-saat-keluar biasanya cukup; peramban hanya perlu bertanya bila
    // itu tidak bisa diandalkan: revisi, dokumen besar, atau simpan sebelumnya gagal.
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!hasUnsaved()) return;
      if (!autosave || saveFailed.current || currentKey().length >= KEEPALIVE_LIMIT) {
        event.preventDefault();
      }
    };
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", onPageHide);
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", onPageHide);
      window.removeEventListener("beforeunload", onBeforeUnload);
      // Pindah halaman di dalam aplikasi: kirim sisa ketikan, jangan buang.
      if (autosave) void flush({ leaving: true });
      else if (timer.current !== null) window.clearTimeout(timer.current);
    };
    // flush dan hasUnsaved membaca nilai lewat ref; pewaktu dan pendengar tidak boleh dipasang ulang.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { saveState, schedule, finish };
}
