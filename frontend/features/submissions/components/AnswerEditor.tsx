"use client";

import type { Editor } from "@tiptap/core";
import { CheckCircle2, Info, Loader2, Send, TriangleAlert } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { LazyRichEditor } from "@/features/editor/components/LazyEditors";
import { richToPlain } from "@/features/editor/lib/rich-text";
import { AttachedDocumentCard } from "@/features/submissions/components/AttachedDocumentCard";
import { DocumentPickerCard } from "@/features/submissions/components/DocumentPickerCard";
import { DocumentUploadField } from "@/features/submissions/components/DocumentUploadField";
import {
  draftKey,
  recallDraft,
  useDraftSync,
  type SaveState,
} from "@/features/submissions/hooks/useDraftSync";
import { useAction } from "@/hooks/use-action";
import { useDeadline } from "@/hooks/use-deadline";
import { submitAnswer, type DocumentImportResult, type DocumentReadMethod } from "@/lib/mutations";
import { countWords } from "@/lib/text";
import type { RichDoc } from "@/lib/types";
import { cn } from "@/lib/utils";

/** Jawaban minimal sekian kata. Server menegakkan angka yang sama (MIN_ANSWER_WORDS). */
const MIN_WORDS = 5;

type Mode = "create" | "revise";

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
  words: number;
}

/**
 * Editor jawaban tugas: tulisan kaya, hitung kata, simpan otomatis (jawaban pertama), dan kirim.
 * Terkunci sendiri saat tenggat lewat; server tetap menolak kiriman yang terlambat.
 *
 * Bila dokumen terlampir, isi kotak tetap milik mahasiswa (nama, NIM, catatan) dan TIDAK diganti
 * teks dokumen: server menggabungkan keduanya saat mengumpulkan.
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

  // Kembali ke halaman yang baru ditinggalkan: tulisan di memori lebih baru daripada draf di cache.
  const [recalled] = useState(() => (autosave ? recallDraft(assignmentId) : null));
  const [doc, setDoc] = useState<RichDoc>(recalled?.doc ?? initialDoc);
  const [documentId, setDocumentId] = useState<string | null>(
    recalled ? recalled.documentId : initialDocumentId,
  );
  const [importNote, setImportNote] = useState<ImportNote | null>(null);
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const editorRef = useRef<Editor | null>(null);

  const plain = useMemo(() => richToPlain(doc), [doc]);
  const words = countWords(plain);
  // Jawaban dari dokumen cukup bila dokumennya ada; server memeriksa panjang gabungan teksnya.
  const enough = documentId !== null || words >= MIN_WORDS;

  const initialKey = useMemo(
    () => draftKey(initialDoc, initialDocumentId),
    [initialDoc, initialDocumentId],
  );
  const unsavedRevision = useMemo(
    () => draftKey(doc, documentId) !== initialKey,
    [doc, documentId, initialKey],
  );
  const { saveState, schedule, finish } = useDraftSync({
    assignmentId,
    autosave,
    expired,
    doc,
    documentId,
    initialKey,
    initiallySaved: plain !== "",
  });

  useEffect(() => {
    // Simpan-saat-keluar bisa saja gagal: kirim ulang tulisan yang dipulihkan (idempoten).
    if (recalled) schedule(true);
    // Hanya sekali saat dipasang.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleChange(next: RichDoc) {
    setDoc(next);
    schedule(richToPlain(next).trim() !== "");
  }

  function handleImported(result: DocumentImportResult, filename: string) {
    setImportError(null);
    setDocumentId(result.document_id);
    setImportNote({
      filename,
      method: result.method,
      warnings: result.warnings,
      words: countWords(result.text),
    });
    schedule(true);
  }

  async function submit() {
    setConfirmOpen(false);
    // Waktu mulai dan kurva kata sengaja tidak dikirim: server memakai catatan dari draf.
    const { ok } = await run(() =>
      submitAnswer(assignmentId, { rich_answer: doc, document_id: documentId ?? undefined }),
    );
    if (ok) finish();
  }

  const picker = (label: string, variant: "default" | "outline", size?: "default" | "sm") => (
    <DocumentUploadField
      assignmentId={assignmentId}
      disabled={locked}
      pending={importing}
      label={label}
      variant={variant}
      size={size}
      onImported={handleImported}
      onError={setImportError}
      onPending={setImporting}
    />
  );

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

      {allowUpload ? (
        documentId ? (
          <AttachedDocumentCard
            assignmentId={assignmentId}
            documentId={documentId}
            filename={importNote?.filename ?? null}
            method={importNote?.method ?? null}
            warnings={importNote?.warnings ?? []}
            words={importNote?.words ?? null}
            disabled={locked}
            onRemove={() => {
              setDocumentId(null);
              setImportNote(null);
              schedule(true);
            }}
            replace={picker("Ganti dokumen", "outline", "sm")}
          />
        ) : (
          <DocumentPickerCard picker={picker("Unggah dokumen", "default")} />
        )
      ) : null}

      {documentId ? (
        <p className="text-sm font-medium text-foreground">
          Tulis nama, NIM, atau catatan untuk dosen di sini bila perlu.
        </p>
      ) : null}

      <Card className="overflow-clip">
        <LazyRichEditor
          initial={recalled?.doc ?? initialDoc}
          onChange={handleChange}
          disabled={locked}
          editorRef={editorRef}
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

      {importError ? <p className="text-sm text-danger">{importError}</p> : null}

      {documentId ? null : (
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
      )}

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
    </div>
  );
}
