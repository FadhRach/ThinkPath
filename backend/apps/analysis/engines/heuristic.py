"""Jalur heuristik: teks -> TextFeatures sekali, lalu E1 (ai_score) dan E2 (bloom) terpisah.

expected_bloom_level hanya dipakai untuk kalimat rekomendasi, tidak pernah untuk menaksir level.
"""
from __future__ import annotations

from apps.analysis.engines.ai_score import score_ai_probability
from apps.analysis.engines.bloom import BLOOM_LABELS, estimate_bloom_level
from apps.analysis.choices import AiBand, AnalysisSource, Confidence
from apps.analysis.engines.process_signals import ProcessContext
from apps.analysis.engines.text_features import extract_features

def band_to_recommendation(band: str) -> str:
    """Tindak lanjut berdasarkan band AI saja."""
    if band == AiBand.LOW:
        return "Tidak ada indikasi yang perlu ditindaklanjuti. Lanjutkan penilaian seperti biasa."
    if band == AiBand.MID:
        return "Beberapa sinyal bercampur. Disarankan tanya jawab singkat 5-10 menit untuk verifikasi."
    return "Disarankan diskusi 10-15 menit dengan mahasiswa untuk memverifikasi pemahaman."


_GAP_WORDS = {2: "dua", 3: "tiga", 4: "empat", 5: "lima"}


def build_recommendation(band: str, bloom_level: int, expected_bloom_level: int) -> str:
    """Rekomendasi = tindak lanjut band AI + selisih level Bloom terhadap target dosen."""
    gap = bloom_level - expected_bloom_level
    integrity = band_to_recommendation(band)

    if gap <= -2:
        cognitive = (
            f"Level kognitif jawaban ada di L{bloom_level} ({BLOOM_LABELS[bloom_level]}), "
            f"{_GAP_WORDS.get(-gap, -gap)} tingkat di bawah target L{expected_bloom_level}. "
            "Pertimbangkan pengulangan konsep sebelum lanjut ke materi berikutnya."
        )
    elif gap == -1:
        cognitive = (
            f"Level kognitif jawaban ada di L{bloom_level}, satu tingkat di bawah "
            f"target L{expected_bloom_level}. Umpan balik terarah kemungkinan cukup."
        )
    elif gap == 0:
        cognitive = f"Level kognitif jawaban sudah sesuai target L{expected_bloom_level}."
    else:
        cognitive = (
            f"Level kognitif jawaban ada di L{bloom_level}, di atas target "
            f"L{expected_bloom_level}. Mahasiswa ini bisa diberi tantangan lebih tinggi."
        )

    return f"{integrity} {cognitive}"


def build_summary(band: str, bloom_level: int, bloom_confidence: str) -> str:
    if band == AiBand.LOW:
        integrity = (
            "Tulisan menunjukkan pola yang wajar untuk mahasiswa. "
            "Tidak ditemukan indikasi kuat penggunaan AI generatif."
        )
    elif band == AiBand.MID:
        integrity = (
            "Ada sinyal yang bercampur antara tulisan mahasiswa dan pola khas AI. "
            "Perlu ditinjau bersama konteks proses pengerjaan."
        )
    else:
        integrity = (
            "Tulisan memuat beberapa pola kuat yang khas AI generatif. "
            "Disarankan verifikasi langsung dengan mahasiswa."
        )

    cognitive = (
        f"Secara kognitif jawaban ini menunjukkan L{bloom_level} "
        f"({BLOOM_LABELS[bloom_level]})"
    )
    if bloom_confidence == Confidence.LOW:
        cognitive += ", meski buktinya masih tipis"
    return f"{integrity} {cognitive}."


def overall_confidence(word_count: int) -> str:
    """low bila < 80 kata, selainnya medium; heuristik dan detektor tidak pernah "high"."""
    return Confidence.LOW if word_count < 80 else Confidence.MEDIUM


def analyze_text(
    text: str,
    expected_bloom_level: int,
    process: ProcessContext | None = None,
) -> dict:
    """Dict siap pakai sebagai kwargs AnalysisResult; Groq hanya menimpa field Bloom-nya."""
    features = extract_features(text)
    ai = score_ai_probability(features, process)
    bloom = estimate_bloom_level(features)

    signals = ai.evidence_lines[:2] + bloom.evidence[:2]

    return {
        "ai_score": ai.score,
        "ai_band": ai.band,
        "bloom_level": bloom.level,
        "confidence": overall_confidence(features.word_count),
        "bloom_confidence": bloom.confidence,
        "signals": signals[:4],
        "summary": build_summary(ai.band, bloom.level, bloom.confidence),
        "recommendation": build_recommendation(
            ai.band, bloom.level, expected_bloom_level
        ),
        "signal_breakdown": ai.breakdown_as_dicts(),
        "analysis_source": AnalysisSource.HEURISTIC,
    }
