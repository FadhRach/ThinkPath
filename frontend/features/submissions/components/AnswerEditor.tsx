"use client";

import type { Editor } from "@tiptap/core";
import { CheckCircle2, Info, Loader2, Send, TriangleAlert } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { LazyRichEditor } from "@/features/editor/components/LazyEditors";
import { richToPlain, textToDoc } from "@/features/editor/lib/rich-text";
import { DocumentUploadField } from "@/features/submissions/components/DocumentUploadField";
import { OriginalDocumentButton } from "@/features/submissions/components/OriginalDocumentButton";
import { useAction } from "@/hooks/use-action";
import { useDeadline } from "@/hooks/use-deadline";
import {
  saveDraft,
  submitAnswer,
  type DocumentImportResult,
  type DocumentReadMethod,
} from "@/lib/mutations";
import { countWords } from "@/lib/text";
import type { RichDoc } from "@/lib/types";
import { cn } from "@/lib/utils";

/** Jawaban minimal sekian kata. Server menegakkan angka yang sama (MIN_ANSWER_WORDS). */
const MIN_WORDS = 5;

// Jeda dari perubahan pertama sampai draf dikirim. Satu pewaktu yang tidak diulang tiap ketikan:
// orang yang mengetik tanpa henti tetap tersimpan berkala. Waktu mulai dan kurva kata dicatat
// SERVER dari simpanan ini.
const AUTOSAVE_DELAY_MS = 3_000;

// Batas badan permintaan keepalive di peramban (64 KB, disisakan sedikit).
const KEEPALIVE_LIMIT = 60_000;

type Mode = "create" | "revise";
type SaveState = "idle" | "saving" | "saved" | "error";

interface Props {
  assignmentId: string;
  mode?: Mode;
  initialDoc: RichDoc;
  /** Dokumen unggahan yang menjadi sumber draf tersimpan. */
  initialDocumentId?: string | null;
  /** Dosen mengizinkan jawaban diisi dari berkas. */
  allowUpload?: boolean;
  deadline: string | null;
}

const READ_METHOD_LABEL: Record<DocumentReadMethod, string> = {
  text: "dibaca langsung dari berkas",
  ocr: "dibaca dari gambar dengan OCR",
  mixed: "sebagian dibaca langsung, sebagian dari gambar dengan OCR",
};

const COPY: Record<Mode, { submit: string; loading: string; done: string; confirm: string }> = {
  create: {
    submit: "Kumpulkan jawaban",
    loading: "Mengumpulkan…",
    done: "Jawabanmu berhasil dikumpulkan.",
    confirm: "Kamu masih bisa memperbaikinya sebelum tenggat selama belum dinilai dosen.",
  },
  revise: {
    submit: "Simpan revisi",
    loading: "Menyimpan…",
    done: "Revisi jawabanmu berhasil disimpan.",
    confirm: "Revisi ini menggantikan jawaban sebelumnya dan tercatat di riwayat perubahan.",
  },
};

const SAVE_LABEL: Record<SaveState, string> = {
  idle: "",
  saving: "Menyimpan…",
  saved: "Tersimpan otomatis",
  error: "Belum tersimpan, akan dicoba lagi",
};

interface ImportNote {
  filename: string;
  method: DocumentReadMethod;
  warnings: string[];
}

interface PendingImport {
  result: DocumentImportResult;
  filename: string;
}

/**
 * Editor jawaban tugas: tulisan kaya, hitung kata, simpan otomatis (jawaban pertama), dan kirim.
 * Terkunci sendiri saat tenggat lewat; server tetap menolak kiriman yang terlambat.
 */
