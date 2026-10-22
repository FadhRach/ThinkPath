"""Metrik transkripsi: WER, CER, recall istilah kunci, dan interval kepercayaan.

Ditulis sendiri (edit distance sekitar 15 baris) supaya tidak menambah dependensi
`jiwer` hanya untuk dua rumus. Tesnya memeriksa kasus yang jawabannya diketahui.

**Normalisasi** sengaja sederhana: huruf kecil dan buang tanda baca. Angka TIDAK
diubah menjadi kata, jadi transkrip referensi harus menuliskan angka dengan cara
yang sama dengan yang dihasilkan ASR (aturan di protocol/cekpaham_clip_recording.md:
angka ditulis sebagai digit). Mengabaikan ini membuat "5" lawan "lima" dihitung
sebagai galat dan menghukum model yang sebenarnya benar.
"""
from __future__ import annotations

import random
import re

PUNCTUATION = re.compile(r"[^\w\s]", re.UNICODE)


def words(text: str) -> list[str]:
    return PUNCTUATION.sub(" ", text.lower()).split()


def edit_distance(ref: list[str], hyp: list[str]) -> int:
    """Levenshtein pada urutan token (sisip, hapus, ganti masing-masing satu)."""
    previous = list(range(len(hyp) + 1))
    for i, r in enumerate(ref, start=1):
        current = [i]
        for j, h in enumerate(hyp, start=1):
            current.append(min(previous[j] + 1, current[j - 1] + 1, previous[j - 1] + (r != h)))
        previous = current
    return previous[-1]


def word_errors(reference: str, hypothesis: str) -> tuple[int, int]:
    """(jumlah galat kata, jumlah kata referensi)."""
    ref = words(reference)
    return edit_distance(ref, words(hypothesis)), len(ref)


def char_errors(reference: str, hypothesis: str) -> tuple[int, int]:
    ref = " ".join(words(reference))
    return edit_distance(list(ref), list(" ".join(words(hypothesis)))), len(ref)


def corpus_rate(pairs: list[tuple[int, int]]) -> float:
    """Total galat dibagi total kata referensi: lebih adil daripada merata-ratakan WER per klip."""
    total = sum(length for _, length in pairs)
    return sum(errors for errors, _ in pairs) / total if total else float("nan")


def term_recall(terms: list[str], hypothesis: str) -> float | None:
    """Bagian istilah kunci yang muncul utuh di hasil; None bila klip tak punya istilah."""
    if not terms:
        return None
    spoken = " ".join(words(hypothesis))
    found = sum(1 for term in terms if " ".join(words(term)) in spoken)
    return found / len(terms)


def bootstrap_ci(
    pairs: list[tuple[int, int]], *, resamples: int = 1000, seed: int = 0
) -> tuple[float, float] | None:
    """Interval 95% untuk WER korpus dengan resampling klip. None bila klipnya terlalu sedikit."""
    if len(pairs) < 5:
        return None
    rng = random.Random(seed)
    rates = sorted(
        corpus_rate([rng.choice(pairs) for _ in pairs]) for _ in range(resamples)
    )
    return rates[int(0.025 * resamples)], rates[int(0.975 * resamples) - 1]
