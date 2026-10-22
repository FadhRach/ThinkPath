import { Callout } from "@/components/common/Callout";
import { SectionCard } from "@/components/common/SectionCard";
import {
  CekPahamAudio,
  ReportResolver,
  ReprocessCekPahamButton,
} from "@/components/cekpaham/CekPahamActions";
import { BandBadge } from "@/components/cekpaham/CekPahamBadges";
import {
  DIMENSION_LABEL,
  FLAG_LABEL,
  REPORT_REASON_LABEL,
  UNCALIBRATED_NOTE,
} from "@/lib/cekpaham";
import { formatClockHHMM, formatDate } from "@/lib/formatting";
import type { CekPahamAttemptView, CekPahamDetail } from "@/lib/types";
import { cn } from "@/lib/utils";

const MAX_LEVEL = 3;
// Selisih karakter transkrip live vs final yang dianggap besar (tampilan, bukan penilaian).
const LARGE_DIFF_RATIO = 0.35;

const ERROR_HINT: Record<string, string> = {
  stt_quota: "Kuota transkripsi penyedia habis sementara. Coba proses ulang nanti.",
  stt_rate_limited: "Penyedia transkripsi sedang sibuk. Coba proses ulang sebentar lagi.",
  stt_timeout: "Transkripsi melewati batas waktu. Coba proses ulang.",
  stt_unavailable: "Penyedia transkripsi tidak dapat dihubungi. Coba proses ulang.",
  stt_bad_audio: "Audio tidak dapat dibaca penyedia transkripsi. Dengarkan audionya langsung.",
  judge_failed: "Penilaian otomatis gagal. Transkrip sudah ada; proses ulang hanya mengulang penilaiannya.",
  no_audio: "Tidak ada audio yang terkirim dari sesi ini.",
};

function liveDiffers(attempt: CekPahamAttemptView): boolean {
  const live = attempt.live_transcript.trim();
  const final = attempt.final_transcript.trim();
  if (!live || !final) return false;
  return Math.abs(live.length - final.length) / Math.max(live.length, final.length) > LARGE_DIFF_RATIO;
}

interface Props {
  detail: CekPahamDetail;
  attempt: CekPahamAttemptView;
}

/** Semua yang dosen lihat dari satu sesi menjawab, dari atas ke bawah. */
export function AttemptSection({ detail, attempt }: Props) {
  return (
    <>
      {attempt.status === "processing_failed" || attempt.status === "interrupted" ? (
        <StuckNotice detail={detail} attempt={attempt} />
      ) : null}
      {attempt.status === "scored" ? <ScoreCard attempt={attempt} /> : null}
      <TranscriptCard detail={detail} attempt={attempt} />
      <SessionContext attempt={attempt} />
      {attempt.reports.length > 0 ? <ReportsCard attempt={attempt} /> : null}
    </>
  );
}

function StuckNotice({ detail, attempt }: Props) {
  return (
    <Callout variant="warning" title={attempt.status === "interrupted" ? "Sesi terputus" : "Pemrosesan terhambat"}>
      <p>{ERROR_HINT[attempt.error_code] ?? "Hasilnya belum dapat dihitung."}</p>
      {attempt.audio_available ? (
        <div className="mt-3">
          <ReprocessCekPahamButton id={detail.id} attemptNumber={attempt.number} />
        </div>
      ) : null}
    </Callout>
  );
}

function ScoreCard({ attempt }: { attempt: CekPahamAttemptView }) {
  const dimensions = Object.entries(attempt.ai_dimensions);

  return (
    <SectionCard eyebrow="Saran skor">
      <div className="flex flex-wrap items-end gap-4">
        <div>
          <p className="text-display-2 font-extrabold tabular-nums text-foreground">
            {attempt.ai_score ?? "-"}
            {attempt.ai_score !== null ? <span className="text-body text-muted-foreground"> / 100</span> : null}
          </p>
          {attempt.ai_band ? <BandBadge band={attempt.ai_band} /> : null}
        </div>
        <p className="max-w-xl text-body-sm text-muted-foreground">{attempt.ai_summary}</p>
      </div>

      {attempt.ai_score === null ? (
        <Callout variant="warning">
          Skor sengaja dikosongkan karena buktinya kurang. Dengarkan audionya dan nilai sendiri.
        </Callout>
      ) : null}

      <p className="text-caption text-muted-foreground">{UNCALIBRATED_NOTE}</p>

      {attempt.ai_flags.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {attempt.ai_flags.map((flag) => (
            <span key={flag} className="rounded-full bg-warning-soft px-2.5 py-0.5 text-caption font-medium text-warning">
              {FLAG_LABEL[flag] ?? flag}
            </span>
          ))}
        </div>
      ) : null}

      {dimensions.length > 0 ? (
        <div className="space-y-3">
          {dimensions.map(([name, dimension]) => (
            <DimensionRow key={name} name={name} dimension={dimension} />
          ))}
        </div>
      ) : null}

      {attempt.judge_runs.length > 1 ? (
        <p className="text-caption text-muted-foreground">
          Dua penilaian dengan urutan rubrik dibalik: {attempt.judge_runs.map((run) => run.score).join(" dan ")}.
          Model {attempt.judge_model}, rubrik {attempt.rubric_version}.
        </p>
      ) : null}
    </SectionCard>
  );
}

