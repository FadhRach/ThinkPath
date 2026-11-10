"""Pemindai perintah untuk penilai otomatis ("abaikan instruksi..."): bila ketemu, Groq tidak dipakai.

Lapis kedua di samping delimiter di providers/groq.py; sengaja sempit agar esai wajar tidak terjaring.
"""
from __future__ import annotations

import re

_PATTERNS: tuple[tuple[str, re.Pattern[str]], ...] = tuple(
    (label, re.compile(pattern, re.IGNORECASE))
    for label, pattern in (
        ("perintah mengabaikan instruksi", r"\b(abaikan|lupakan|kesampingkan)\s+(semua\s+|seluruh\s+)?(instruksi|perintah|aturan|petunjuk)"),
        ("perintah mengabaikan instruksi", r"\b(ignore|disregard|forget)\s+(all\s+|any\s+|the\s+)?(previous|prior|above|earlier|your)\s+(instructions?|prompts?|rules?)"),
        ("menyebut kunci keluaran penilai", r"\b(ai_probability|bloom_level|bloom_confidence)\b"),
        ("perintah mengatur skor", r"\b(ubah|atur|set|tetapkan|beri(kan)?)\s+(skor|nilai|level)\s+(ai|bloom)\b"),
        ("pengalihan peran penilai", r"\bkamu\s+(sekarang\s+)?adalah\s+(sistem|penilai|asisten|model)\b"),
        ("pengalihan peran penilai", r"\byou\s+are\s+(now\s+)?(a|an|the)\s+(grader|evaluator|assistant|system)\b"),
        ("menyebut prompt sistem", r"\b(system\s*prompt|prompt\s+sistem)\b"),
        ("penanda pesan model", r"<\|(im_start|im_end|system|assistant)\|>|\[\[/?[A-Z_]{3,}\]\]"),
    )
)


def injection_markers(text: str) -> list[str]:
    """Label (tanpa duplikat, urut kemunculan) pola instruksi di dalam teks jawaban."""
    found: list[str] = []
    for label, pattern in _PATTERNS:
        if pattern.search(text) and label not in found:
            found.append(label)
    return found
