"use client";

import { useState, type ReactNode } from "react";

import { GradingForm } from "@/features/submissions/components/GradingForm";
import { SuggestionPanel } from "@/features/submissions/components/SuggestionPanel";

interface ReviewSidebarProps {
  submissionId: string;
  grade: number | null;
  feedback: string;
  /** Analisis selesai: saran AI baru bisa diminta. */
  analysisReady: boolean;
  /** Bagian server (Cek Paham, kemiripan) yang ikut ditumpuk di kolom ini. */
  children: ReactNode;
}

/**
 * Kolom kanan pemeriksaan: nilai dan umpan balik di atas, lalu saran AI, lalu Cek Paham dan
 * pembanding. Umpan balik dipegang di sini supaya draf dari saran bisa mengisinya tanpa
 * menimpa tulisan dosen secara diam-diam (dosen menekan "Pakai sebagai draf" dan masih bisa
 * menyuntingnya sebelum menyimpan).
 */
export function ReviewSidebar({
  submissionId,
  grade,
  feedback,
  analysisReady,
  children,
}: ReviewSidebarProps) {
  const [draft, setDraft] = useState<string | null>(null);

  return (
    <div className="space-y-4">
      <GradingForm
        submissionId={submissionId}
        initialGrade={grade}
        initialFeedback={feedback}
        draft={draft}
      />
      <SuggestionPanel
        submissionId={submissionId}
        ready={analysisReady}
        onUseFeedbackDraft={setDraft}
      />
      {children}
    </div>
  );
}
