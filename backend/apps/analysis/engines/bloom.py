"""E2: taksiran level Bloom heuristik dari TextFeatures saja.

level = level tertinggi dengan skor bukti >= 2.0 (jatuh ke L1), lalu dibatasi panjang teks.
Tidak membaca ai_score maupun expected_bloom_level (target dibandingkan nanti di heuristic.py).
"""
from __future__ import annotations

from dataclasses import dataclass

from apps.analysis.choices import Confidence
from apps.analysis.engines.text_features import TextFeatures

BLOOM_LABELS = {
    1: "Mengingat",
    2: "Memahami",
    3: "Menerapkan",
    4: "Menganalisis",
    5: "Mengevaluasi",
    6: "Mencipta",
}

# Level maksimum menurut jumlah kata: < 50 -> L1, < 90 -> L2, < 140 -> L3, < 200 -> L4, < 280 -> L5.
LENGTH_CAPS = (
    (50, 1),
    (90, 2),
    (140, 3),
    (200, 4),
    (280, 5),
)

# Daftar kata kunci (kepadatan penanda > 0,25) dibatasi L2; teks bukan Indonesia diberi keyakinan rendah.
STUFFING_DENSITY = 0.25
STUFFED_LEVEL_CAP = 2
MIN_INDONESIAN_RATIO = 0.12

# Ambang bukti minimum agar sebuah level dianggap benar benar ditunjukkan.
EVIDENCE_THRESHOLD = 2.0


@dataclass(frozen=True)
class BloomResult:
    level: int
    confidence: str
    evidence: list[str]
    level_scores: dict[int, float]

    @property
    def label(self) -> str:
        return BLOOM_LABELS[self.level]

    def as_dict(self) -> dict:
        return {
            "level": self.level,
            "label": self.label,
            "confidence": self.confidence,
            "evidence": self.evidence,
            "level_scores": {str(k): round(v, 2) for k, v in self.level_scores.items()},
        }


def _length_cap(word_count: int) -> int:
    for threshold, cap in LENGTH_CAPS:
        if word_count < threshold:
            return cap
    return 6


def _level_scores(features: TextFeatures) -> dict[int, float]:
    """Skor bukti per level = jumlah kata kerja Bloom level itu + penanda berbobot (lihat README)."""
    verbs = features.bloom_verb_hits

    scores = {
        1: float(verbs.get(1, 0)),
        2: (
            verbs.get(2, 0)
            + features.explanatory_count * 0.8
            + features.ordinal_count * 0.3
        ),
        3: (
            verbs.get(3, 0)
            + features.procedural_count * 1.0
            + features.ordinal_count * 0.2
        ),
        4: (
            verbs.get(4, 0)
            + features.causal_count * 0.7
            + features.contrast_count * 0.7
        ),
        5: verbs.get(5, 0) + features.evaluative_count * 1.0,
        6: verbs.get(6, 0) + features.creative_count * 1.2,
    }

    # Menilai tanpa alasan bukan mengevaluasi; mengusulkan tanpa penalaran bukan mencipta.
    if features.causal_count == 0:
        scores[5] *= 0.4
    if features.causal_count == 0 and features.procedural_count == 0:
        scores[6] *= 0.4

    return scores


def _confidence(
    level: int, scores: dict[int, float], features: TextFeatures
) -> str:
    """Seberapa layak taksiran ini dipercaya."""
    if features.is_too_short:
        return Confidence.LOW
    strength = scores.get(level, 0.0)
    if strength >= 4.0 and features.word_count >= 120:
        return Confidence.HIGH
    if strength >= EVIDENCE_THRESHOLD and features.word_count >= 50:
        return Confidence.MEDIUM
    return Confidence.LOW


def _evidence_lines(
    level: int, scores: dict[int, float], features: TextFeatures
) -> list[str]:
    lines: list[str] = []
    if features.is_too_short:
        lines.append(
            f"Teks hanya {features.word_count} kata, terlalu pendek untuk "
            "menunjukkan level kognitif tinggi"
        )
        return lines

    cap = _length_cap(features.word_count)
    if features.causal_count:
        lines.append(
            f"Ada {features.causal_count} konektor sebab akibat, penanda penalaran"
        )
    if features.contrast_count:
        lines.append(
            f"Ada {features.contrast_count} konektor pembandingan atau pertentangan"
        )
    if features.evaluative_count:
        lines.append(
            f"Ada {features.evaluative_count} penanda sikap menilai"
        )
    if features.creative_count:
        lines.append(f"Ada {features.creative_count} penanda merancang atau mengusulkan")
    if features.procedural_count:
        lines.append(f"Ada {features.procedural_count} penanda langkah prosedural")
    elif features.ordinal_count >= 2:
        lines.append(
            f"Ada {features.ordinal_count} penanda urutan, tetapi hanya berupa "
            "daftar tanpa prosedur yang dijalankan"
        )
    if not lines:
        lines.append("Jawaban bersifat menyebutkan ulang tanpa penanda penalaran")
    if cap < 6 and level == cap:
        lines.append(
            f"Level dibatasi maksimal L{cap} karena panjang teks {features.word_count} kata"
        )
    return lines[:4]


def estimate_bloom_level(features: TextFeatures) -> BloomResult:
    """Level tertinggi yang skornya >= EVIDENCE_THRESHOLD, dibatasi panjang teks; default L1."""
    scores = _level_scores(features)
    cap = _length_cap(features.word_count)

    level = 1
    for candidate in range(6, 0, -1):
        if scores[candidate] >= EVIDENCE_THRESHOLD:
            level = candidate
            break

    level = min(level, cap)
    confidence = _confidence(level, scores, features)
    evidence = _evidence_lines(level, scores, features)

    if not features.is_too_short:
        if features.marker_density > STUFFING_DENSITY:
            level = min(level, STUFFED_LEVEL_CAP)
            confidence = Confidence.LOW
            evidence = ["Penanda penalaran terlalu rapat untuk panjang teks; tampak daftar kata kunci, bukan uraian"]
        elif features.indonesian_ratio < MIN_INDONESIAN_RATIO:
            confidence = Confidence.LOW
            evidence = ["Teks tampak bukan bahasa Indonesia; penanda E2 hanya mengenal bahasa Indonesia, level ini perkiraan kasar"]
    return BloomResult(
        level=level,
        confidence=confidence,
        evidence=evidence,
        level_scores=scores,
    )
