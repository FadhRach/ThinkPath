import Link from "next/link";

import { bandsForRow } from "@/lib/evidence";
import { formatDurationSeconds, formatRelativeTime } from "@/lib/formatting";
import type { SubmissionRow } from "@/lib/types";

import { EvidenceStripMini } from "./EvidenceStripMini";

interface Props {
  submissions: SubmissionRow[];
  expectedBloomLevel: number;
}

const STATUS_LABEL: Record<SubmissionRow["status"], string> = {
  draft: "Draf",
  submitted: "Perlu ditinjau",
  reviewed: "Sudah ditinjau",
};

export function SubmissionTable({ submissions, expectedBloomLevel }: Props) {
  return (
    <div className="bg-paper-elevated border border-border rounded-card overflow-hidden">
      <table className="w-full text-left">
        <thead>
          <tr className="border-b border-border bg-paper">
            <th className="caption-eyebrow px-4 py-3 w-16">Bukti</th>
            <th className="caption-eyebrow px-4 py-3">Siswa</th>
            <th className="caption-eyebrow px-4 py-3">Submit</th>
            <th className="caption-eyebrow px-4 py-3">Durasi</th>
            <th className="caption-eyebrow px-4 py-3">Revisi</th>
            <th className="caption-eyebrow px-4 py-3">Status</th>
          </tr>
        </thead>
        <tbody>
          {submissions.map((row) => {
            const bands = bandsForRow(row, expectedBloomLevel);
            return (
              <tr
                key={row.id}
                className="border-b border-border last:border-b-0 hover:bg-[#F4F1EA] transition"
              >
                <td className="px-4 py-3.5">
                  <Link href={`/dashboard/submission/${row.id}`} className="block">
                    <EvidenceStripMini {...bands} />
                  </Link>
                </td>
                <td className="px-4 py-3.5 text-body">
                  <Link href={`/dashboard/submission/${row.id}`} className="block">
                    {row.student.display_name}
                  </Link>
                </td>
                <td className="px-4 py-3.5 text-body-sm text-ink-muted">
                  {formatRelativeTime(row.submitted_at)}
                </td>
                <td className="px-4 py-3.5 text-body-sm text-ink-muted">
                  {formatDurationSeconds(row.duration_seconds)}
                </td>
                <td className="px-4 py-3.5 text-body-sm text-ink-muted">
                  {row.revision_count}
                </td>
                <td className="px-4 py-3.5 text-body-sm">
                  {STATUS_LABEL[row.status]}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
