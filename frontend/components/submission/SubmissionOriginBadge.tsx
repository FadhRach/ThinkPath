import type { ImportMetadata, SubmissionOrigin } from "@/lib/types";

/**
 * Menandai submission yang baseline awalnya berasal dari dokumen yang
 * diunggah, bukan diketik langsung.
 *
 * Sinyal forensik proses (kecepatan mengetik, kurva pertumbuhan kata) tidak
 * punya baseline yang bisa diukur untuk momen impor - lihat
 * backend/academics/process_signals.py dan views._create_submission. Badge
 * ini memberi tahu dosen kenapa sinyal itu tampak lebih tipis untuk
 * submission tertentu, supaya tidak dibaca sebagai kejanggalan.
 */
const ORIGIN_COPY: Record<SubmissionOrigin, { label: string; hint: string } | null> = {
  typed: null,
  document_import: {
    label: "Diimpor dari dokumen",
    hint: "Jawaban ini dimulai dari unggahan dokumen, bukan diketik langsung. Sinyal proses (kecepatan mengetik, kurva pertumbuhan kata) lebih tipis untuk baseline impor; revisi manual setelahnya tetap terekam normal.",
  },
};

interface Props {
  origin: SubmissionOrigin;
  importMetadata?: ImportMetadata | null;
}

export function SubmissionOriginBadge({ origin, importMetadata }: Props) {
  const copy = ORIGIN_COPY[origin];
  if (!copy) return null;
  const label = importMetadata ? `${copy.label} (${importMetadata.filename})` : copy.label;
  return (
    <span
      title={copy.hint}
      className="inline-flex items-center rounded-full bg-muted px-3 py-1 text-body-sm font-medium text-muted-foreground"
    >
      {label}
    </span>
  );
}
