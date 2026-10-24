import { ClipboardCheck } from "lucide-react";
import Link from "next/link";

import { Card } from "@/components/ui/card";
import { IconTile } from "@/components/ui/icon-tile";
import { BloomStepper } from "@/features/bloom/components/BloomStepper";
import { bloomCode, bloomShortLabel } from "@/features/bloom/lib/bloom";

const STEPS = [
  "Tulis jawabanmu pada kolom pengumpulan.",
  "Periksa kembali isi jawaban sebelum dikirim.",
  "Tekan Kumpulkan Jawaban.",
];

/** Panduan singkat mengumpulkan, target Bloom tugas, dan jalan kembali ke daftar tugas. */
export function SubmitGuideCard({ targetLevel }: { targetLevel: number }) {
  return (
    <>
      <Card className="p-5">
        <div className="flex items-center gap-2.5">
          <IconTile icon={ClipboardCheck} size="sm" />
          <h2 className="font-bold text-foreground">Cara mengumpulkan</h2>
        </div>
        <ol className="mt-4 space-y-3 text-sm text-muted-foreground">
          {STEPS.map((step, index) => (
            <li key={step} className="flex gap-2.5">
              <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-muted text-micro font-semibold">
                {index + 1}
              </span>
              <span className="pt-0.5 leading-relaxed">{step}</span>
            </li>
          ))}
        </ol>
        <div className="mt-4 rounded-xl bg-muted p-3.5">
          <p className="text-xs font-bold text-accent-foreground">
            Target {bloomCode(targetLevel)} &middot; {bloomShortLabel(targetLevel)}
          </p>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            Level dengan garis putus-putus adalah target berpikir untuk tugas ini.
          </p>
          <div className="mt-3">
            <BloomStepper targetLevel={targetLevel} />
          </div>
        </div>
      </Card>
      <Card className="p-5">
        <p className="text-sm leading-relaxed text-muted-foreground">
          Jika tugas belum dinilai, kamu masih dapat memperbarui jawaban selama tenggat belum lewat.
        </p>
        <Link
          href="/student/tugas"
          className="mt-3 inline-flex items-center gap-1.5 text-xs font-bold text-brand-ink hover:underline"
        >
          <ClipboardCheck className="h-3.5 w-3.5" aria-hidden="true" />
          Kembali ke daftar tugas
        </Link>
      </Card>
    </>
  );
}
