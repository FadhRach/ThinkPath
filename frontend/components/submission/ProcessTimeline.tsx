import type { EventType, ReasoningEventView } from "@/lib/types";
import { DISPLAY_TIME_ZONE, formatClockHHMM, formatDurationSeconds } from "@/lib/formatting";
import { cn } from "@/lib/utils";

interface Props {
  events: ReasoningEventView[];
  startedAt: string;
  submittedAt: string | null;
}

interface Marker {
  type: EventType;
  at: string;
  offsetMs: number;
  label: string;
  detail: string;
}

const EVENT_META: Record<EventType, { dot: string; label: string }> = {
  started: { dot: "bg-muted-foreground/60", label: "Mulai" },
  revision: { dot: "bg-primary", label: "Revisi" },
  // Tidak lagi direkam: menempel kutipan dari rujukan itu wajar. Baris lama
  // yang masih memuatnya disaring di toMarkers, bukan ditampilkan.
  paste: { dot: "bg-muted-foreground/40", label: "Tempel" },
  submitted: { dot: "bg-foreground/70", label: "Kumpul" },
  // Cuplikan berkala tidak digambar sebagai penanda: jumlahnya puluhan dan
  // akan menutupi linimasa. Ia punya kurvanya sendiri di bawah.
  progress: { dot: "bg-muted-foreground/40", label: "Cuplikan" },
};

function detailFor(event: ReasoningEventView): string {
  const payload = event.payload ?? {};
  if (event.event_type === "revision") {
    const words = payload.word_count;
    return typeof words === "number" ? `${words} kata saat itu` : "Penyuntingan";
  }
  return "";
}

function toMarkers(events: ReasoningEventView[], start: number): Marker[] {
  return [...events]
    .filter((event) => event.event_type !== "progress" && event.event_type !== "paste")
    .sort(
      (a, b) => new Date(a.occurred_at).getTime() - new Date(b.occurred_at).getTime(),
    )
    .map((event) => ({
      type: event.event_type,
      at: event.occurred_at,
      offsetMs: new Date(event.occurred_at).getTime() - start,
      label: EVENT_META[event.event_type]?.label ?? event.event_type,
      detail: detailFor(event),
    }));
}

interface GrowthPoint {
  offset: number;
  words: number;
}

function toGrowth(events: ReasoningEventView[], start: number): GrowthPoint[] {
  return events
    .filter((event) => event.event_type === "progress")
    .map((event) => ({
      offset: new Date(event.occurred_at).getTime() - start,
      words: typeof event.payload?.word_count === "number" ? event.payload.word_count : 0,
    }))
    .sort((a, b) => a.offset - b.offset);
}

/**
 * Kurva pertumbuhan kata sepanjang pengerjaan.
 *
 * Bentuknya yang bercerita, bukan angkanya. Menulis sungguhan menanjak
 * bertahap; menempel lalu menunggu menghasilkan satu dinding tegak diikuti
 * dataran panjang. Dosen tidak perlu membaca satu angka pun untuk melihat
 * bedanya, dan itu sengaja: layar ini menyodorkan bukti, bukan vonis.
 */
