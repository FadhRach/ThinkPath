import { FileText } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Breadcrumb } from "@/components/shared/Breadcrumb";
import { CollapsibleSection } from "@/components/shared/CollapsibleSection";
import { Alert } from "@/components/ui/alert";
import { buttonVariants } from "@/components/ui/button-variants";
import { Card } from "@/components/ui/card";
import { bloomCode, bloomLabel } from "@/features/bloom/lib/bloom";
import { AttemptSection } from "@/features/cekpaham/components/AttemptSection";
import { AttemptStatusBadge, PhaseBadge } from "@/features/cekpaham/components/CekPahamBadges";
import { aiBandLabel } from "@/features/submissions/lib/status";
import { ApiError } from "@/lib/api/errors";
import { getCekPahamDetail, getSubmissionDetail } from "@/lib/data";
import { formatClockHHMM, formatDate } from "@/lib/formatting";
import type { CekPahamAttemptView, CekPahamDetail } from "@/lib/types";

function liveAttempt(detail: CekPahamDetail): CekPahamAttemptView | null {
  const current = detail.attempts.filter((a) => a.status !== "voided");
  return current.length ? current[current.length - 1] : null;
}

/**
 * Hasil satu Cek Paham. Kiri: apa yang terjadi pada sesi (skor, transkrip, konteks, laporan).
 * Kanan: soal yang Anda ajukan dan analisis tulisan sebagai pembanding, tanpa digabung.
 */
export default async function CekPahamResultPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let detail: CekPahamDetail;
  try {
    detail = await getCekPahamDetail(id);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) notFound();
    throw error;
  }
  const written = await getSubmissionDetail(detail.submission_id)
    .then((s) => s.analysis)
    .catch(() => null);
  const attempt = liveAttempt(detail);
  const earlier = detail.attempts.filter((a) => a.status === "voided");

  return (
    <div className="space-y-5">
      <Breadcrumb
        items={[
          { label: "Cek Paham", href: "/dashboard/cekpaham" },
          { label: detail.student_name },
        ]}
      />

      <Card className="px-4 py-3.5 sm:px-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0 space-y-1.5">
            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
              <h1 className="min-w-0 break-words text-heading font-bold text-foreground">
                {detail.student_name}
              </h1>
              <PhaseBadge phase={detail.phase} />
              {attempt ? <AttemptStatusBadge status={attempt.status} /> : null}
            </div>
            <p className="text-sm text-muted-foreground">
              {detail.assignment_title} · {detail.class_name} · {detail.answer_seconds} detik ·
              dibuka {formatDate(detail.window_start)} {formatClockHHMM(detail.window_start)} sampai{" "}
              {formatDate(detail.window_end)} {formatClockHHMM(detail.window_end)}
            </p>
          </div>
          <Link
            href={`/dashboard/submission/${detail.submission_id}`}
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            <FileText aria-hidden="true" /> Buka jawaban
          </Link>
        </div>
      </Card>

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="min-w-0 space-y-5">
          {!attempt ? (
            <Card className="space-y-2 p-5">
              <p className="font-semibold text-foreground">Belum dikerjakan</p>
              <p className="text-sm text-muted-foreground">
                {detail.student_consent_ready
                  ? "Mahasiswa dapat mengerjakannya."
                  : "Persetujuan Kebijakan Privasi mahasiswa sedang tidak berlaku (belum menyetujui versi terbaru atau menariknya), sehingga belum bisa mengerjakan. Minta mereka masuk dan menyetujuinya, atau batalkan Cek Paham ini bila tidak diperlukan."}
              </p>
            </Card>
          ) : (
            <AttemptSection detail={detail} attempt={attempt} />
          )}

          {earlier.length > 0 ? (
            <CollapsibleSection
              title="Sesi sebelumnya yang dibatalkan"
              defaultOpen={false}
              summary={<span className="text-xs text-muted-foreground">{earlier.length} sesi</span>}
            >
              <div className="space-y-3">
                {earlier.map((old) => (
                  <Card key={old.id} className="p-4 text-sm">
                    <p className="font-medium text-foreground">Sesi {old.number}</p>
                    <p className="mt-1 text-muted-foreground">
                      {old.final_transcript || "Tidak ada transkrip."}
                    </p>
                  </Card>
                ))}
              </div>
            </CollapsibleSection>
          ) : null}
        </div>

        <aside className="min-w-0 space-y-4 xl:sticky xl:top-24">
          <Card className="p-5">
            <p className="caption-eyebrow mb-1 text-brand-ink">Soal Anda</p>
            <p className="text-foreground">{detail.question_text}</p>
          </Card>

          {written ? (
            <Card className="space-y-1 p-5">
              <p className="caption-eyebrow text-brand-ink">Analisis tulisan (terpisah)</p>
              <p className="text-sm text-muted-foreground">
                Indikasi AI pada teks:{" "}
                <strong className="text-foreground">{aiBandLabel(written.ai_band)}</strong>
              </p>
              <p className="text-sm text-muted-foreground">
                Level Bloom teramati:{" "}
                <strong className="text-foreground">
                  {bloomCode(written.bloom_level)} {bloomLabel(written.bloom_level)}
                </strong>
              </p>
            </Card>
          ) : null}

          <Alert variant="info" title="Nilai tugas tetap Anda yang menentukan">
            Skor Cek Paham hanya saran dan tidak mengisi formulir nilai. Ia berdiri sendiri, di
            samping analisis tulisan, bukan menggantikan atau menggabungkannya.
          </Alert>
        </aside>
      </div>
    </div>
  );
}
