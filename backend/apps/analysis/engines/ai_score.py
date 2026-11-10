"""E1: skor indikasi AI heuristik (0-100) dari lima sinyal teks S1-S5.

skor = round(clamp01(sum(value_i * weight_i)) * 100); band: <42 rendah, <70 sedang, sisanya tinggi.
Baseline yang bisa dijelaskan, bukan detektor tervalidasi: skor 78 BUKAN "78% kemungkinan AI".
"""
from __future__ import annotations

from dataclasses import dataclass, replace

from apps.analysis.choices import AiBand
from apps.analysis.engines.process_signals import ProcessContext, evaluate_process
from apps.analysis.engines.text_features import TextFeatures


@dataclass(frozen=True)
class SignalScore:
    """Satu sinyal independen beserta kontribusinya ke skor akhir."""

    key: str
    label: str
    value: float
    weight: float
    evidence: str

    @property
    def contribution(self) -> float:
        return round(self.value * self.weight * 100, 1)

    def as_dict(self) -> dict:
        return {
            "key": self.key,
            "label": self.label,
            "value": round(self.value, 3),
            "weight": self.weight,
            "contribution": self.contribution,
            "evidence": self.evidence,
        }


@dataclass(frozen=True)
class AiScoreResult:
    score: int
    band: str
    breakdown: list[SignalScore]

    @property
    def evidence_lines(self) -> list[str]:
        """Sinyal berkontribusi terbesar lebih dulu, maksimal empat baris."""
        ranked = sorted(self.breakdown, key=lambda s: s.contribution, reverse=True)
        return [signal.evidence for signal in ranked[:4]]

    def breakdown_as_dicts(self) -> list[dict]:
        return [signal.as_dict() for signal in self.breakdown]


# Bobot S1-S5, jumlah 1.0 (dijaga tes). Hasil grid search ai_experiment/src/tune_weights.py
# (ROC-AUC test 0,884 -> 0,912). S3/S4 dipatok lantai 0,05: diam di gold set beregister abstrak.
# Mengubah bobot WAJIB menurunkan ulang MID_THRESHOLD.
TEXT_WEIGHTS = {
    "uniformity": 0.40,
    "formulaic_phrasing": 0.25,
    "impersonality": 0.05,
    "flat_certainty": 0.05,
    "lexical_uniformity": 0.25,
}

# Sinyal proses tidak masuk skor: ambang 42 diukur pada bobot teks murni, tidak ada data
# berlabel untuk proses, dan menulis di Word lalu menempel memberi lonjakan yang sama dengan menyalin.
PROCESS_WEIGHT = 0.0


def _clamp01(value: float) -> float:
    return max(0.0, min(1.0, value))


def _signal_uniformity(features: TextFeatures) -> SignalScore:
    """S1 keseragaman kalimat: value = clamp01(1 - burstiness / 0.6); netral 0.5 bila < 3 kalimat."""
    if features.sentence_count < 3:
        value = 0.5
        evidence = "Jumlah kalimat terlalu sedikit untuk menilai variasi panjang"
    else:
        value = _clamp01(1.0 - (features.burstiness / 0.6))
        if value > 0.6:
            evidence = (
                f"Panjang kalimat seragam, variasi hanya {features.burstiness:.2f} "
                f"dari rata rata {features.mean_sentence_length:.0f} kata"
            )
        else:
            evidence = (
                f"Panjang kalimat bervariasi wajar, variasi {features.burstiness:.2f}"
            )
    return SignalScore(
        key="uniformity",
        label="Keseragaman kalimat",
        value=value,
        weight=TEXT_WEIGHTS["uniformity"],
        evidence=evidence,
    )


def _signal_formulaic_phrasing(features: TextFeatures) -> SignalScore:
    """S2 frasa formulaik: value = clamp01(jenis LLM_PHRASES yang muncul / 4)."""
    value = _clamp01(features.llm_phrase_count / 4.0)
    if features.llm_phrase_count == 0:
        evidence = "Tidak ditemukan frasa transisi formulaik"
    else:
        evidence = (
            f"Ditemukan {features.llm_phrase_count} jenis frasa transisi formulaik"
        )
    return SignalScore(
        key="formulaic_phrasing",
        label="Frasa formulaik",
        value=value,
        weight=TEXT_WEIGHTS["formulaic_phrasing"],
        evidence=evidence,
    )


