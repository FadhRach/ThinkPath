"""Kemiripan antar jawaban dalam satu tugas, lewat irisan potongan lima kata berurutan.

Potongan lima kata yang sama persis antara dua tulisan mandiri sangat jarang; lazimnya itu
tanda salin-tempel dari satu sumber atau dari satu sama lain. Hasilnya petunjuk untuk
dibandingkan, bukan vonis: dua mahasiswa yang menyalin dari buku yang sama juga akan mirip, dan
kalimat yang dikutip dari soal tugas ikut dihitung.
"""
from __future__ import annotations

import re

SHINGLE_SIZE = 5
MIN_WORDS = 20
_WORD = re.compile(r"[^\W_]+", re.UNICODE)


def shingles(text: str) -> frozenset[int]:
    words = [word.lower() for word in _WORD.findall(text)]
    if len(words) < SHINGLE_SIZE:
        return frozenset()
    return frozenset(
        hash(tuple(words[i : i + SHINGLE_SIZE])) for i in range(len(words) - SHINGLE_SIZE + 1)
    )


def similarity(a: frozenset[int], b: frozenset[int]) -> float:
    """Jaccard 0..1 antara dua himpunan potongan."""
    if not a or not b:
        return 0.0
    return len(a & b) / len(a | b)


def most_similar(
    text: str,
    others: list[tuple[str, str, str]],
    *,
    threshold: float = 0.1,
    top: int = 5,
) -> list[dict]:
    """`others` = [(submission_id, nama, teks)]. Hanya yang melewati ambang, tertinggi dulu."""
    mine = shingles(text)
    if len(text.split()) < MIN_WORDS or not mine:
        return []
    scored = []
    for submission_id, name, other_text in others:
        score = similarity(mine, shingles(other_text))
        if score >= threshold:
            scored.append({"submission_id": submission_id, "student_name": name, "score": round(score, 3)})
    return sorted(scored, key=lambda row: -row["score"])[:top]


def shared_spans(text: str, other: str) -> list[dict]:
    """Rentang karakter pada `text` yang termasuk potongan lima kata yang sama dengan `other`.

    Rentang yang bersambung digabung, jadi dosen melihat kalimat yang sama sebagai satu sorotan.
    """
    found = [(m.start(), m.end(), m.group().lower()) for m in _WORD.finditer(text)]
    theirs = shingles(other)
    if len(found) < SHINGLE_SIZE or not theirs:
        return []
    spans: list[list[int]] = []
    for i in range(len(found) - SHINGLE_SIZE + 1):
        window = found[i : i + SHINGLE_SIZE]
        if hash(tuple(word for _, _, word in window)) not in theirs:
            continue
        start, end = window[0][0], window[-1][1]
        if spans and start <= spans[-1][1]:
            spans[-1][1] = max(spans[-1][1], end)
        else:
            spans.append([start, end])
    return [{"start": start, "end": end} for start, end in spans]
