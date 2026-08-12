import { ClipboardPaste, Flag, PenLine, Send } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import type { EventType, ReasoningEventView } from "@/lib/types";
import { formatClockHHMM } from "@/lib/formatting";
import { cn } from "@/lib/utils";

interface Props {
  events: ReasoningEventView[];
  startedAt: string;
  submittedAt: string | null;
}

interface Marker {
  type: EventType;
  at: string;
  label: string;
  detail: string;
}

const EVENT_META: Record<EventType, { icon: LucideIcon; tone: string; label: string }> = {
  started: { icon: Flag, tone: "text-muted-foreground", label: "Mulai" },
  revision: { icon: PenLine, tone: "text-primary", label: "Revisi" },
  paste: { icon: ClipboardPaste, tone: "text-danger", label: "Tempel" },
  submitted: { icon: Send, tone: "text-muted-foreground", label: "Kumpul" },
};

function detailFor(event: ReasoningEventView): string {
  const payload = event.payload ?? {};
  if (event.event_type === "paste") {
    const chars = payload.char_count;
    return typeof chars === "number" ? `${chars} karakter sekaligus` : "Tempel teks";
  }
  if (event.event_type === "revision") {
    const words = payload.word_count;
    return typeof words === "number" ? `${words} kata saat itu` : "Penyuntingan";
  }
  return "";
}

function toMarkers(events: ReasoningEventView[]): Marker[] {
  return [...events]
    .sort(
      (a, b) => new Date(a.occurred_at).getTime() - new Date(b.occurred_at).getTime(),
    )
    .map((event) => ({
      type: event.event_type,
      at: event.occurred_at,
      label: EVENT_META[event.event_type]?.label ?? event.event_type,
      detail: detailFor(event),
    }));
}

/**
 * Jejak pengerjaan pada sumbu waktu, bukan sebagai kalimat.
 *
 * Sinyal proses adalah satu satunya masukan yang tidak berasal dari statistik
 * teks, sehingga paling sulit dipalsukan dengan menulis ulang jawaban. Sampai
 * sekarang ia justru yang paling tidak terlihat di layar, terangkum menjadi
 * satu kalimat. Bentuk linimasa memaparkan pola yang tidak tertangkap angka:
 * satu tempel besar di awal lalu langsung kumpul terbaca berbeda dari revisi
 * yang menyebar sepanjang pengerjaan, walaupun durasi totalnya sama.
 *
 * Yang sengaja tidak dilakukan: memberi vonis pada pola mana pun. Menempel
 * kutipan panjang dari jurnal itu wajar dalam menulis akademik.
 */
export function ProcessTimeline({ events, startedAt, submittedAt }: Props) {
  const markers = toMarkers(events);

  if (markers.length === 0) {
    return (
      <p className="text-body-sm text-muted-foreground">
        Tidak ada jejak proses yang terekam untuk submission ini.
      </p>
    );
  }

  const start = new Date(startedAt).getTime();
  const end = submittedAt ? new Date(submittedAt).getTime() : Date.now();
  const span = Math.max(end - start, 1);

  return (
    <div className="space-y-4">
      <div className="relative h-14">
        <div className="absolute inset-x-0 top-6 h-1 rounded-full bg-muted" />
        {markers.map((marker, index) => {
          const offset = Math.min(
            100,
            Math.max(0, ((new Date(marker.at).getTime() - start) / span) * 100),
          );
          const meta = EVENT_META[marker.type];
          const Icon = meta?.icon ?? Flag;
          return (
            <span
              key={`${marker.type}-${index}`}
              className="absolute top-0 -translate-x-1/2"
              style={{ left: `${offset}%` }}
              title={`${marker.label} pukul ${formatClockHHMM(marker.at)}${
                marker.detail ? ` (${marker.detail})` : ""
              }`}
            >
              <span
                className={cn(
                  "grid h-8 w-8 place-items-center rounded-full border-2 border-card bg-muted",
                  meta?.tone,
                )}
              >
                <Icon className="h-4 w-4" />
              </span>
              <span className="mt-0.5 block text-center text-caption text-muted-foreground">
                {formatClockHHMM(marker.at)}
              </span>
            </span>
          );
        })}
      </div>

      <ul className="space-y-2 border-t border-border pt-3">
        {markers.map((marker, index) => {
          const meta = EVENT_META[marker.type];
          const Icon = meta?.icon ?? Flag;
          return (
            <li
              key={`row-${marker.type}-${index}`}
              className="flex items-baseline gap-2.5 text-body-sm"
            >
              <Icon className={cn("h-3.5 w-3.5 shrink-0", meta?.tone)} />
              <span className="font-medium text-foreground">{marker.label}</span>
              <span className="text-muted-foreground">
                {formatClockHHMM(marker.at)}
              </span>
              {marker.detail ? (
                <span className="ml-auto text-caption text-muted-foreground">
                  {marker.detail}
                </span>
              ) : null}
            </li>
          );
        })}
      </ul>

      <p className="text-caption text-muted-foreground">
        Jam dirender di server dan mengikuti zona waktunya, sama seperti waktu
        mulai dan kumpul di atas. Pola di sini bahan tanya, bukan bukti:
        menempel kutipan panjang adalah hal biasa dalam menulis akademik.
      </p>
    </div>
  );
}
