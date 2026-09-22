"use client";

import type { JSONContent } from "@tiptap/react";
import { CheckCircle2, Send } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Callout } from "@/components/common/Callout";
import { DocumentUploadField } from "@/components/student/DocumentUploadField";
import { RichAnswerEditor, type RichAnswerEditorHandle } from "@/components/student/RichAnswerEditor";
import { EMPTY_DOC, plainTextToDoc } from "@/lib/rich-text";
import { submitAnswer, type ProgressSample } from "@/lib/mutations";
import type { ImportMetadata, SubmissionOrigin } from "@/lib/types";
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
  initialContent?: JSONContent;
}

function countWords(text: string): number {
  const trimmed = text.trim();
  return trimmed ? trimmed.split(/\s+/).length : 0;
}

const COPY: Record<Mode, { submit: string; loading: string; done: string }> = {
  create: {
    submit: "Kumpulkan Jawaban",
    loading: "Mengumpulkan...",
    done: "Jawabanmu berhasil dikumpulkan. Terima kasih.",
  },
  revise: {
    submit: "Simpan Revisi",
    loading: "Menyimpan...",
    done: "Revisi jawabanmu berhasil disimpan.",
  },
};

export function SubmitAnswerForm({
  assignmentId,
  backHref,
  mode = "create",
  initialContent,
}: Props) {
  // Waktu mulai direkam sekali saat form dirender, dikirim sebagai started_at.
  const startedAtRef = useRef(new Date().toISOString());
  // Jejak pertumbuhan kata. Disimpan di ref, bukan state, karena tidak pernah
  // dirender dan tidak boleh memicu render ulang tiap tiga puluh detik.
  const progressRef = useRef<ProgressSample[]>([]);
  const editorRef = useRef<RichAnswerEditorHandle>(null);
  // Asal jawaban saat ini. Diubah jadi document_import begitu ekstraksi
  // dokumen berhasil mengisi editor. Dipakai untuk menekan progress di bawah
  // - baseline impor tidak boleh terbaca sebagai ledakan mengetik, persis
  // alasan progress juga ditekan pada mode revisi.
  const originRef = useRef<SubmissionOrigin>("typed");
  const importMetaRef = useRef<ImportMetadata | null>(null);

  // Teks terbaru disimpan di ref supaya pewaktu di bawah tidak perlu membaca
  // lewat editor tiap tiga puluh detik; state hanya untuk yang benar benar
  // perlu re-render (hitungan kata yang tampil, tombol submit).
  const textRef = useRef("");
  const [wordCount, setWordCount] = useState(0);
  const [submitted, setSubmitted] = useState(false);
  const { pending, error, run } = useAction("Gagal menyimpan jawaban. Coba lagi.");
  const copy = COPY[mode];

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

  function handleEditorUpdate(plainText: string) {
    textRef.current = plainText;
    setWordCount(countWords(plainText));
  }

  function handleExtracted(text: string, meta: ImportMetadata) {
    originRef.current = "document_import";
    importMetaRef.current = meta;
    editorRef.current?.setImportedContent(plainTextToDoc(text));
    // setImportedContent memicu onUpdate lewat emitUpdate=true, tapi
    // dipanggil di sini juga supaya hitungan kata tampil seketika tanpa
    // menunggu event editor asinkron.
    handleEditorUpdate(text);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const isTyped = originRef.current === "typed";

    const { ok } = await run(() =>
      submitAnswer(assignmentId, {
        text_answer: textRef.current.trim(),
        rich_content: editorRef.current?.getRichContent() ?? EMPTY_DOC,
        started_at: startedAtRef.current,
        // Hanya dikirim saat mengarang dari nol dengan mengetik langsung.
        // Pada mode revisi kotak sudah terisi jawaban sebelumnya, dan pada
        // impor dokumen baseline-nya datang dari OCR, bukan dari mengetik -
        // keduanya akan membuat cuplikan dasar mencatat ratusan kata sejak
        // detik nol dan terbaca sebagai lonjakan oleh backend. Backend
        // sendiri sudah mengabaikan progress untuk kedua kasus itu, tetapi
        // lebih jujur tidak mengirim data yang tidak bisa ditafsirkan.
        progress:
          mode === "create" && isTyped
            ? [
                ...progressRef.current,
                { at: new Date().toISOString(), word_count: countWords(textRef.current) },
              ].slice(0, MAX_SAMPLES)
            : undefined,
        paste_events: editorRef.current?.getPasteEvents(),
        origin: originRef.current,
        import_metadata: importMetaRef.current,
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

  const tooShort = textRef.current.trim().length < MIN_LENGTH;

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {mode === "create" ? (
        <Callout variant="info" title="Ingin mengunggah dokumen?">
          <p>
            Unggah PDF atau foto jawabanmu (termasuk tulisan tangan) dan sistem
            akan mengisi editor di bawah dengan hasil bacaannya. Kamu tetap
            wajib meninjau dan membetulkan hasilnya sebelum mengumpulkan.
          </p>
          <div className="mt-3">
            <DocumentUploadField assignmentId={assignmentId} onExtracted={handleExtracted} />
          </div>
        </Callout>
      ) : null}

      <Card className="overflow-hidden border-2 border-primary/40 shadow-soft">
        <RichAnswerEditor ref={editorRef} initialContent={initialContent} onUpdate={handleEditorUpdate} />
        <div className="flex items-center justify-between border-t border-border bg-muted/40 px-5 py-3 text-body-sm text-muted-foreground">
          <span>Minimal {MIN_LENGTH} karakter</span>
          <span>{wordCount} kata</span>
        </div>
      </Card>
      {error ? <p className="text-body-sm text-danger">{error}</p> : null}
      <Button type="submit" disabled={pending || tooShort} size="lg" className="w-full sm:w-auto">
        <Send className="h-4 w-4" />
        {pending ? copy.loading : copy.submit}
      </Button>
    </form>
  );
}
