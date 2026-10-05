import {
  ArrowLeft,
  CalendarClock,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  FileText,
  MessageSquareText,
} from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { BloomStepper } from "@/components/common/BloomStepper";
import { AssignmentStatusBadge } from "@/components/student/AssignmentStatusBadge";
import { SubmitAnswerForm } from "@/components/student/SubmitAnswerForm";
import { Card } from "@/components/ui/card";
import { ApiError } from "@/lib/api";
import { bloomCode, bloomShortLabel } from "@/lib/bloom";
import { getStudentAssignment } from "@/lib/data";
import { formatDate, formatRelativeTime } from "@/lib/formatting";
import type { StudentSubmissionWithText } from "@/lib/types";

export default async function SubmitAssignmentPage({
  params,
}: {
  params: Promise<{ assignmentId: string }>;
}) {
  const { assignmentId } = await params;
  let detail;
  try {
    detail = await getStudentAssignment(assignmentId);
  } catch (error) {
    if (error instanceof ApiError && (error.status === 403 || error.status === 404)) notFound();
    throw error;
  }

  const { assignment, submission } = detail;
  const isPastDeadline = assignment.deadline !== null && Date.now() > new Date(assignment.deadline).getTime();
  const isReviewed = submission?.status === "reviewed";
  const canRevise = submission !== null && !isPastDeadline && !isReviewed;

  return (
    <div className="mx-auto max-w-4xl space-y-5 sm:space-y-6">
      <nav aria-label="Lokasi halaman" className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
        <Link href="/student" className="hover:text-primary">Beranda</Link><ChevronRight className="h-3.5 w-3.5" />
        <Link href="/student/kelas" className="hover:text-primary">Kelas</Link><ChevronRight className="h-3.5 w-3.5" />
        <Link href={`/student/kelas/${detail.class.id}`} className="max-w-[10rem] truncate hover:text-primary">{detail.class.name}</Link><ChevronRight className="h-3.5 w-3.5" />
        <span aria-current="page" className="truncate text-foreground">Tugas</span>
      </nav>

      <section className="rounded-xl border border-border bg-card px-5 py-5 text-foreground sm:px-7 sm:py-6">
        <Link href={`/student/kelas/${detail.class.id}`} className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground transition hover:text-foreground"><ArrowLeft className="h-3.5 w-3.5" />{detail.class.name}</Link>

        <h1 className="mt-1.5 max-w-3xl text-[1.6rem] font-semibold leading-tight tracking-[-0.035em] sm:text-[2rem]">{assignment.title}</h1>
        <div className="mt-4 flex flex-wrap items-center gap-2.5 text-xs">
          <span className="font-medium text-muted-foreground">{detail.class.name}</span>
          <span className="inline-flex items-center gap-1.5 text-muted-foreground"><CalendarClock className="h-3.5 w-3.5" />{assignment.deadline ? `Tenggat ${formatDate(assignment.deadline)} · ${formatRelativeTime(assignment.deadline)}` : "Tanpa tenggat"}</span>
          <AssignmentStatusBadge submission={submission} />
        </div>
      </section>

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(16rem,.6fr)]">
        <div className="space-y-4">
          <Card className="rounded-xl border-border bg-card p-5 shadow-none sm:p-6">
            <div className="flex items-center gap-2.5"><span className="grid h-9 w-9 place-items-center rounded-xl bg-accent text-accent-foreground"><FileText className="h-4 w-4" /></span><div><h2 className="font-bold text-foreground">Instruksi tugas</h2></div></div>
            {assignment.instructions ? <p className="mt-4 whitespace-pre-line text-sm leading-7 text-foreground">{assignment.instructions}</p> : <p className="mt-4 text-sm text-muted-foreground">Dosen belum menambahkan instruksi khusus untuk tugas ini.</p>}
          </Card>

          <SubmissionSection
            submission={submission}
            canRevise={canRevise}
            isPastDeadline={isPastDeadline}
            isReviewed={Boolean(isReviewed)}
            assignmentId={assignment.id}
            classId={detail.class.id}
          />
        </div>

        <aside className="space-y-4">
          <Card className="rounded-xl border-border bg-card p-5 shadow-none">
            <div className="flex items-center gap-2.5"><span className="grid h-9 w-9 place-items-center rounded-xl bg-secondary text-accent-foreground"><ClipboardCheck className="h-4 w-4" /></span><div><h2 className="font-bold text-foreground">Cara mengumpulkan</h2></div></div>
            <ol className="mt-4 space-y-3 text-sm text-muted-foreground">
              <Step number="01">Tulis jawabanmu pada kolom pengumpulan.</Step>
              <Step number="02">Periksa kembali isi jawaban sebelum dikirim.</Step>
              <Step number="03">Tekan <strong className="font-semibold text-foreground">Kumpulkan Jawaban</strong>.</Step>
            </ol>
            <div className="mt-4 rounded-xl bg-muted p-3.5">
              <p className="text-xs font-bold text-accent-foreground">
                Target {bloomCode(assignment.expected_bloom_level)} &middot; {bloomShortLabel(assignment.expected_bloom_level)}
              </p>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                Level dengan garis putus-putus adalah target berpikir untuk tugas ini.
              </p>
              <div className="mt-3">
                <BloomStepper targetLevel={assignment.expected_bloom_level} />
              </div>
            </div>
          </Card>
          <Card className="rounded-xl border-border bg-card p-5 shadow-none">

            <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">Jika tugas belum dinilai, kamu masih dapat memperbarui jawaban selama tenggat belum lewat.</p>
            <Link href="/student/tugas" className="mt-3 inline-flex items-center gap-1.5 text-xs font-bold text-primary hover:underline"><ClipboardCheck className="h-3.5 w-3.5" />Kembali ke daftar tugas</Link>
          </Card>
        </aside>
      </div>
    </div>
  );
}

