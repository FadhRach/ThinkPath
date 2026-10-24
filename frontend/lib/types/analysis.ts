import type { AiBand, AnalysisSource, Confidence, ProcessBand } from "./common";

/** Kontribusi satu sinyal terhadap skor AI. Jumlah seluruh contribution
 *  sama dengan ai_score, sehingga skor bisa ditelusuri dosen. */
export interface SignalContribution {
  key: string;
  label: string;
  value: number;
  weight: number;
  contribution: number;
  evidence: string;
}

export interface AnalysisView {
  ai_score: number;
  ai_band: AiBand;
  bloom_level: number;
  /** Keyakinan terhadap skor AI. */
  confidence: Confidence;
  /** Keyakinan terhadap level Bloom. Dinilai terpisah karena satu teks bisa
   *  jelas di satu dimensi dan ambigu di dimensi lain. */
  bloom_confidence: Confidence;
  signals: string[];
  /** Kosong pada jalur LLM, karena rincian bobot hanya dimiliki heuristik. */
  signal_breakdown: SignalContribution[];
  summary: string;
  recommendation: string;
  analysis_source: AnalysisSource;
  process_band: ProcessBand;
  process_evidence: string;
}

/** Satu baris riwayat analisis; setiap analisis tersimpan permanen. */
export interface AnalysisRunView {
  id: string;
  trigger: "submit" | "revise" | "reanalyze";
  created_at: string;
  ai_score: number;
  ai_band: AiBand;
  bloom_level: number;
  analysis_source: AnalysisSource;
}