function GrowthCurve({ points }: { points: GrowthPoint[] }) {
  const last = points[points.length - 1];
  const maxWords = Math.max(...points.map((p) => p.words), 1);
  const span = Math.max(last.offset, 1);

  const path = points
    .map((point, index) => {
      const x = (point.offset / span) * 100;
      const y = 100 - (point.words / maxWords) * 100;
      return `${index === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(" ");

  return (
    <div className="space-y-1.5">
      <p className="text-caption text-muted-foreground">
        Pertumbuhan kata, {points.length} cuplikan sampai {maxWords} kata
      </p>
      <svg
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        className="h-20 w-full rounded-lg bg-muted/40"
        role="img"
        aria-label={`Kurva pertumbuhan kata dari ${points.length} cuplikan`}
      >
        <path
          d={`${path} L 100 100 L 0 100 Z`}
          fill="hsl(var(--brand-teal) / 0.14)"
          stroke="none"
        />
        <path
          d={path}
          fill="none"
          stroke="hsl(var(--brand-teal))"
          strokeWidth={1.5}
          vectorEffect="non-scaling-stroke"
        />
      </svg>
    </div>
  );
}

/**
 * Jejak pengerjaan pada sumbu waktu, bukan sebagai kalimat.
 *
 * Sinyal proses adalah satu satunya masukan yang tidak berasal dari statistik
 * teks, sehingga paling sulit dipalsukan dengan menulis ulang jawaban. Bentuk
 * linimasa memaparkan pola yang tidak tertangkap angka: satu tempel besar di
 * awal lalu langsung kumpul terbaca berbeda dari revisi yang menyebar sepanjang
 * pengerjaan, walaupun durasi totalnya sama.
 *
 * Di jalur waktu hanya ada titik kecil tanpa label. Label jam per penanda dulu
 * saling menimpa begitu dua peristiwa berdekatan; jam dan rinciannya kini
 * dibaca di daftar di bawahnya, satu baris per peristiwa.
 *
 * Yang sengaja tidak dilakukan: memberi vonis pada pola mana pun. Menempel
 * kutipan panjang dari jurnal itu wajar dalam menulis akademik.
 */
export function ProcessTimeline({ events, startedAt, submittedAt }: Props) {
  const start = new Date(startedAt).getTime();
  const markers = toMarkers(events, start);
  const growth = toGrowth(events, start);

  if (markers.length === 0) {
    return (
      <p className="text-body-sm text-muted-foreground">
        Tidak ada jejak proses yang terekam untuk submission ini.
      </p>
    );
  }

  const end = submittedAt ? new Date(submittedAt).getTime() : Date.now();
  const span = Math.max(end - start, 1);

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <div className="relative mx-1.5 h-5" role="img" aria-label="Posisi peristiwa pada rentang pengerjaan">
          <div className="absolute inset-x-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-muted" />
          {markers.map((marker, index) => {
            const offset = Math.min(100, Math.max(0, (marker.offsetMs / span) * 100));
            return (
              <span
                key={`${marker.type}-${index}`}
                className={cn(
                  "absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-card",
                  EVENT_META[marker.type]?.dot,
                )}
                style={{ left: `${offset}%` }}
                title={`${marker.label} pukul ${formatClockHHMM(marker.at)}`}
              />
            );
          })}
        </div>
        <div className="flex justify-between text-caption text-muted-foreground">
          <span>{formatClockHHMM(startedAt)}</span>
          <span>{submittedAt ? formatClockHHMM(submittedAt) : "belum dikumpulkan"}</span>
        </div>
      </div>

      {growth.length >= 2 ? <GrowthCurve points={growth} /> : null}

      <ol className="space-y-2.5 border-t border-border pt-3">
        {markers.map((marker, index) => (
          <li
            key={`row-${marker.type}-${index}`}
            className="grid grid-cols-[auto_1fr_auto] items-baseline gap-x-2.5 text-body-sm"
          >
            <span
              aria-hidden="true"
              className={cn(
                "h-2.5 w-2.5 translate-y-px self-center rounded-full",
                EVENT_META[marker.type]?.dot,
              )}
            />
            <span className="min-w-0">
              <span className="font-medium text-foreground">{marker.label}</span>{" "}
              <span className="tabular-nums text-muted-foreground">
                {formatClockHHMM(marker.at)}
              </span>
              {marker.detail ? (
                <span className="block text-caption text-muted-foreground">
                  {marker.detail}
                </span>
              ) : null}
            </span>
            <span className="text-caption tabular-nums text-muted-foreground">
              {marker.offsetMs > 0
                ? `+${formatDurationSeconds(Math.round(marker.offsetMs / 1000))}`
                : ""}
            </span>
          </li>
        ))}
      </ol>

      <p className="text-caption text-muted-foreground">
        Jam dalam {DISPLAY_TIME_ZONE.replace("_", " ")}; angka di kanan adalah
        waktu sejak mulai. Pola di sini bahan tanya, bukan bukti: menempel
        kutipan panjang adalah hal biasa dalam menulis akademik.
      </p>
    </div>
  );
}
