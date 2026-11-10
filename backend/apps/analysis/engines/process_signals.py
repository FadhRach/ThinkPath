"""Forensik proses pengerjaan: nilai 0-1 dari kurva pertumbuhan kata (atau laju mengetik).

Berbobot 0 di skor AI (PROCESS_WEIGHT); dilaporkan terpisah sebagai process_band lewat assess_process.
Jam pengumpulan, jumlah revisi, dan tindakan menempel sengaja tidak diskor (hanya ditampilkan).
"""
from __future__ import annotations

from dataclasses import dataclass

# Laju mengarang (kata/menit): <= 25 wajar, >= 80 praktis mustahil untuk teks yang disusun sendiri.
PLAUSIBLE_WPM = 25.0
IMPLAUSIBLE_WPM = 80.0

# Lonjakan = >= 60 kata antar dua cuplikan dengan laju >= 80 kata/menit (cuplikan server >= 30 detik).
BURST_WORDS = 60
BURST_WPM = IMPLAUSIBLE_WPM

# Porsi jawaban dari lonjakan: < 0,35 normal, 0,35-0,6 sebagian, >= 0,6 perlu perhatian.
NORMAL_SHARE = 0.35
ATTENTION_SHARE = 0.6

# Kurang dari ini, jejak terlalu pendek untuk dibaca sebagai pola.
MIN_SAMPLES = 4


@dataclass(frozen=True)
class ProgressSample:
    """Jumlah kata pada satu titik waktu selama pengerjaan."""

    offset_seconds: int
    word_count: int


@dataclass(frozen=True)
class ProcessContext:
    """Metadata pengerjaan satu submission. Tidak memuat teks jawaban."""

    duration_seconds: int | None
    revision_count: int
    word_count: int
    char_count: int
    # Kosong berarti tidak terekam, bukan berarti mencurigakan.
    progress: tuple[ProgressSample, ...] = ()
    # Kata baru yang masuk lewat revisi (mengganti isi saat revisi tidak boleh lolos).
    inserted_words: int = 0

    @property
    def words_per_minute(self) -> float | None:
        if not self.duration_seconds or self.duration_seconds <= 0:
            return None
        return round(self.word_count / (self.duration_seconds / 60.0), 1)

    @property
    def has_progress(self) -> bool:
        return len(self.progress) >= MIN_SAMPLES


def _clamp01(value: float) -> float:
    return max(0.0, min(1.0, value))


def _pace_value(context: ProcessContext) -> tuple[float, str]:
    if context.duration_seconds == 0 and context.word_count >= BURST_WORDS:
        # Durasi nol terukur: seluruh teks tiba saat dikumpulkan, bukan durasi tidak diketahui.
        return 1.0, f"{context.word_count} kata tiba sekaligus saat dikumpulkan, tanpa penulisan di editor ThinkPath"
    wpm = context.words_per_minute
    if wpm is None:
        return 0.5, "Durasi pengerjaan tidak terekam"
    if context.word_count < BURST_WORDS:
        return 0.0, f"{context.word_count} kata, terlalu pendek untuk menilai laju mengetik"
    if wpm <= PLAUSIBLE_WPM:
        value = 0.0
    else:
        span = IMPLAUSIBLE_WPM - PLAUSIBLE_WPM
        value = _clamp01((wpm - PLAUSIBLE_WPM) / span)
    minutes = max(1, round((context.duration_seconds or 0) / 60))
    return value, f"{context.word_count} kata dalam {minutes} menit ({wpm:.0f} kata/menit)"


def _revision_note(context: ProcessContext) -> str:
    """Keterangan revisi untuk dosen. Tidak pernah menyumbang nilai."""
    if context.revision_count <= 0:
        return ""
    return f"direvisi {context.revision_count} kali setelah dikumpulkan (tidak diskor)"


def _growth_value(context: ProcessContext) -> tuple[float, str]:
    """value = (jumlah kata dari SEMUA lonjakan) / kata akhir, dijepit 0-1.

    Menjumlah semua lonjakan (bukan yang terbesar) agar tempelan yang dipecah tetap terhitung.
    """
    if not context.has_progress:
        return 0.5, "Jejak pengerjaan tidak terekam"

    samples = sorted(context.progress, key=lambda s: s.offset_seconds)
    burst_total = 0
    burst_count = 0
    largest = 0

    # Cuplikan pertama = langkah dari nol (tempelan sebelum cuplikan perdana tetap terlihat);
    # detik minimal 1 agar tidak membagi nol.
    steps = [(samples[0].word_count, max(samples[0].offset_seconds, 1))] + [
        (after.word_count - before.word_count, max(after.offset_seconds - before.offset_seconds, 1))
        for before, after in zip(samples, samples[1:])
    ]
    for delta, seconds in steps:
        largest = max(largest, delta)
        if delta >= BURST_WORDS and delta / seconds * 60.0 >= BURST_WPM:
            burst_total += delta
            burst_count += 1

    final = max(samples[-1].word_count, 1)
    share = _clamp01(burst_total / final)

    if burst_count == 0:
        return (
            0.0,
            f"Teks tumbuh bertahap, penambahan terbesar {largest} kata sekaligus",
        )

    potongan = "satu lonjakan" if burst_count == 1 else f"{burst_count} lonjakan"
    return (
        share,
        f"{burst_total} kata muncul lewat {potongan} tanpa pengetikan bertahap "
        f"({share * 100:.0f}% dari jawaban akhir)",
    )


def evaluate_process(context: ProcessContext) -> tuple[float, str]:
    """(value 0-1, bukti): kurva pertumbuhan bila >= 4 cuplikan, kalau tidak laju agregat.

    Kata baru lewat revisi >= 60 menaikkan value ke porsinya bila lebih besar.
    """
    if context.has_progress:
        value, evidence = _growth_value(context)
    else:
        value, evidence = _pace_value(context)

    if context.inserted_words >= BURST_WORDS:
        share = _clamp01(context.inserted_words / max(context.word_count, 1))
        if share > value:
            value = share
        evidence += f", {context.inserted_words} kata baru masuk sekaligus lewat revisi"

    parts = [evidence, _revision_note(context)]
    return _clamp01(value), ", ".join(part for part in parts if part)


class ProcessBand:
    """Pita pola pengerjaan. Netral: bukan vonis, tidak menyebut AI."""

    NORMAL = "normal"
    PARTIAL = "partial"
    ATTENTION = "attention"
    UNRECORDED = "unrecorded"
    # Jawaban diimpor dari dokumen: tidak ada jejak mengetik yang bisa dinilai.
    NOT_APPLICABLE = ""


@dataclass(frozen=True)
class ProcessAssessment:
    band: str
    value: float
    evidence: str


def assess_process(context: ProcessContext | None) -> ProcessAssessment:
    """process_band: >= 0,6 attention, >= 0,35 partial, selainnya normal; unrecorded bila tanpa dasar."""
    if context is None:
        return ProcessAssessment(ProcessBand.NOT_APPLICABLE, 0.0, "")
    value, evidence = evaluate_process(context)
    if not context.has_progress and context.duration_seconds is None:
        return ProcessAssessment(ProcessBand.UNRECORDED, value, evidence)
    if not context.has_progress and context.words_per_minute is None and value == 0.5:
        return ProcessAssessment(ProcessBand.UNRECORDED, value, evidence)
    if value >= ATTENTION_SHARE:
        band = ProcessBand.ATTENTION
    elif value >= NORMAL_SHARE:
        band = ProcessBand.PARTIAL
    else:
        band = ProcessBand.NORMAL
    return ProcessAssessment(band, value, evidence)
