"""E2: taksiran level kognitif Bloom dari teks jawaban siswa.

Dua aturan yang tidak boleh dilanggar modul ini:

1. Tidak membaca ai_score. Level kognitif dan dugaan penggunaan AI adalah dua
   hal yang berbeda. Siswa bisa menulis analisis tajam dengan bantuan AI, dan
   bisa juga menulis jawaban lemah sepenuhnya sendiri.

2. Tidak membaca expected_bloom_level. Target guru adalah harapan, bukan hasil
   pengukuran. Kalau target dipakai sebagai dasar taksiran, sistem hanya
   memantulkan kembali asumsi guru dan tidak akan pernah bisa memberi tahu
   bahwa targetnya terlalu tinggi atau terlalu rendah untuk kelas itu.

Perbandingan terhadap target tetap dilakukan, tetapi di analysis.py, setelah
level ditaksir secara mandiri.

Metode: bukti berjenjang. Tiap level punya penanda sendiri, dan level tinggi
menuntut struktur pendukung. Menilai tanpa alasan bukan mengevaluasi, jadi L5
mensyaratkan adanya konektor sebab akibat. Panjang teks membatasi level maksimum
karena level kognitif tinggi tidak mungkin ditunjukkan dalam beberapa kalimat.

Sama seperti E1, ini baseline yang dapat dijelaskan, bukan model tervalidasi.
Angka akurasi hanya boleh diklaim setelah diuji terhadap gold set berlabel guru.
"""
from __future__ import annotations

from dataclasses import dataclass

from .models import Confidence
from .text_features import TextFeatures

BLOOM_LABELS = {
    1: "Mengingat",
    2: "Memahami",
    3: "Menerapkan",
    4: "Menganalisis",
    5: "Mengevaluasi",
    6: "Mencipta",
}

# Batas level maksimum menurut panjang teks. Jawaban 30 kata tidak bisa
# menunjukkan evaluasi bertingkat, sepanjang apa pun kata kerjanya.
LENGTH_CAPS = (
    (25, 1),
    (50, 2),
    (80, 3),
    (120, 4),
)

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
    """Bukti yang terkumpul untuk tiap level. Nilai lebih tinggi berarti lebih kuat."""
    verbs = features.bloom_verb_hits

    scores = {
        1: float(verbs.get(1, 0)),
        # Mengurutkan isi catatan adalah bentuk mendeskripsikan, bukan menerapkan.
        2: (
            verbs.get(2, 0)
            + features.explanatory_count * 0.8
            + features.ordinal_count * 0.3
        ),
        # Penanda urutan hanya menambah bukti penerapan kalau ada prosedur nyata
        # yang dijalankan. Sendirian, bobotnya sengaja kecil.
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

    # Level tinggi menuntut struktur pendukung, bukan sekadar kata kunci.
    # Menilai tanpa memberi alasan bukan mengevaluasi.
    if features.causal_count == 0:
        scores[5] *= 0.4
    # Mengusulkan sesuatu tanpa penalaran apa pun bukan mencipta.
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
    """Taksir level Bloom dari fitur teks saja.

    Mengambil level tertinggi yang buktinya melewati ambang, lalu membatasinya
    dengan panjang teks. Kalau tidak ada level yang melewati ambang, jatuh ke L1.
    """
    scores = _level_scores(features)
    cap = _length_cap(features.word_count)

    level = 1
    for candidate in range(6, 0, -1):
        if scores[candidate] >= EVIDENCE_THRESHOLD:
            level = candidate
            break

    level = min(level, cap)
    return BloomResult(
        level=level,
        confidence=_confidence(level, scores, features),
        evidence=_evidence_lines(level, scores, features),
        level_scores=scores,
    )
