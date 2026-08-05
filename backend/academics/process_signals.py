"""E1 sinyal 4: forensik proses pengerjaan.

Ini sinyal terkuat yang dimiliki ThinkPath, dan satu satunya dari empat sinyal
blueprint yang datanya sudah tersedia penuh tanpa model, dataset, atau GPU.
Alasannya: sinyal ini tidak membaca teks sama sekali. Parafrase, humanizer, dan
penulisan ulang tidak mengubah fakta bahwa 412 kata muncul dalam 4 menit tanpa
satu pun revisi.

Yang TIDAK diskor di sini, dan itu disengaja:

Jam pengumpulan. Mengumpulkan pukul 02.37 memang layak dilaporkan ke guru, tetapi
sebagai pembeda ia buruk. Siswa rajin yang begadang dan siswa yang menyalin akan
terlihat sama. Menghukum jam pengerjaan juga menghukum siswa yang hanya punya
waktu malam hari. Jam tetap ditampilkan di layar guru, tetapi tidak menambah
skor.

Jam dinding juga tidak dirakit di modul ini. Backend berjalan pada TIME_ZONE UTC
sedangkan frontend merender waktu ke zona lokal pembaca, sehingga jam yang
ditanam di string dari sini akan berbeda dengan jam di layar. Modul ini hanya
menghasilkan besaran yang bebas zona waktu: durasi, laju, revisi, dan tempelan.
"""
from __future__ import annotations

from dataclasses import dataclass

# Laju mengarang berkelanjutan untuk siswa. Di bawah batas bawah dianggap wajar,
# di atas batas atas praktis mustahil untuk teks yang disusun sendiri.
PLAUSIBLE_WPM = 25.0
IMPLAUSIBLE_WPM = 80.0

# Di bawah panjang ini, jumlah revisi tidak informatif. Jawaban dua kalimat
# memang wajar ditulis sekali jadi.
REVISION_MIN_WORDS = 100

# Bobot antar sub-indikator di dalam sinyal proses.
SUB_WEIGHTS = {"pace": 0.45, "revision": 0.30, "paste": 0.25}


@dataclass(frozen=True)
class ProcessContext:
    """Metadata pengerjaan satu submission. Tidak memuat teks jawaban."""

    duration_seconds: int | None
    revision_count: int
    word_count: int
    char_count: int
    paste_char_count: int = 0

    @property
    def words_per_minute(self) -> float | None:
        if not self.duration_seconds or self.duration_seconds <= 0:
            return None
        return round(self.word_count / (self.duration_seconds / 60.0), 1)


def _clamp01(value: float) -> float:
    return max(0.0, min(1.0, value))


def _pace_value(context: ProcessContext) -> tuple[float, str]:
    wpm = context.words_per_minute
    if wpm is None:
        return 0.5, "Durasi pengerjaan tidak terekam"
    if wpm <= PLAUSIBLE_WPM:
        value = 0.0
    else:
        span = IMPLAUSIBLE_WPM - PLAUSIBLE_WPM
        value = _clamp01((wpm - PLAUSIBLE_WPM) / span)
    minutes = max(1, round((context.duration_seconds or 0) / 60))
    return value, f"{context.word_count} kata dalam {minutes} menit ({wpm:.0f} kata/menit)"


def _revision_value(context: ProcessContext) -> tuple[float, str]:
    if context.word_count < REVISION_MIN_WORDS:
        return 0.5, "Teks terlalu pendek untuk menilai pola revisi"
    if context.revision_count == 0:
        return 1.0, "Tidak ada revisi sama sekali pada teks sepanjang ini"
    if context.revision_count == 1:
        return 0.5, "Hanya 1 revisi"
    return 0.0, f"{context.revision_count} revisi, pola penyuntingan wajar"


def _paste_value(context: ProcessContext) -> tuple[float, str]:
    if context.paste_char_count <= 0:
        return 0.0, "Tidak ada tempelan besar"
    if context.char_count <= 0:
        return 0.5, "Ada tempelan, panjang teks akhir tidak diketahui"
    ratio = context.paste_char_count / context.char_count
    return (
        _clamp01(ratio / 0.5),
        f"{context.paste_char_count} karakter ditempel "
        f"({ratio * 100:.0f}% dari teks akhir)",
    )


def evaluate_process(context: ProcessContext) -> tuple[float, str]:
    """Nilai 0 sampai 1 untuk sinyal proses, beserta ringkasan buktinya."""
    pace, pace_text = _pace_value(context)
    revision, revision_text = _revision_value(context)
    paste, paste_text = _paste_value(context)

    value = (
        pace * SUB_WEIGHTS["pace"]
        + revision * SUB_WEIGHTS["revision"]
        + paste * SUB_WEIGHTS["paste"]
    )
    return _clamp01(value), f"{pace_text}, {revision_text.lower()}, {paste_text.lower()}"