def _signal_impersonality(features: TextFeatures) -> SignalScore:
    """S3 ketiadaan suara personal: value = clamp01(1 - (personal + evidence) / 3)."""
    voice = features.personal_count + features.evidence_count
    value = _clamp01(1.0 - (voice / 3.0))
    if voice == 0:
        evidence = "Tidak ada sudut pandang pribadi maupun contoh konkret"
    else:
        evidence = f"Ada {voice} penanda sudut pandang pribadi atau contoh konkret"
    return SignalScore(
        key="impersonality",
        label="Ketiadaan suara personal",
        value=value,
        weight=TEXT_WEIGHTS["impersonality"],
        evidence=evidence,
    )


def _signal_flat_certainty(features: TextFeatures) -> SignalScore:
    """S4 ketiadaan keraguan: value = clamp01(1 - (hedging + informal) / 3)."""
    voice = features.hedging_count + features.informal_count
    value = _clamp01(1.0 - (voice / 3.0))
    if voice == 0:
        evidence = "Tidak ada keraguan, kualifikasi, maupun ragam informal"
    else:
        evidence = f"Ada {voice} penanda keraguan atau kualifikasi"
    return SignalScore(
        key="flat_certainty",
        label="Kepastian datar",
        value=value,
        weight=TEXT_WEIGHTS["flat_certainty"],
        evidence=evidence,
    )


# Panjang minimum gold set (ai_experiment/src/config.py MIN_WORDS); titik tengah 0,62 hanya teruji di atasnya.
LEXICAL_MIN_WORDS = 120


def _signal_lexical_uniformity(features: TextFeatures) -> SignalScore:
    """S5 keragaman kosakata: value = clamp01(|TTR - 0.62| / 0.25).

    Netral 0.5 bila < 120 kata: teks pendek selalu ber-TTR tinggi tanpa berarti apa-apa.
    """
    if features.word_count < LEXICAL_MIN_WORDS:
        value = 0.5
        evidence = (
            f"Teks {features.word_count} kata terlalu pendek untuk menilai "
            f"keragaman kosakata (butuh minimal {LEXICAL_MIN_WORDS} kata)"
        )
    else:
        deviation = abs(features.type_token_ratio - 0.62) / 0.25
        value = _clamp01(deviation)
        evidence = (
            f"Keragaman kosakata {features.type_token_ratio:.2f} "
            f"pada {features.word_count} kata"
        )
    return SignalScore(
        key="lexical_uniformity",
        label="Keragaman kosakata",
        value=value,
        weight=TEXT_WEIGHTS["lexical_uniformity"],
        evidence=evidence,
    )


# Ambang band heuristik 42/70 (beda dari Winston 35/70). MID 42 terukur bersama TEXT_WEIGHTS:
# ambang terendah dengan FPR < 5% di gold set 999 sampel (FPR 0,044, recall 0,607, presisi 0,932).
# HIGH 70 belum terukur: skor gold set maksimum 68, jadi band tinggi praktis tidak pernah aktif.
MID_THRESHOLD = 42
HIGH_THRESHOLD = 70


def score_to_band(ai_score: int) -> str:
    if ai_score < MID_THRESHOLD:
        return AiBand.LOW
    if ai_score < HIGH_THRESHOLD:
        return AiBand.MID
    return AiBand.HIGH


def text_signal_scores(features: TextFeatures) -> list[SignalScore]:
    """S1-S5 berbobot penuh; juga dipakai pipeline sebagai baris pembanding berbobot nol."""
    return [
        _signal_uniformity(features),
        _signal_formulaic_phrasing(features),
        _signal_impersonality(features),
        _signal_flat_certainty(features),
        _signal_lexical_uniformity(features),
    ]


def build_process_signal(context: ProcessContext) -> SignalScore:
    """Sinyal forensik proses sebagai baris breakdown berbobot PROCESS_WEIGHT (0)."""
    value, evidence = evaluate_process(context)
    return SignalScore(
        key="process_forensics",
        label="Forensik proses",
        value=value,
        weight=PROCESS_WEIGHT,
        evidence=evidence,
    )


def score_ai_probability(
    features: TextFeatures, process: ProcessContext | None = None
) -> AiScoreResult:
    """Skor AI = round(clamp01(sum(value * weight)) * 100) atas S1-S5 (+ baris proses berbobot 0).

    Tidak membaca level Bloom maupun target dosen (E1 dan E2 saling bebas).
    """
    text_signals = text_signal_scores(features)

    if process is None:
        breakdown = text_signals
    else:
        scale = 1.0 - PROCESS_WEIGHT
        breakdown = [
            replace(signal, weight=round(signal.weight * scale, 4))
            for signal in text_signals
        ]
        breakdown.append(build_process_signal(process))

    raw = sum(signal.value * signal.weight for signal in breakdown)
    score = int(round(_clamp01(raw) * 100))
    return AiScoreResult(score=score, band=score_to_band(score), breakdown=breakdown)

