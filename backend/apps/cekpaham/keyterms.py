"""Istilah kunci dari soal dan jawaban, untuk memandu Whisper dan penilai."""
from __future__ import annotations

import re
from collections import Counter

MAX_KEYTERMS = 30
MIN_WORD_LENGTH = 5
# Kata umum Indonesia/Inggris yang tidak membantu mengenali istilah.
STOPWORDS = frozenset(
    """
    adalah akan antara apabila atau bahwa banyak beberapa belum berbagai bisa
    dalam dapat dengan dimana dilakukan harus hanya jadi juga karena kemudian
    kepada ketika lebih masih mereka namun oleh pada para saja saya sebagai
    sebuah secara sehingga sedangkan setiap sudah supaya tetapi untuk yang
    jelaskan sebutkan mengapa bagaimana memakai menggunakan
    about because between could their there these which would should
    """.split()
)
WORD = re.compile(r"[A-Za-z][A-Za-z0-9_+#]*")


def _is_technical(word: str) -> bool:
    # CamelCase, SEMUA_KAPITAL, atau memuat angka/garis bawah: hampir pasti istilah.
    return bool(re.search(r"[a-z][A-Z]|\d|_", word)) or (word.isupper() and len(word) >= 2)


def extract_keyterms(*texts: str, limit: int = MAX_KEYTERMS) -> list[str]:
    counts: Counter[str] = Counter()
    display: dict[str, str] = {}
    for text in texts:
        for word in WORD.findall(text or ""):
            key = word.lower()
            if key in STOPWORDS or not (len(word) >= MIN_WORD_LENGTH or _is_technical(word)):
                continue
            counts[key] += 1
            display.setdefault(key, word)
    technical = [k for k in counts if _is_technical(display[k])]
    ranked = sorted(counts, key=lambda k: (-counts[k], -len(k), k))
    ordered = technical + [k for k in ranked if k not in technical]
    return [display[k] for k in ordered[:limit]]
