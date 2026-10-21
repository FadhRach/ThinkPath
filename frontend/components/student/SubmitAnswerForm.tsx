"use client";

import { CheckCircle2, Info, Send } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DocumentUploadField } from "@/components/student/DocumentUploadField";
import { OriginalDocumentButton } from "@/components/submission/OriginalDocumentButton";
import { Textarea } from "@/components/ui/textarea";
import {
  submitAnswer,
  type DocumentImportResult,
  type DocumentReadMethod,
  type ProgressSample,
} from "@/lib/mutations";
import { useAction } from "@/lib/use-action";

const MIN_LENGTH = 50;

// Jarak antar cuplikan jumlah kata. Cukup rapat untuk memisahkan mengetik dari
// menempel, cukup jarang agar satu pengerjaan dua jam tetap di bawah batas
// yang diterima backend.
const SAMPLE_INTERVAL_MS = 30_000;
const MAX_SAMPLES = 240;

type Mode = "create" | "revise";

interface Props {
  assignmentId: string;
  backHref: string;
  mode?: Mode;
  initialText?: string;
  /** Dosen mengizinkan jawaban diisi dari berkas. */
  allowUpload?: boolean;
}

function countWords(text: string): number {
  const trimmed = text.trim();
  return trimmed ? trimmed.split(/\s+/).length : 0;
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

const COPY: Record<
  Mode,
  { submit: string; loading: string; done: string; recording: string }
> = {
  create: {
    submit: "Kumpulkan Jawaban",
    loading: "Mengumpulkan...",
    done: "Jawabanmu berhasil dikumpulkan. Terima kasih.",
    recording:
      "Selama kamu mengerjakan, ThinkPath mencatat jumlah kata setiap 30 detik, bukan isi tulisanmu. Dosen melihat catatan ini sebagai gambaran proses menulismu. Menempel kutipan dari sumber yang kamu rujuk itu wajar.",
  },
  revise: {
    submit: "Simpan Revisi",
    loading: "Menyimpan...",
    done: "Revisi jawabanmu berhasil disimpan.",
    recording:
      "Waktu kamu menyimpan revisi ikut tercatat dan terlihat oleh dosen, tanpa memengaruhi penilaian.",
  },
};

export function SubmitAnswerForm({
  assignmentId,
  backHref,
  mode = "create",
  initialText = "",
  allowUpload = false,
}: Props) {
  // Waktu mulai direkam sekali saat form dirender, dikirim sebagai started_at.
  const startedAtRef = useRef(new Date().toISOString());
  // Jejak pertumbuhan kata. Disimpan di ref, bukan state, karena tidak pernah
  // dirender dan tidak boleh memicu render ulang tiap tiga puluh detik.
  const progressRef = useRef<ProgressSample[]>([]);
  const [text, setText] = useState(initialText);
  const [submitted, setSubmitted] = useState(false);
  const [documentId, setDocumentId] = useState<string | null>(null);
  const [importNote, setImportNote] = useState<ImportNote | null>(null);
  const { pending, error, run } = useAction("Gagal menyimpan jawaban. Coba lagi.");
  const copy = COPY[mode];

  // Teks terbaru disimpan di ref supaya pewaktu di bawah tidak perlu dipasang
  // ulang setiap ketikan, yang akan mengacak jarak antar cuplikan.
  const textRef = useRef(text);
  textRef.current = text;

  useEffect(() => {
    // Cuplikan dasar diambil segera, bukan menunggu selang pertama. Tanpa ini,
    // menempel dalam tiga puluh detik pertama membuat pengamatan perdana sudah
    // memuat teks penuh, dan jejaknya terbaca datar sejak awal.
    progressRef.current.push({
      at: new Date().toISOString(),
      word_count: countWords(textRef.current),
    });
    const timer = setInterval(() => {
      if (progressRef.current.length >= MAX_SAMPLES) return;
      progressRef.current.push({
        at: new Date().toISOString(),
        word_count: countWords(textRef.current),
      });
    }, SAMPLE_INTERVAL_MS);
    return () => clearInterval(timer);
  }, []);

  function handleImported(result: DocumentImportResult, filename: string) {
    if (
      text.trim() &&
      !window.confirm("Teks yang sudah kamu tulis akan diganti dengan isi dokumen. Lanjutkan?")
    ) {
      return;
    }
    setText(result.text);
    setDocumentId(result.document_id);
    setImportNote({ filename, method: result.method, warnings: result.warnings });
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const { ok } = await run(() =>
      submitAnswer(assignmentId, {
        text_answer: text.trim(),
        started_at: startedAtRef.current,
        document_id: documentId ?? undefined,
        // Hanya dikirim saat mengarang dari nol. Pada mode revisi kotak sudah
        // terisi jawaban sebelumnya, sehingga cuplikan dasar mencatat ratusan
        // kata sejak detik nol dan backend akan membacanya sebagai lonjakan.
        // Backend memang mengabaikan progress pada jalur revisi, tetapi lebih
        // jujur tidak mengirim data yang tidak bisa ditafsirkan.
        //
        // Cuplikan terakhir diambil saat menekan tombol, supaya penambahan
        // setelah cuplikan berkala terakhir tidak hilang dari jejak.
        progress:
          mode === "create"
            ? [
                ...progressRef.current,
                { at: new Date().toISOString(), word_count: countWords(text) },
              ].slice(0, MAX_SAMPLES)
            : undefined,
      }),
    );
    if (ok) setSubmitted(true);
  }

  if (submitted) {
    return (
      <Card className="space-y-4 p-8 text-center shadow-soft">
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
      <Card className="overflow-hidden border-2 border-primary/40 shadow-soft">
        <Textarea
          id="answer"
          rows={12}
          required
          placeholder="Tulis jawabanmu di sini..."
          value={text}
          onChange={(event) => setText(event.target.value)}
          className="rounded-none border-0 bg-transparent px-5 py-4 text-body-lg focus-visible:ring-0 md:text-body-lg"
        />
        <div className="flex items-center justify-between border-t border-border bg-muted/40 px-5 py-3 text-body-sm text-muted-foreground">
          <span>Minimal {MIN_LENGTH} karakter</span>
          <span>{countWords(text)} kata &middot; {text.trim().length} karakter</span>
        </div>
      </Card>
      {importNote ? (
        <div className="rounded-xl border border-border bg-accent p-3 text-body-sm text-accent-foreground">
          <p>
            Teks dari <b>{importNote.filename}</b> ({READ_METHOD_LABEL[importNote.method]}).
            Periksa dan perbaiki hasilnya sebelum mengumpulkan. Jawaban dari dokumen tidak
            punya jejak mengetik, jadi dosen melihat tanda &ldquo;diimpor dari dokumen&rdquo;.
            Hapus nama atau NIM dari teks bila ada: teks jawaban ikut dianalisis.
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
            <p key={warning} className="mt-1 font-semibold">{warning}</p>
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
            className="font-semibold text-primary hover:underline"
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
    </form>
  );
}