export function AnswerEditor({
  assignmentId,
  mode = "create",
  initialDoc,
  initialDocumentId = null,
  allowUpload = false,
  deadline,
}: Props) {
  const copy = COPY[mode];
  const autosave = mode === "create";
  const { expired } = useDeadline(deadline);
  const { pending, error, run } = useAction("Gagal menyimpan jawaban. Coba lagi.", {
    successMessage: copy.done,
  });

  const [doc, setDoc] = useState<RichDoc>(initialDoc);
  const [documentId, setDocumentId] = useState<string | null>(initialDocumentId);
  const [importNote, setImportNote] = useState<ImportNote | null>(null);
  const [pendingImport, setPendingImport] = useState<PendingImport | null>(null);
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const editorRef = useRef<Editor | null>(null);

  const plain = useMemo(() => richToPlain(doc), [doc]);
  const words = countWords(plain);
  const enough = words >= MIN_WORDS;

  const initialJson = useMemo(() => JSON.stringify(initialDoc), [initialDoc]);
  const unsavedRevision = useMemo(() => JSON.stringify(doc) !== initialJson, [doc, initialJson]);
  const [saveState, setSaveState] = useState<SaveState>(plain ? "saved" : "idle");

  // Nilai terbaru di ref supaya pewaktu tidak dipasang ulang tiap ketikan.
  const latest = useRef({ doc, documentId });
  latest.current = { doc, documentId };
  const savedJson = useRef(initialJson);
  const timer = useRef<number | null>(null);
  const finished = useRef(false);
  const expiredRef = useRef(expired);
  const saveFailed = useRef(false);

  /** Ada tulisan yang belum sampai ke server (atau, pada revisi, belum disimpan). */
  function hasUnsaved() {
    if (finished.current) return false;
    return JSON.stringify(latest.current.doc) !== savedJson.current;
  }

  async function flush({ leaving = false }: { leaving?: boolean } = {}) {
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = null;
    const { doc: current, documentId: linked } = latest.current;
    const json = JSON.stringify(current);
    if (finished.current || json === savedJson.current) return;
    // Tenggat lewat: server menolak draf baru. Berhenti mencoba, jangan mengulang tanpa akhir.
    if (expiredRef.current) {
      saveFailed.current = true;
      setSaveState("error");
      return;
    }
    if (!leaving) setSaveState("saving");
    try {
      // Saat meninggalkan halaman, permintaan harus selesai tanpa menunggu halaman ini.
      // Peramban membatasi badan keepalive 64 KB; dokumen berisi gambar dikirim biasa.
      await saveDraft(
        assignmentId,
        { rich_answer: current, document_id: linked },
        leaving && json.length < KEEPALIVE_LIMIT,
      );
      savedJson.current = json;
      saveFailed.current = false;
      if (!leaving) setSaveState(JSON.stringify(latest.current.doc) === json ? "saved" : "saving");
    } catch {
      saveFailed.current = true;
      if (leaving) return;
      setSaveState("error");
      schedule();
    }
  }

  function schedule() {
    if (!autosave || timer.current !== null || finished.current || expiredRef.current) return;
    timer.current = window.setTimeout(() => void flush(), AUTOSAVE_DELAY_MS);
  }

  useEffect(() => {
    expiredRef.current = expired;
  }, [expired]);

  useEffect(() => {
    // Tab disembunyikan atau halaman ditutup: kirim sisa ketikan yang belum sempat tersimpan.
    const onHide = () => {
      if (autosave && document.visibilityState === "hidden") void flush({ leaving: true });
    };
    const onPageHide = () => {
      if (autosave) void flush({ leaving: true });
    };
    // Muat ulang atau tutup tab dengan perubahan yang belum aman: peramban bertanya dulu.
    // Pada jawaban pertama, simpan-saat-keluar (pagehide) biasanya cukup, jadi peramban tidak perlu
    // bertanya; bertanya hanya bila itu tidak bisa diandalkan: dokumen besar, atau simpan gagal.
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!hasUnsaved()) return;
      const riskyToLeave =
        !autosave ||
        saveFailed.current ||
        JSON.stringify(latest.current.doc).length >= KEEPALIVE_LIMIT;
      if (riskyToLeave) event.preventDefault();
    };
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", onPageHide);
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", onPageHide);
      window.removeEventListener("beforeunload", onBeforeUnload);
      // Pindah halaman di dalam aplikasi (menu samping, tautan): kirim sisa ketikan, jangan buang.
      if (autosave) void flush({ leaving: true });
      else if (timer.current !== null) window.clearTimeout(timer.current);
    };
    // flush dan hasUnsaved membaca nilai lewat ref; pewaktu dan pendengar tidak boleh dipasang ulang.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleChange(next: RichDoc) {
    setDoc(next);
    latest.current = { ...latest.current, doc: next };
    // Tulisan kosong tidak memulai apa pun di server, jadi tidak perlu dikirim.
    if (richToPlain(next).trim() || savedJson.current !== initialJson) schedule();
  }

  function applyImport({ result, filename }: PendingImport) {
    editorRef.current?.commands.setContent(textToDoc(result.text), { emitUpdate: true });
    setDocumentId(result.document_id);
    setImportNote({ filename, method: result.method, warnings: result.warnings });
    schedule();
  }

  function handleImported(result: DocumentImportResult, filename: string) {
    setImportError(null);
    // Tulisan yang sudah ada tidak diganti diam-diam: minta persetujuan dulu.
    if (plain.trim()) setPendingImport({ result, filename });
    else applyImport({ result, filename });
  }

  async function submit() {
    setConfirmOpen(false);
    // Waktu mulai dan kurva kata sengaja tidak dikirim: server memakai catatan dari draf.
    const { ok } = await run(() =>
      submitAnswer(assignmentId, { rich_answer: doc, document_id: documentId ?? undefined }),
    );
    if (ok) {
      finished.current = true;
      if (timer.current !== null) window.clearTimeout(timer.current);
    }
  }

  const locked = expired;
  const canSubmit = enough && !locked && !pending && !importing;

  return (
    <div className="space-y-4">
      {locked ? (
        <Alert variant="danger" title="Tenggat sudah berakhir">
          Pengumpulan ditutup.{" "}
          {autosave
            ? "Tulisan yang sudah tersimpan otomatis tetap ada, tetapi tidak bisa lagi dikumpulkan."
            : "Perubahan baru tidak bisa disimpan lagi."}
        </Alert>
      ) : null}

      {/* overflow-clip, bukan hidden: hidden menjadikan kartu wadah gulir dan toolbar sticky bergeser. */}
      <Card className="overflow-clip">
        <LazyRichEditor
          initial={initialDoc}
          onChange={handleChange}
          disabled={locked}
          editorRef={editorRef}
          toolbarExtra={
            allowUpload ? (
              <DocumentUploadField
                assignmentId={assignmentId}
                disabled={locked || importing}
                onImported={handleImported}
                onError={setImportError}
                onPending={setImporting}
              />
            ) : null
          }
        />
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-t border-border bg-muted/40 px-5 py-2.5 text-xs text-muted-foreground">
          <span className="inline-flex flex-wrap items-center gap-x-3 gap-y-1">
            <span
              className={cn(
                "inline-flex items-center gap-1.5 font-semibold",
                enough ? "text-success" : "text-foreground",
              )}
            >
              {enough ? (
                <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
              ) : (
                <TriangleAlert className="h-3.5 w-3.5 text-warning" aria-hidden="true" />
              )}
              {words} kata
              {enough ? "" : ` · minimal ${MIN_WORDS} untuk dikumpulkan`}
            </span>
            {importing ? (
              <span className="inline-flex items-center gap-1">
                <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
                Membaca dokumen…
              </span>
            ) : null}
            {!autosave && unsavedRevision ? (
              <span role="status" className="font-semibold text-warning">
                Perubahan belum disimpan
              </span>
            ) : null}
            {autosave && SAVE_LABEL[saveState] ? (
              <span role="status" className={saveState === "error" ? "text-danger" : undefined}>
                {SAVE_LABEL[saveState]}
              </span>
            ) : null}
          </span>
          <span>Tab untuk menjorok · Esc lalu Tab untuk keluar kotak</span>
        </div>
      </Card>

      {importNote ? (
        <Alert variant="info" title={`Teks dari ${importNote.filename}`}>
          <p>
            {READ_METHOD_LABEL[importNote.method]}. Periksa dan perbaiki hasilnya sebelum
            mengumpulkan. Jawaban dari dokumen tidak punya jejak mengetik, jadi dosen melihat tanda
            &ldquo;diimpor dari dokumen&rdquo;. Hapus nama atau NIM dari teks bila ada: teks jawaban
            ikut dianalisis.
          </p>
          {documentId ? (
            <div className="mt-2">
              <OriginalDocumentButton
                path={`/api/assignments/${assignmentId}/documents/${documentId}`}
                label="Lihat berkas yang diunggah"
              />
            </div>
          ) : null}
          {importNote.warnings.map((warning) => (
            <p key={warning} className="mt-1 font-semibold">
              {warning}
            </p>
          ))}
        </Alert>
      ) : null}
      {importError ? <p className="text-sm text-danger">{importError}</p> : null}

      <p className="flex items-start gap-2 text-xs text-muted-foreground">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        <span>
          {mode === "create"
            ? "Tulisanmu tersimpan otomatis. Sejak kamu mulai mengetik, ThinkPath mencatat jumlah kata dari waktu ke waktu, bukan isi tulisanmu, dan dosen melihatnya sebagai gambaran proses menulismu. Menempel kutipan dari sumber yang kamu rujuk itu wajar."
            : "Waktu kamu menyimpan revisi ikut tercatat dan terlihat oleh dosen, tanpa memengaruhi penilaian."}{" "}
          <a
            href="/kebijakan-privasi#data-yang-dikumpulkan"
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold text-brand-ink hover:underline"
          >
            Kebijakan Privasi
          </a>
        </span>
      </p>

      {error ? <p className="text-sm text-danger">{error}</p> : null}

      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" size="lg" disabled={!canSubmit} onClick={() => setConfirmOpen(true)}>
          <Send className="h-4 w-4" />
          {pending ? copy.loading : copy.submit}
        </Button>
        {!enough && !locked ? (
          <span className="text-sm text-muted-foreground">
            Tulis {MIN_WORDS - words} kata lagi untuk bisa mengumpulkan.
          </span>
        ) : null}
      </div>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={mode === "create" ? "Kumpulkan jawaban sekarang?" : "Simpan revisi?"}
        description={copy.confirm}
        confirmLabel={copy.submit}
        onConfirm={() => void submit()}
      />
      <ConfirmDialog
        open={pendingImport !== null}
        onOpenChange={(open) => !open && setPendingImport(null)}
        title="Ganti tulisan dengan isi dokumen?"
        description="Tulisan yang sudah kamu buat akan diganti dengan isi dokumen."
        confirmLabel="Ganti tulisan"
        onConfirm={() => {
          if (pendingImport) applyImport(pendingImport);
          setPendingImport(null);
        }}
      />
    </div>
  );
}
