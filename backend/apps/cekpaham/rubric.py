"""Rubrik penilaian jawaban lisan: dimensi, bobot, jangkar level, dan skor.

Penilai (LLM) hanya memberi LEVEL per dimensi; skor total dihitung di sini.
Diminta angka langsung, LLM cenderung menumpuk skor di dekat puncak skala.

STATUS: BELUM DIKALIBRASI. Ambang band di bawah adalah placeholder sampai
ai_experiment/src/evaluate_cekpaham_judge.py membuktikannya. Jangan mengubah
ambang agar hasil terlihat bagus; perbaiki rubrik atau prompt-nya.
"""
from __future__ import annotations

RUBRIC_VERSION = "v2"
PROMPT_VERSION = "v2"
MAX_LEVEL = 3

WEIGHTS = {"accuracy": 0.35, "consistency": 0.25, "depth": 0.25, "ownership": 0.15}
DIMENSIONS = tuple(WEIGHTS)

BAND_STRONG_MIN = 70
BAND_PARTIAL_MIN = 40

TITLES = {
    "accuracy": "Ketepatan konsep",
    "consistency": "Konsistensi dengan jawaban tertulis",
    "depth": "Kedalaman penjelasan",
    "ownership": "Keakraban dengan isi jawaban",
}

ANCHORS = {
    "accuracy": (
        "Isi jawaban lisan salah, tidak menjawab soal, atau tidak ada isi yang bisa dinilai.",
        "Sebagian benar, tetapi ada kesalahan konsep penting atau jawaban jauh dari inti soal.",
        "Pada dasarnya benar dan menjawab soal; ada kekurangan kecil atau bagian yang kabur.",
        "Benar, tepat sasaran, dan istilahnya dipakai dengan wajar.",
    ),
    "consistency": (
        "Bertentangan dengan jawaban tertulis, atau tidak berkaitan sama sekali dengannya.",
        "Hanya sebagian selaras; keputusan atau konsep utama dalam jawaban tertulis tidak muncul.",
        "Selaras dengan jawaban tertulis pada konsep dan keputusan pokoknya.",
        "Selaras, dan mampu menjelaskan bagian tertentu dari jawaban tertulis dengan rinci.",
    ),
    "depth": (
        "Hanya menyebut istilah atau mengulang soal tanpa menjelaskan apa pun.",
        "Penjelasan sangat singkat, atau hanya menjawab sebagian dari yang diminta soal.",
        "Menjelaskan isi pokok yang diminta soal secara runtut; kedalamannya wajar untuk waktu dan jenis soalnya.",
        "Menjelaskan isi pokok beserta alasan atau cara kerjanya, atau mengaitkannya dengan konsekuensi atau pembandingan.",
    ),
    "ownership": (
        "Tidak terdengar mengenal isi jawabannya: tidak nyambung dengan tulisannya, atau hanya membaca teks.",
        "Hanya mengenal sebagian isinya; sebagian besar kalimat terlalu umum untuk dikaitkan dengan jawabannya.",
        "Terdengar mengenal isi jawabannya sendiri: menjelaskan ulang pokok-pokoknya dengan kata sendiri, tanpa perlu cerita pribadi.",
        "Sangat akrab: menambah rincian, contoh, atau alasan pilihan yang menunjukkan ia paham proses di balik jawabannya.",
    ),
}


def score_from_levels(levels: dict[str, int]) -> int:
    """Skor 0-100 dari level per dimensi."""
    return round(sum(levels[d] / MAX_LEVEL * w for d, w in WEIGHTS.items()) * 100)


def band_from_score(score: int) -> str:
    if score >= BAND_STRONG_MIN:
        return "kuat"
    return "sebagian" if score >= BAND_PARTIAL_MIN else "lemah"
