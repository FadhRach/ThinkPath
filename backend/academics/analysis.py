"""Orkestrator analisis jalur heuristik.

Alur: teks mentah dibaca sekali menjadi TextFeatures, lalu E1 (ai_score.py) dan
E2 (bloom.py) menghitung hasilnya masing masing dari fitur yang sama. Keduanya
tidak saling melihat hasil.

Peran expected_bloom_level di modul ini hanya satu: membandingkan level yang
DITAKSIR terhadap target dosen untuk menyusun kalimat rekomendasi. Ia tidak
pernah menjadi masukan bagi taksiran itu sendiri.

Sebelumnya modul ini menurunkan bloom_level dari ai_band lewat fungsi
band_to_bloom(). Fungsi itu sudah dihapus. Alasannya ada di docstring bloom.py.
"""
from __future__ import annotations

from .ai_score import score_ai_probability, score_to_band
from .bloom import BLOOM_LABELS, estimate_bloom_level
from .models import AiBand, AnalysisSource, Confidence
from .process_signals import ProcessContext
from .text_features import extract_features

__all__ = [
    "analyze_text",
    "score_to_band",
    "band_to_recommendation",
    "build_recommendation",
]


def band_to_recommendation(band: str) -> str:
    """Tindak lanjut berdasarkan band AI saja.

    Dipertahankan karena llm.py memakainya. Untuk rekomendasi yang juga
    memperhitungkan kesenjangan kognitif, pakai build_recommendation().
    """
    if band == AiBand.LOW:
        return "Tidak ada indikasi yang perlu ditindaklanjuti. Lanjutkan penilaian seperti biasa."
    if band == AiBand.MID:
        return "Beberapa sinyal bercampur. Disarankan tanya jawab singkat 5-10 menit untuk verifikasi."
    return "Disarankan diskusi 10-15 menit dengan mahasiswa untuk memverifikasi pemahaman."


def build_recommendation(band: str, bloom_level: int, expected_bloom_level: int) -> str:
    """Rekomendasi yang menggabungkan dua dimensi yang kini terpisah.

    Karena bloom_level tidak lagi diturunkan dari band, kombinasi keduanya
    membawa informasi nyata. Jawaban dengan indikasi AI rendah tetapi level
    kognitif di bawah target adalah kasus yang paling berguna bagi dosen, dan
    dulu mustahil muncul.
    """
    gap = bloom_level - expected_bloom_level
    integrity = band_to_recommendation(band)

    if gap <= -2:
        cognitive = (
            f"Level kognitif jawaban ada di L{bloom_level} ({BLOOM_LABELS[bloom_level]}), "
            f"dua tingkat di bawah target L{expected_bloom_level}. "
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


def _overall_confidence(word_count: int) -> str:
    """Jalur heuristik tidak pernah mencapai keyakinan tinggi.

    Sinyalnya terlalu dangkal. Menaikkannya ke high akan menyesatkan dosen.
    """
    return Confidence.LOW if word_count < 80 else Confidence.MEDIUM


def analyze_text(
    text: str,
    expected_bloom_level: int,
    process: ProcessContext | None = None,
) -> dict:
    """Hasil analisis heuristik untuk satu jawaban mahasiswa.

    Bentuk dict yang dikembalikan sama persis dengan jalur LLM sehingga
    langsung bisa dipakai sebagai kwargs AnalysisResult.

    process bersifat opsional supaya modul ini tetap bisa diuji tanpa database.
    Bila tersedia, sinyal forensik proses ikut masuk ke skor E1. Ia tidak pernah
    menyentuh taksiran Bloom, karena kecepatan mengetik tidak mengubah level
    kognitif yang ditunjukkan sebuah jawaban.
    """
    features = extract_features(text)
    ai = score_ai_probability(features, process)
    bloom = estimate_bloom_level(features)

    signals = ai.evidence_lines[:2] + bloom.evidence[:2]

    return {
        "ai_score": ai.score,
        "ai_band": ai.band,
        "bloom_level": bloom.level,
        "confidence": _overall_confidence(features.word_count),
        "bloom_confidence": bloom.confidence,
        "signals": signals[:4],
        "summary": build_summary(ai.band, bloom.level, bloom.confidence),
        "recommendation": build_recommendation(
            ai.band, bloom.level, expected_bloom_level
        ),
        "signal_breakdown": ai.breakdown_as_dicts(),
        "analysis_source": AnalysisSource.HEURISTIC,
    }
