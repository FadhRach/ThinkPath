"use client";

import type { Editor } from "@tiptap/core";
import { CalendarClock, FileUp, Info, Sparkles, Target } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { INSTRUCTION_TEMPLATE } from "@/features/assignments/lib/instruction-template";
import { BLOOM_HINT, BLOOM_LEVELS, bloomCode, bloomShortLabel } from "@/features/bloom/lib/bloom";
import { LazyRichEditor } from "@/features/editor/components/LazyEditors";
import { docFrom, richToPlain } from "@/features/editor/lib/rich-text";
import { useAction } from "@/hooks/use-action";
import { DISPLAY_TIME_ZONE, formatDateTimeInput, parseDateTimeInput } from "@/lib/formatting";
import { createAssignment, updateAssignment } from "@/lib/mutations";
import type { AssignmentSummary, RichDoc } from "@/lib/types";
import { cn } from "@/lib/utils";

// Jenjang tidak lagi diminta di sini. Tugas mewarisinya dari kelas, sehingga
// tidak mungkin ada tugas S2 di dalam kelas S1.
interface Props {
  classId: string;
  assignment?: AssignmentSummary;
}

const QUICK_DEADLINES: Array<[string, number]> = [
  ["3 hari", 3],
  ["1 minggu", 7],
  ["2 minggu", 14],
];

function hasImage(doc: RichDoc): boolean {
  const walk = (node: RichDoc["content"]): boolean =>
    (node ?? []).some((child) => child.type === "image" || walk(child.content));
  return walk(doc.content);
}

/**
 * Form buat dan ubah tugas. Dua kolom: isi tugas (judul dan instruksi berformat) di kiri,
 * pengaturan (tenggat, target kognitif, jawaban dari berkas) dan tombol terbit di kanan, jadi
 * dosen selalu melihat apa yang menunggu diisi.
 */