function DimensionRow({
  name,
  dimension,
}: {
  name: string;
  dimension: CekPahamAttemptView["ai_dimensions"][string];
}) {
  return (
    <div className="rounded-xl border border-border p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="font-semibold text-foreground">{DIMENSION_LABEL[name] ?? name}</p>
        <div className="flex items-center gap-1" aria-label={`Level ${dimension.level} dari ${MAX_LEVEL}`}>
          {Array.from({ length: MAX_LEVEL }, (_, i) => (
            <span key={i} className={cn("h-2 w-6 rounded-full", i < dimension.level ? "bg-primary" : "bg-secondary")} />
          ))}
        </div>
      </div>
      <p className="mt-1 text-body-sm text-muted-foreground">{dimension.reason}</p>
      {dimension.evidence.map((quote) => (
        <blockquote key={quote} className="mt-2 border-l-2 border-primary pl-3 text-body-sm italic text-foreground">
          &ldquo;{quote}&rdquo;
        </blockquote>
      ))}
    </div>
  );
}

function TranscriptCard({ detail, attempt }: Props) {
  const differs = liveDiffers(attempt);

  return (
    <SectionCard eyebrow="Jawaban lisan">
      {attempt.audio_available ? (
        <CekPahamAudio id={detail.id} attemptNumber={attempt.number} />
      ) : (
        <p className="text-body-sm text-muted-foreground">Audio tidak tersimpan atau sudah melewati masa simpan.</p>
      )}
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <p className="caption-eyebrow mb-1 text-primary">Transkrip server (dasar penilaian)</p>
          <p className="rounded-xl border border-border p-4 text-body-sm leading-relaxed text-foreground">
            {attempt.final_transcript || "Belum ada transkrip."}
          </p>
        </div>
        <div>
          <p className="caption-eyebrow mb-1 text-muted-foreground">Caption langsung (hanya pembanding)</p>
          <p
            className={cn(
              "rounded-xl border p-4 text-body-sm leading-relaxed text-muted-foreground",
              differs ? "border-warning" : "border-border",
            )}
          >
            {attempt.live_transcript || "Tidak ada."}
          </p>
          {differs ? (
            <p className="mt-1 text-caption text-warning">Selisih besar dengan transkrip server; dengarkan audionya.</p>
          ) : null}
        </div>
      </div>
      <p className="text-caption text-muted-foreground">
        Transkrip dibuat otomatis dan bisa salah dengar pada ucapan spontan. Segmen yang diragukan:{" "}
        {attempt.asr_quality.unsure?.length ? attempt.asr_quality.unsure.join("; ") : "tidak ada"}.
      </p>
    </SectionCard>
  );
}

function SessionContext({ attempt }: { attempt: CekPahamAttemptView }) {
  const events = attempt.client_events;

  return (
    <SectionCard eyebrow="Konteks sesi (tidak dinilai)">
      <dl className="grid gap-3 text-body-sm sm:grid-cols-3">
        <Fact
          label="Mulai bicara setelah"
          value={attempt.first_speech_offset_s !== null ? `${attempt.first_speech_offset_s.toFixed(1)} detik` : "-"}
        />
        <Fact
          label="Durasi audio"
          value={attempt.audio_duration_s !== null ? `${attempt.audio_duration_s.toFixed(0)} detik` : "-"}
        />
        <Fact label="Pindah tab / jendela" value={`${events.visibility_changes ?? 0} / ${events.blur_count ?? 0}`} />
        <Fact label="Ganti perangkat mikrofon" value={String(events.device_changes ?? 0)} />
        <Fact label="Galat mikrofon" value={String(events.mic_errors ?? 0)} />
        <Fact label="Diam (detik)" value={String(events.silent_seconds ?? 0)} />
      </dl>
      <p className="text-caption text-muted-foreground">
        Ini hanya konteks. Pindah tab atau jeda panjang punya banyak sebab wajar dan tidak ikut menghitung skor.
      </p>
    </SectionCard>
  );
}

function ReportsCard({ attempt }: { attempt: CekPahamAttemptView }) {
  const open = attempt.reports.filter((report) => report.status === "open").length;

  return (
    <SectionCard eyebrow={`Laporan mahasiswa${open ? ` (${open} menunggu)` : ""}`}>
      <div className="space-y-4">
        {attempt.reports.map((report) => (
          <div key={report.id} className="space-y-3 rounded-xl border border-border p-4">
            <p className="font-semibold text-foreground">
              {REPORT_REASON_LABEL[report.reason]}{" "}
              <span className="text-caption font-normal text-muted-foreground">
                &middot; {formatDate(report.created_at)} {formatClockHHMM(report.created_at)}
              </span>
            </p>
            {report.note ? (
              <p className="text-body-sm text-foreground">&ldquo;{report.note}&rdquo;</p>
            ) : report.reason === "other" ? (
              <p className="text-body-sm text-muted-foreground">Mahasiswa melaporkan kendala tanpa keterangan.</p>
            ) : null}
            {report.status === "open" ? (
              <ReportResolver reportId={report.id} />
            ) : (
              <p className="text-body-sm text-muted-foreground">
                {report.status === "retry_granted" ? "Coba ulang diberikan." : "Laporan ditolak."}{" "}
                {report.response_note}
              </p>
            )}
          </div>
        ))}
      </div>
    </SectionCard>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-caption text-muted-foreground">{label}</dt>
      <dd className="font-semibold text-foreground">{value}</dd>
    </div>
  );
}
