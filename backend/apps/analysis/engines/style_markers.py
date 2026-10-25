"""Penanda gaya teks yang sering tertinggal saat jawaban ditempel dari obrolan AI.

Modul ini murni deskriptif dan TIDAK ikut menghitung skor AI. Ia hanya menunjuk bagian teks
yang layak dilihat dosen, dengan dua tingkat:

* strong: sisa salinan dari antarmuka obrolan yang jarang muncul di tulisan manusia: sintaks
  markdown (**tebal**, ## judul), simbol poin "•", kalimat penutup yang ditujukan kepada
  pengguna ("beri tahu saya", "semoga membantu"), emoji, dan karakter tak terlihat.
* weak: kebiasaan gaya yang juga dipakai penulis manusia (tanda pisah panjang, label
  berhuruf besar diikuti titik dua di tengah paragraf). Hanya dihitung, tidak pernah dijadikan
  alasan sendirian.

Yang TIDAK bisa dilakukan: membaca tanda air statistik (watermark) milik penyedia model.
Itu hanya bisa diverifikasi dengan kunci milik penyedia. Yang terlihat dari luar hanyalah
jejak salinan di atas.

Komentar penutup soal akurasi: daftar frasa ini sengaja sempit. Frasa umum seperti "berikut ini"
atau "dengan demikian" lazim di tulisan akademik dan tidak dihitung (lihat catatan di
text_features.py tentang mengapa menghukum bahasa akademik yang baik adalah kesalahan).
"""
from __future__ import annotations

import re
from dataclasses import dataclass

MAX_SPANS_PER_MARKER = 12
MAX_SPANS_TOTAL = 80

_EMOJI = re.compile(
    "[\U0001F300-\U0001FAFF\U00002600-\U000027BF\U0001F000-\U0001F2FF⭐⬆✅❌✨]"
)
# Karakter yang tidak tampak di layar: spasi lebar nol, penanda arah, pembungkus kata, tanda
# urutan byte, tanda hubung lunak.
_INVISIBLE = re.compile("[​-‏‪-‮⁠-⁤﻿­]")
_ODD_SPACE = re.compile("[    ]")

_PATTERNS: tuple[tuple[str, str, str, str, re.Pattern[str]], ...] = (
    (
        "markdown",
        "strong",
        "Sintaks markdown",
        "**tebal**, judul ## atau tanda ` dari antarmuka obrolan yang ikut tersalin.",
        re.compile(r"\*\*[^*\n]{1,120}\*\*|^\s{0,3}#{1,6}\s+\S|`[^`\n]{1,80}`", re.MULTILINE),
    ),
    (
        "bullet_symbol",
        "strong",
        "Simbol poin khas obrolan",
        "Poin berbentuk • ‣ ▪ ➤ yang jarang diketik langsung di editor dokumen.",
        re.compile(r"[•‣▪◦➤➢✔✓➜]"),
    ),
    (
        "closing_offer",
        "strong",
        "Kalimat yang ditujukan kepada pengguna AI",
        "Kalimat penutup atau pembuka seperti “beri tahu saya”, “semoga membantu”, “jika Anda ingin”.",
        re.compile(
            r"\b(beri\s+tahu\s+saya|semoga\s+(?:ini\s+)?membantu|jika\s+(?:anda|kamu)\s+ingin|"
            r"apakah\s+(?:anda|kamu)\s+(?:ingin|mau)|saya\s+(?:dapat|bisa)\s+membantu|"
            r"silakan\s+(?:beri\s+tahu|tanyakan)|sebagai\s+(?:model\s+bahasa|ai)\b|"
            r"tentu[,!]\s+(?:berikut|ini))",
            re.IGNORECASE,
        ),
    ),
    (
        "emoji",
        "strong",
        "Emoji",
        "Emoji jarang muncul di tugas akademik tertulis.",
        _EMOJI,
    ),
    (
        "invisible",
        "strong",
        "Karakter tak terlihat",
        "Spasi lebar nol, penanda arah, atau tanda hubung lunak yang tidak tampak di layar; "
        "sering tertinggal pada teks salinan.",
        _INVISIBLE,
    ),
    (
        "odd_space",
        "weak",
        "Spasi tak biasa",
        "Spasi tanpa putus atau spasi sempit yang diketik tidak sengaja saat menyalin.",
        _ODD_SPACE,
    ),
    (
        "dash",
        "weak",
        "Tanda pisah panjang",
        "Tanda — atau – di tengah kalimat. Dipakai penulis manusia juga; yang janggal bila sering.",
        re.compile(r"\s[—–]\s|[—]"),
    ),
    (
        "colon_label",
        "weak",
        "Label berhuruf besar + titik dua",
        "Pola “Judul Istilah: penjelasan” berulang di tengah paragraf, gaya khas ringkasan AI.",
        re.compile(r"(?:^|\n|\. |[•‣▪◦]\s*)([A-Z][\w()/-]*(?:\s+[A-Za-z(][\w()/-]*){0,5}):\s+[A-Z]"),
    ),
)

STRONG_LABELS = {key: label for key, tier, label, _, _ in _PATTERNS if tier == "strong"}


@dataclass(frozen=True)
class Marker:
    key: str
    tier: str
    label: str
    hint: str
    count: int
    # Potongan pendek (maks. 3) untuk ditampilkan sebagai contoh.
    examples: tuple[str, ...]


def _snippet(text: str, start: int, end: int) -> str:
    left = max(0, start - 24)
    right = min(len(text), end + 24)
    visible = text[left:right].replace("\n", " ")
    # Karakter tak terlihat diberi nama supaya contohnya tampak.
    visible = _INVISIBLE.sub("␣", visible)
    return f"{'…' if left else ''}{visible}{'…' if right < len(text) else ''}"


def find_style_markers(text: str) -> dict:
    """{"markers": [Marker-as-dict], "spans": [{start,end,key,tier}], "strong_total": int}.

    `spans` memakai indeks karakter pada `text` yang sama persis, agar tampilan bisa
    menyorot bagian yang dimaksud.
    """
    markers: list[dict] = []
    spans: list[dict] = []
    strong_total = 0
    for key, tier, label, hint, pattern in _PATTERNS:
        matches = list(pattern.finditer(text))
        if key == "colon_label" and len(matches) < 3:
            matches = []  # satu-dua label wajar; barulah berulang yang bermakna
        if key == "dash" and len(matches) < 2:
            matches = []
        if not matches:
            continue
        examples = tuple(_snippet(text, m.start(), m.end()) for m in matches[:3])
        markers.append(
            {
                "key": key,
                "tier": tier,
                "label": label,
                "hint": hint,
                "count": len(matches),
                "examples": list(examples),
            }
        )
        if tier == "strong":
            strong_total += len(matches)
        for match in matches[:MAX_SPANS_PER_MARKER]:
            if len(spans) < MAX_SPANS_TOTAL:
                spans.append({"start": match.start(), "end": match.end(), "key": key, "tier": tier})
    spans.sort(key=lambda span: span["start"])
    markers.sort(key=lambda marker: (marker["tier"] != "strong", -marker["count"]))
    return {"markers": markers, "spans": spans, "strong_total": strong_total}