export function CreateAssignmentForm({ classId, assignment }: Props) {
  const [title, setTitle] = useState(assignment?.title || "");
  const initialDoc = useMemo(
    () => docFrom(assignment?.instructions_rich, assignment?.instructions ?? ""),
    [assignment],
  );
  const [instructions, setInstructions] = useState<RichDoc>(initialDoc);
  const [deadline, setDeadline] = useState(formatDateTimeInput(assignment?.deadline || null));
  const [expectedBloomLevel, setExpectedBloomLevel] = useState(
    assignment?.expected_bloom_level || 4,
  );
  const [allowFileUpload, setAllowFileUpload] = useState(assignment?.allow_file_upload ?? false);
  const editorRef = useRef<Editor | null>(null);
  const targetLocked = !!assignment && assignment.submission_count > 0;
  const { pending, error, run, router } = useAction(
    "Gagal menyimpan tugas. Periksa isian lalu coba lagi.",
    { successMessage: "Tugas disimpan." },
  );

  const plain = useMemo(() => richToPlain(instructions), [instructions]);
  const empty = plain.trim() === "" && !hasImage(instructions);
  const dirty = useMemo(
    () =>
      title !== (assignment?.title ?? "") ||
      JSON.stringify(instructions) !== JSON.stringify(initialDoc),
    [title, instructions, initialDoc, assignment],
  );
  const submitted = useRef(false);
  const [confirmTemplate, setConfirmTemplate] = useState(false);

  function applyTemplate() {
    editorRef.current?.commands.setContent(INSTRUCTION_TEMPLATE, { emitUpdate: true });
    setConfirmTemplate(false);
  }

  // Peringatan sebelum menutup halaman bila isian belum disimpan.
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => {
      if (!submitted.current) event.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  function setQuickDeadline(days: number) {
    const date = new Date();
    date.setDate(date.getDate() + days);
    date.setHours(23, 59, 0, 0);
    setDeadline(formatDateTimeInput(date.toISOString()));
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await run(
      () => {
        const input = {
          title: title.trim(),
          instructions_rich: instructions,
          deadline: parseDateTimeInput(deadline),
          expected_bloom_level: expectedBloomLevel,
          allow_file_upload: allowFileUpload,
        };
        return assignment
          ? updateAssignment(assignment.id, input)
          : createAssignment(classId, input);
      },
      (created) => {
        submitted.current = true;
        router.push(`/dashboard/classes/${classId}?tab=tugas&assignment=${created.id}`);
        router.refresh();
      },
    );
  }

  const cancelHref = `/dashboard/classes/${classId}?tab=tugas${assignment ? `&assignment=${assignment.id}` : ""}`;

  return (
    <form
      onSubmit={handleSubmit}
      className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]"
    >
      <div className="min-w-0 space-y-5">
        <Card className="space-y-2 p-5 sm:p-6">
          <Label htmlFor="assignment-title" className="text-base font-bold">
            Judul tugas
          </Label>
          <Input
            id="assignment-title"
            type="text"
            required
            maxLength={160}
            placeholder="Contoh: Esai analisis dampak revolusi industri"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            className="h-11 text-base"
          />
          <p className="text-xs text-muted-foreground">
            Singkat dan spesifik. Judul ini yang dilihat mahasiswa di daftar tugas dan notifikasi.
          </p>
        </Card>

        <Card className="overflow-clip">
          <div className="flex flex-wrap items-start justify-between gap-3 p-5 pb-4 sm:p-6 sm:pb-4">
            <div>
              <h2 className="text-base font-bold text-foreground">Instruksi tugas</h2>
              <p className="mt-1 max-w-xl text-sm text-muted-foreground">
                Jelaskan tujuan, apa yang harus dikerjakan, format jawaban, dan cara menilai. Anda
                bisa menyisipkan gambar, tabel, rumus, dan tautan, misalnya tautan Google Drive
                untuk berkas pendukung.
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => (empty ? applyTemplate() : setConfirmTemplate(true))}
            >
              <Sparkles /> Mulai dari kerangka
            </Button>
          </div>
          <LazyRichEditor
            initial={initialDoc}
            onChange={setInstructions}
            editorRef={editorRef}
            ariaLabel="Instruksi tugas"
            placeholder="Tulis instruksi tugas di sini…"
          />
        </Card>

        {empty ? (
          <Alert variant="warning" title="Instruksi masih kosong" icon={Info}>
            Tugas tanpa instruksi membuat mahasiswa menebak-nebak. Tambahkan setidaknya tujuan dan
            apa yang harus dikumpulkan.
          </Alert>
        ) : null}
      </div>

      <aside className="min-w-0 space-y-4 xl:sticky xl:top-24">
        <Card className="space-y-3 p-5">
          <h2 className="flex items-center gap-2 text-base font-bold">
            <CalendarClock className="h-4 w-4 text-brand-ink" aria-hidden="true" /> Tenggat
          </h2>
          <Input
            id="assignment-deadline"
            aria-label="Tenggat pengumpulan"
            type="datetime-local"
            required
            value={deadline}
            onChange={(event) => setDeadline(event.target.value)}
          />
          <div className="flex flex-wrap gap-1.5">
            {QUICK_DEADLINES.map(([label, days]) => (
              <button
                key={label}
                type="button"
                onClick={() => setQuickDeadline(days)}
                className="rounded-full border border-border px-2.5 py-1 text-xs font-medium hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                +{label}
              </button>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            Zona waktu {DISPLAY_TIME_ZONE}. Setelah lewat, mahasiswa tidak bisa mengumpulkan atau
            merevisi.
          </p>
        </Card>

        <Card className="space-y-3 p-5">
          <h2 className="flex items-center gap-2 text-base font-bold">
            <Target className="h-4 w-4 text-brand-ink" aria-hidden="true" /> Target kognitif
          </h2>
          <div className="grid grid-cols-3 gap-2">
            {BLOOM_LEVELS.map((level) => {
              const selected = level === expectedBloomLevel;
              return (
                <button
                  key={level}
                  type="button"
                  disabled={targetLocked}
                  onClick={() => setExpectedBloomLevel(level)}
                  aria-pressed={selected}
                  className={cn(
                    "rounded-xl border px-1.5 py-2 text-center transition disabled:cursor-not-allowed disabled:opacity-70",
                    selected
                      ? "border-transparent bg-primary text-primary-foreground shadow-soft"
                      : "border-border bg-card text-muted-foreground hover:border-primary/40",
                  )}
                >
                  <span className="block text-xs font-semibold opacity-80">{bloomCode(level)}</span>
                  <span className="block text-xs font-semibold leading-tight">
                    {bloomShortLabel(level)}
                  </span>
                </button>
              );
            })}
          </div>
          <p className="rounded-lg bg-muted px-3 py-2 text-xs leading-relaxed text-foreground">
            <strong>
              {bloomCode(expectedBloomLevel)} {bloomShortLabel(expectedBloomLevel)}:
            </strong>{" "}
            {BLOOM_HINT[expectedBloomLevel]}
          </p>
          <p className="text-xs text-muted-foreground">
            Mahasiswa melihat target ini, dan hasil jawabannya dibandingkan dengannya.
            {targetLocked ? " Target tidak bisa diubah karena sudah ada pengumpulan." : ""}
          </p>
        </Card>

        <Card className="p-5">
          <div className="flex items-start gap-3">
            <Switch
              id="assignment-file-upload"
              checked={allowFileUpload}
              onCheckedChange={setAllowFileUpload}
              className="mt-0.5"
            />
            <div className="space-y-1">
              <Label
                htmlFor="assignment-file-upload"
                className="flex items-center gap-2 text-base font-bold"
              >
                <FileUp className="h-4 w-4 text-brand-ink" aria-hidden="true" /> Jawaban dari
                dokumen
              </Label>
              <p className="text-xs leading-relaxed text-muted-foreground">
                Mahasiswa boleh mengunggah dokumen Word, PDF, atau foto (maks. 10 MB) sebagai
                jawaban. Sistem membaca teksnya (OCR bila perlu). Karena tidak ada proses mengetik
                yang bisa direkam, pola pengerjaan tidak dinilai, jadi mahasiswa tidak tertuduh
                menempel teks. Biarkan mati bila tugas wajib diketik langsung.
              </p>
            </div>
          </div>
        </Card>

        {error ? (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        ) : null}
        <div className="flex flex-col gap-2">
          <Button type="submit" size="lg" disabled={pending || !title.trim() || !deadline}>
            {pending ? "Menyimpan…" : assignment ? "Simpan perubahan" : "Terbitkan tugas"}
          </Button>
          <Button asChild variant="outline">
            <Link href={cancelHref}>Batal</Link>
          </Button>
        </div>
      </aside>
      <ConfirmDialog
        open={confirmTemplate}
        onOpenChange={setConfirmTemplate}
        title="Ganti instruksi dengan kerangka?"
        description="Instruksi yang sudah Anda tulis akan diganti dengan kerangka kosong berisi lima bagian."
        confirmLabel="Ganti instruksi"
        onConfirm={applyTemplate}
      />
    </form>
  );
}
