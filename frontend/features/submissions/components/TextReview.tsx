"use client";

import { useState, type ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import { analyseRhythm, rhythmTone, type RhythmTone } from "@/features/submissions/lib/rhythm";
import type { StyleMarkerSpan, StyleMarkers } from "@/lib/types";
import { cn } from "@/lib/utils";

const TONE_CLASS: Record<Exclude<RhythmTone, null>, string> = {
  short: "bg-muted",
  long: "bg-secondary/60",
};

/** Teks [from, to) dengan penanda gaya yang jatuh di dalamnya (bila ditampilkan). */
function withMarkers(
  text: string,
  spans: StyleMarkerSpan[],
  from: number,
  to: number,
  show: boolean,
): ReactNode[] {
  if (!show) return [text.slice(from, to)];
  const out: ReactNode[] = [];
  let cursor = from;
  for (const span of spans) {
    const start = Math.max(span.start, cursor);
    const end = Math.min(span.end, to);
    if (end <= start) continue;
    if (start > cursor) out.push(text.slice(cursor, start));
    out.push(
      <mark
        key={`${span.start}-${span.key}`}
        title={span.key}
        className={cn(
          "rounded-sm px-0.5 text-foreground underline underline-offset-4",
          span.tier === "strong"
            ? "bg-warning-soft decoration-warning decoration-2"
            : "bg-transparent decoration-muted-foreground decoration-dotted",
        )}
      >
        {/* Karakter tak terlihat diberi bentuk supaya dosen bisa melihat letaknya. */}
        {span.key === "invisible" ? "␣" : text.slice(start, end)}
      </mark>,
    );
    cursor = end;
  }
  if (cursor < to) out.push(text.slice(cursor, to));
  return out;
}

function Toggle({
  checked,
  onChange,
  children,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  children: ReactNode;
}) {
  return (
    <label className="inline-flex cursor-pointer items-center gap-2 text-xs font-medium text-foreground">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="h-4 w-4 rounded border-border accent-primary"
      />
      {children}
    </label>
  );
}

/**
 * Satu teks, dua lapisan yang bisa dinyalakan sendiri-sendiri: penanda gaya (garis bawah) dan
 * ritme kalimat (warna latar menurut panjang). Rincian tiap penanda ada di bawahnya. Tidak masuk
 * skor AI; ini bahan untuk ditanyakan, bukan kesimpulan.
 */
export function TextReview({ text, markers }: { text: string; markers: StyleMarkers }) {
  const [showMarkers, setShowMarkers] = useState(true);
  const [showRhythm, setShowRhythm] = useState(true);
  const rhythm = analyseRhythm(text);
  const enoughForRhythm = rhythm.count >= 3;
  const strong = markers.markers.filter((marker) => marker.tier === "strong");
  const weak = markers.markers.filter((marker) => marker.tier === "weak");
  const tallest = Math.max(rhythm.longest, 1);

  // Sorotan yang saling tumpang tindih: yang pertama menang.
  let last = 0;
  const spans = markers.spans.filter((span) => {
    if (span.start < last || span.end > text.length) return false;
    last = span.end;
    return true;
  });

  const body: ReactNode[] = [];
  let cursor = 0;
  rhythm.pieces.forEach((piece, index) => {
    if (piece.start > cursor) body.push(text.slice(cursor, piece.start));
    const tone = showRhythm && enoughForRhythm ? rhythmTone(piece.words, rhythm.mean) : null;
    body.push(
      <span key={index} className={cn(tone && "rounded px-0.5", tone && TONE_CLASS[tone])}>
        {withMarkers(text, spans, piece.start, piece.end, showMarkers)}
      </span>,
    );
    cursor = piece.end;
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-x-5 gap-y-2">
        <p className="text-xs text-muted-foreground">
          {enoughForRhythm
            ? `${rhythm.count} kalimat · rata-rata ${rhythm.mean.toFixed(0)} kata · terpendek ${rhythm.shortest}, terpanjang ${rhythm.longest}`
            : "Terlalu pendek untuk membaca ritme kalimat."}
        </p>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
          <Toggle checked={showMarkers} onChange={setShowMarkers}>
            Penanda gaya
            {markers.spans.length ? (
              <Badge tone={markers.strong_total ? "warning" : "neutral"} size="sm">
                {markers.spans.length}
              </Badge>
            ) : null}
          </Toggle>
          <Toggle checked={showRhythm} onChange={setShowRhythm}>
            Ritme kalimat
          </Toggle>
        </div>
      </div>

      {enoughForRhythm && showRhythm ? (
        // Satu batang per kalimat, tingginya panjang kalimat: rata berarti seragam.
        <div className="flex h-10 items-end gap-0.5" aria-hidden="true">
          {rhythm.pieces
            .filter((piece) => piece.words > 0)
            .map((piece) => (
              <span
                key={piece.start}
                className="flex-1 rounded-t bg-primary/60"
                style={{ height: `${Math.max(8, (piece.words / tallest) * 100)}%` }}
                title={`${piece.words} kata`}
              />
            ))}
        </div>
      ) : null}

      <div className="max-h-[28rem] overflow-y-auto rounded-lg bg-muted/40 p-4">
        <p className="whitespace-pre-wrap break-words text-sm leading-7 text-foreground">{body}</p>
      </div>

      <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        {showMarkers ? (
          <>
            <li className="flex items-center gap-1.5">
              <span className="rounded-sm bg-warning-soft px-1 text-foreground underline decoration-warning decoration-2 underline-offset-4">
                Aa
              </span>
              Sisa salinan obrolan
            </li>
            <li className="flex items-center gap-1.5">
              <span className="px-1 text-foreground underline decoration-muted-foreground decoration-dotted underline-offset-4">
                Aa
              </span>
              Kebiasaan gaya
            </li>
          </>
        ) : null}
        {showRhythm && enoughForRhythm ? (
          <>
            <li className="flex items-center gap-1.5">
              <span className="h-3 w-5 rounded bg-muted" aria-hidden="true" /> Jauh lebih pendek
            </li>
            <li className="flex items-center gap-1.5">
              <span className="h-3 w-5 rounded bg-secondary/60" aria-hidden="true" /> Jauh lebih
              panjang
            </li>
          </>
        ) : null}
      </ul>

      {markers.markers.length ? (
        <ul className="space-y-2">
          {[...strong, ...weak].map((marker) => (
            <li key={marker.key} className="rounded-lg border border-border/70 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-semibold text-foreground">{marker.label}</p>
                <Badge tone={marker.tier === "strong" ? "warning" : "neutral"} size="sm">
                  {marker.count}× · {marker.tier === "strong" ? "kuat" : "lemah"}
                </Badge>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">{marker.hint}</p>
              {marker.examples.length ? (
                <ul className="mt-2 flex flex-wrap gap-1.5">
                  {marker.examples.map((example) => (
                    <li
                      key={example}
                      className="max-w-full break-words rounded bg-muted px-2 py-1 text-xs text-foreground"
                    >
                      {example}
                    </li>
                  ))}
                </ul>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">Tidak ada penanda gaya yang menonjol.</p>
      )}

      <p className="text-xs leading-relaxed text-muted-foreground">
        Sorotan ritme menandai panjang kalimat, bukan dugaan AI pada kalimat itu. Sisa salinan
        (simbol poin, markdown, kalimat “beri tahu saya”, karakter tak terlihat) muncul saat teks
        ditempel dari obrolan tanpa ditulis ulang; penanda lemah juga dipakai penulis manusia. Tanda
        air statistik milik penyedia model tidak bisa dibaca dari luar. Ini bahan bertanya, bukan
        vonis.
      </p>
    </div>
  );
}
