"use client";

import { CheckCircle2, Info, Send } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { countWords } from "@/lib/text";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DocumentUploadField } from "@/features/submissions/components/DocumentUploadField";
import { OriginalDocumentButton } from "@/features/submissions/components/OriginalDocumentButton";
import { Textarea } from "@/components/ui/textarea";
import {
  saveDraft,
  submitAnswer,
  type DocumentImportResult,
  type DocumentReadMethod,
} from "@/lib/mutations";
import { useAction } from "@/hooks/use-action";

const MIN_LENGTH = 50;

// Jeda dari perubahan pertama sampai draf dikirim. Satu pewaktu yang tidak
// diulang tiap ketikan: orang yang mengetik tanpa henti tetap tersimpan
// berkala. Waktu mulai dan kurva kata dicatat SERVER dari simpanan ini.
const AUTOSAVE_DELAY_MS = 3_000;

type Mode = "create" | "revise";

interface Props {
  assignmentId: string;
  backHref: string;
  mode?: Mode;
  initialText?: string;
  /** Dokumen unggahan yang menjadi sumber draf tersimpan. */
  initialDocumentId?: string | null;
  /** Dosen mengizinkan jawaban diisi dari berkas. */
  allowUpload?: boolean;
}

const READ_METHOD_LABEL: Record<DocumentReadMethod, string> = {
  text: "dibaca langsung dari berkas",
  ocr: "dibaca dari gambar dengan OCR",
  mixed: "sebagian dibaca langsung, sebagian dari gambar dengan OCR",
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

const COPY: Record<Mode, { submit: string; loading: string; done: string; recording: string }> = {
  create: {
    submit: "Kumpulkan Jawaban",
    loading: "Mengumpulkan...",
    done: "Jawabanmu berhasil dikumpulkan. Terima kasih.",
    recording:
      "Tulisanmu tersimpan otomatis. Sejak kamu mulai mengetik, ThinkPath mencatat jumlah kata dari waktu ke waktu, bukan isi tulisanmu, dan dosen melihatnya sebagai gambaran proses menulismu. Menempel kutipan dari sumber yang kamu rujuk itu wajar.",
  },
  revise: {
    submit: "Simpan Revisi",
    loading: "Menyimpan...",
    done: "Revisi jawabanmu berhasil disimpan.",
    recording:
      "Waktu kamu menyimpan revisi ikut tercatat dan terlihat oleh dosen, tanpa memengaruhi penilaian.",
  },
};

type SaveState = "idle" | "saving" | "saved" | "error";

const SAVE_LABEL: Record<SaveState, string> = {
  idle: "",
  saving: "Menyimpan...",
  saved: "Tersimpan otomatis",
  error: "Belum tersimpan, akan dicoba lagi",
};

export function SubmitAnswerForm({
  assignmentId,
  backHref,
  mode = "create",
  initialText = "",
  initialDocumentId = null,
  allowUpload = false,
}: Props) {
  const [text, setText] = useState(initialText);
  const [submitted, setSubmitted] = useState(false);
  const [documentId, setDocumentId] = useState<string | null>(initialDocumentId);
  const [importNote, setImportNote] = useState<ImportNote | null>(null);
  const [pendingImport, setPendingImport] = useState<PendingImport | null>(null);
  const [saveState, setSaveState] = useState<SaveState>(initialText ? "saved" : "idle");
  const { pending, error, run } = useAction("Gagal menyimpan jawaban. Coba lagi.");
  const copy = COPY[mode];
  const autosave = mode === "create";

  // Nilai terbaru disimpan di ref supaya pewaktu tidak perlu dipasang ulang
  // setiap ketikan.
  const latest = useRef({ text, documentId });
  latest.current = { text, documentId };
  const savedText = useRef(initialText);
  const timer = useRef<number | null>(null);
  const finished = useRef(false);

  async function flush() {
    timer.current = null;
    const { text: current, documentId: doc } = latest.current;
    if (finished.current || current === savedText.current) return;
    setSaveState("saving");
    try {
      await saveDraft(assignmentId, { text_answer: current, document_id: doc });
      savedText.current = current;
      setSaveState(latest.current.text === current ? "saved" : "saving");
    } catch {
      setSaveState("error");
      schedule();
    }
  }

  function schedule() {
    if (!autosave || timer.current !== null || finished.current) return;
    timer.current = window.setTimeout(flush, AUTOSAVE_DELAY_MS);
  }

  useEffect(() => {
    if (!autosave) return;
    // Tab ditutup atau disembunyikan: simpan yang tersisa.
    const onHide = () => {
      if (document.visibilityState === "hidden") void flush();
    };
    document.addEventListener("visibilitychange", onHide);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      if (timer.current !== null) window.clearTimeout(timer.current);
    };
    // flush membaca nilai lewat ref; pewaktu tidak boleh dipasang ulang.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleChange(value: string) {
    setText(value);
    // Teks kosong tidak memulai apa pun di server, jadi tidak perlu dikirim.
    if (value.trim() || savedText.current) schedule();
  }

  function applyImport({ result, filename }: PendingImport) {
    setText(result.text);
    setDocumentId(result.document_id);
    setImportNote({ filename, method: result.method, warnings: result.warnings });
    schedule();
  }

  function handleImported(result: DocumentImportResult, filename: string) {
    // Teks yang sudah ditulis tidak diganti diam-diam: minta persetujuan dulu.
    if (text.trim()) setPendingImport({ result, filename });
    else applyImport({ result, filename });
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    // Waktu mulai dan kurva kata sengaja tidak dikirim: server memakai catatan
    // dari draf. Mengirimnya hanya mengundang pemalsuan.
    const { ok } = await run(() =>
      submitAnswer(assignmentId, {
        text_answer: text.trim(),
        document_id: documentId ?? undefined,
      }),
    );
    if (ok) {
      finished.current = true;
      if (timer.current !== null) window.clearTimeout(timer.current);
      setSubmitted(true);
    }
  }

  if (submitted) {
    return (
      <Card variant="raised" className="space-y-4 p-8 text-center">
        <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-success-soft text-success">
          <CheckCircle2 className="h-6 w-6" />
        </span>
        <p className="text-body-lg font-semibold text-foreground">{copy.done}</p>
        <Button asChild>
          <Link href={backHref}>Kembali ke daftar tugas</Link>
        </Button>
      </Card>
    );
  }

  const tooShort = text.trim().length < MIN_LENGTH;

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {allowUpload ? (
        <DocumentUploadField assignmentId={assignmentId} onImported={handleImported} />
      ) : null}
      <Card variant="raised" className="overflow-hidden border-2 border-primary/40">
        <Textarea
          id="answer"
          rows={12}
          required
          placeholder="Tulis jawabanmu di sini..."
          value={text}
          onChange={(event) => handleChange(event.target.value)}
          className="rounded-none border-0 bg-transparent px-5 py-4 text-body-lg focus-visible:ring-0 md:text-body-lg"
        />
        <div className="flex items-center justify-between border-t border-border bg-muted/40 px-5 py-3 text-body-sm text-muted-foreground">
          <span>
            Minimal {MIN_LENGTH} karakter
            {autosave && SAVE_LABEL[saveState] ? (
              <span role="status" className={saveState === "error" ? "ml-3 text-danger" : "ml-3"}>
                {SAVE_LABEL[saveState]}
              </span>
            ) : null}
          </span>
          <span>
            {countWords(text)} kata &middot; {text.trim().length} karakter
          </span>
        </div>
      </Card>
      {importNote ? (
        <div className="rounded-xl border border-border bg-accent p-3 text-body-sm text-accent-foreground">
          <p>
            Teks dari <b>{importNote.filename}</b> ({READ_METHOD_LABEL[importNote.method]}). Periksa
            dan perbaiki hasilnya sebelum mengumpulkan. Jawaban dari dokumen tidak punya jejak
            mengetik, jadi dosen melihat tanda &ldquo;diimpor dari dokumen&rdquo;. Hapus nama atau
            NIM dari teks bila ada: teks jawaban ikut dianalisis.
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
        </div>
      ) : null}
      <p className="flex items-start gap-2 text-caption text-muted-foreground">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        <span>
          {copy.recording}{" "}
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
      {error ? <p className="text-body-sm text-danger">{error}</p> : null}
      <Button type="submit" disabled={pending || tooShort} size="lg" className="w-full sm:w-auto">
        <Send className="h-4 w-4" />
        {pending ? copy.loading : copy.submit}
      </Button>
      <ConfirmDialog
        open={pendingImport !== null}
        onOpenChange={(open) => !open && setPendingImport(null)}
        title="Ganti teks dengan isi dokumen?"
        description="Teks yang sudah kamu tulis akan diganti dengan isi dokumen."
        confirmLabel="Ganti teks"
        onConfirm={() => {
          if (pendingImport) applyImport(pendingImport);
          setPendingImport(null);
        }}
      />
    </form>
  );
}
