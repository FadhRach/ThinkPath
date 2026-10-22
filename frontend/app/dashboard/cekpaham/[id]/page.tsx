import { notFound } from "next/navigation";

import { BackLink } from "@/components/common/BackLink";
import { Callout } from "@/components/common/Callout";
import { SectionCard } from "@/components/common/SectionCard";
import { AttemptSection } from "@/components/cekpaham/AttemptSection";
import { AttemptStatusBadge, PhaseBadge } from "@/components/cekpaham/CekPahamBadges";
import { Card } from "@/components/ui/card";
import { ApiError } from "@/lib/api";
import { bloomCode, bloomLabel } from "@/lib/bloom";
import { getCekPahamDetail, getSubmissionDetail } from "@/lib/data";
import { formatClockHHMM, formatDate } from "@/lib/formatting";
import type { CekPahamAttemptView, CekPahamDetail } from "@/lib/types";
import { aiBandLabel } from "@/lib/ui";

function liveAttempt(detail: CekPahamDetail): CekPahamAttemptView | null {
  const current = detail.attempts.filter((a) => a.status !== "voided");
  return current.length ? current[current.length - 1] : null;
}

export default async function CekPahamResultPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let detail: CekPahamDetail;
  try {
    detail = await getCekPahamDetail(id);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) notFound();
    throw error;
  }
  // Konteks dari analisis tulisan, ditampilkan berdampingan tetapi tidak digabung.
  const written = await getSubmissionDetail(detail.submission_id).then((s) => s.analysis).catch(() => null);
  const attempt = liveAttempt(detail);
  const earlier = detail.attempts.filter((a) => a.status === "voided");

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <BackLink href={`/dashboard/submission/${detail.submission_id}`} label="Kembali ke jawaban mahasiswa" />

      <Card className="space-y-3 p-5 shadow-soft">
        <div className="flex flex-wrap items-center gap-2">
          <p className="caption-eyebrow text-primary">Cek Paham</p>
          <PhaseBadge phase={detail.phase} />
          {attempt ? <AttemptStatusBadge status={attempt.status} /> : null}
        </div>
        <h1 className="text-xl font-bold text-foreground">{detail.student_name}</h1>
        <p className="text-body-sm text-muted-foreground">
          {detail.assignment_title} &middot; {detail.class_name} &middot; dijawab dengan suara dalam{" "}
          {detail.answer_seconds} detik &middot; dibuka {formatDate(detail.window_start)}{" "}
          {formatClockHHMM(detail.window_start)} sampai {formatDate(detail.window_end)}{" "}
          {formatClockHHMM(detail.window_end)}
        </p>
        <div className="rounded-xl border border-border bg-secondary/30 p-4">
          <p className="caption-eyebrow mb-1 text-primary">Soal Anda</p>
          <p className="text-foreground">{detail.question_text}</p>
        </div>
      </Card>

      <Callout variant="info" title="Nilai tugas tetap Anda yang menentukan">
        Skor Cek Paham hanya saran dan tidak mengisi formulir nilai. Ia berdiri sendiri, di samping
        analisis tulisan di bawah, bukan menggantikan atau menggabungkannya.
      </Callout>

      {written ? (
        <SectionCard eyebrow="Analisis tulisan (terpisah)">
          <p className="text-body-sm text-muted-foreground">
            Indikasi AI pada teks: <strong className="text-foreground">{aiBandLabel(written.ai_band)}</strong>{" "}
            &middot; Level Bloom teramati:{" "}
            <strong className="text-foreground">
              {bloomCode(written.bloom_level)} {bloomLabel(written.bloom_level)}
            </strong>
          </p>
        </SectionCard>
      ) : null}

      {!attempt ? (
        <Card className="space-y-2 p-5 shadow-soft">
          <p className="font-semibold text-foreground">Belum dikerjakan</p>
          <p className="text-body-sm text-muted-foreground">
            {detail.student_consent_ready
              ? "Mahasiswa sudah memberi izin rekaman suara dan dapat mengerjakannya."
              : "Mahasiswa belum mengaktifkan izin rekaman suara di Pengaturan, sehingga belum bisa mengerjakan. Minta mereka mengaktifkannya, atau batalkan Cek Paham ini bila tidak diperlukan."}
          </p>
        </Card>
      ) : (
        <AttemptSection detail={detail} attempt={attempt} />
      )}

      {earlier.length > 0 ? (
        <details className="rounded-2xl border border-border bg-card p-4">
          <summary className="cursor-pointer text-body-sm font-semibold text-primary">
            Sesi sebelumnya yang dibatalkan ({earlier.length})
          </summary>
          <div className="mt-3 space-y-3">
            {earlier.map((old) => (
              <div key={old.id} className="rounded-xl border border-border p-3 text-body-sm">
                <p className="font-medium text-foreground">Sesi {old.number}</p>
                <p className="mt-1 text-muted-foreground">{old.final_transcript || "Tidak ada transkrip."}</p>
              </div>
            ))}
          </div>
        </details>
      ) : null}
    </div>
  );
}