function Step({ number, children }: { number: string; children: React.ReactNode }) {
  return <li className="flex gap-2.5"><span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-muted text-[0.62rem] font-semibold text-muted-foreground">{number}</span><span className="pt-0.5 leading-relaxed">{children}</span></li>;
}

function SubmissionSection({
  submission,
  canRevise,
  isPastDeadline,
  isReviewed,
  assignmentId,
  classId,
}: {
  submission: StudentSubmissionWithText | null;
  canRevise: boolean;
  isPastDeadline: boolean;
  isReviewed: boolean;
  assignmentId: string;
  classId: string;
}) {
  if (submission === null && isPastDeadline) {
    return <StatusNotice tone="coral" title="Tenggat sudah berakhir" text="Tugas ini tidak lagi menerima jawaban karena tenggatnya telah lewat." />;
  }

  if (submission === null) {
    return (
      <Card className="rounded-xl border-border bg-card p-4 shadow-none sm:p-5">
        <div className="mb-4 flex items-center gap-2.5"><span className="grid h-9 w-9 place-items-center rounded-xl bg-accent text-accent-foreground"><MessageSquareText className="h-4 w-4" /></span><div><h2 className="font-bold text-foreground">Kumpulkan tugasmu</h2></div></div>
        <SubmitAnswerForm assignmentId={assignmentId} backHref={`/student/kelas/${classId}`} />
      </Card>
    );
  }

  if (canRevise) {
    return (
      <div className="space-y-3">
        <Card className="rounded-xl border-border bg-card p-4 shadow-none sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-2"><div><p className="mt-1 text-sm font-bold text-foreground">Jawabanmu sudah diterima</p></div><AssignmentStatusBadge submission={submission} /></div>
          <p className="mt-2 text-xs text-muted-foreground">Dikumpulkan {formatRelativeTime(submission.submitted_at)}. Kamu masih bisa memperbaiki jawaban sebelum tenggat.</p>
        </Card>
        <Card className="rounded-xl border-border bg-card p-4 shadow-none sm:p-5"><p className="mb-4 text-sm font-bold text-foreground">Perbarui jawaban</p><SubmitAnswerForm assignmentId={assignmentId} backHref={`/student/kelas/${classId}`} mode="revise" initialText={submission.text_answer} /></Card>
      </div>
    );
  }

  const lockReason = isReviewed ? "Jawaban sudah dinilai dosen, jadi tidak bisa direvisi lagi." : "Tenggat sudah berakhir, jawaban terkunci.";
  return (
    <Card className="space-y-4 rounded-xl border-border bg-card p-5 shadow-none sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-2"><div><p className="mt-1 text-sm font-bold text-foreground">Jawabanmu telah dikirim</p></div><AssignmentStatusBadge submission={submission} /></div>
      <p className="text-xs leading-relaxed text-muted-foreground">Dikumpulkan {formatRelativeTime(submission.submitted_at)}. {lockReason}</p>
      <div className="border-t border-border pt-4"><p className="mb-2 text-sm font-bold text-foreground">Jawabanmu</p><p className="whitespace-pre-wrap rounded-xl bg-background p-4 text-sm leading-7 text-foreground">{submission.text_answer}</p></div>
      {isReviewed ? <div className="rounded-xl bg-accent p-4"><p className="inline-flex items-center gap-2 text-sm font-semibold text-accent-foreground"><CheckCircle2 className="h-4 w-4" />Nilai: {submission.grade ?? "-"}</p>{submission.teacher_feedback ? <p className="mt-2 border-t border-border pt-2 text-sm leading-relaxed text-foreground"><strong>Umpan balik dosen:</strong> {submission.teacher_feedback}</p> : <p className="mt-1 text-xs text-muted-foreground">Belum ada catatan umpan balik dari dosen.</p>}</div> : <StatusNotice tone="teal" title="Menunggu penilaian" text="Jawabanmu sudah diterima. Nilai dan umpan balik dosen akan tampil di bagian ini." />}
    </Card>
  );
}

function StatusNotice({ tone, title, text }: { tone: "teal" | "coral"; title: string; text: string }) {
  const colors = tone === "teal" ? "border-border bg-accent text-accent-foreground" : "border-border bg-brand-pink text-danger";
  return <div className={`rounded-xl border p-4 ${colors}`}><h2 className="font-bold">{title}</h2><p className="mt-1 text-sm leading-relaxed">{text}</p></div>;
}
