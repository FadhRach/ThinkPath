"""E4: profil kognitif mahasiswa dari tren level Bloom lintas waktu.

Ini penerapan "level optimal mahasiswa" pada blueprint. Bukan model baru, bukan
Bayesian Knowledge Tracing, melainkan matematika sederhana di atas keluaran E2:
rata rata bergerak dari level Bloom yang teramati, per kelas, terurut waktu.

Kejujuran yang harus dijaga saat membaca angka di sini:

**Profil ini setipis E2 yang mendasarinya.** E2 belum tervalidasi sama sekali,
jadi tren ini mewarisi seluruh ketidakpastiannya. Kalau E2 meleset satu tingkat
secara acak, tren yang terlihat bisa jadi derau belaka.

**Tren butuh cukup titik.** Dua submission tidak membentuk tren, hanya garis
antara dua titik. Modul ini menolak menyebut arah kalau titiknya kurang dari
tiga, dan mengembalikan "belum cukup data" alih alih menebak.
"""
from __future__ import annotations

from dataclasses import dataclass

from django.db.models import QuerySet

from .models import Submission

# Bobot pemulusan eksponensial. Semakin besar, semakin berat bobot tugas
# terbaru. 0,5 berarti tugas terakhir menyumbang separuh nilai akhir.
SMOOTHING = 0.5

# Di bawah ini arah tren tidak disebut. Dua titik hanya membentuk garis, bukan
# kecenderungan.
MIN_POINTS_FOR_TREND = 3

# Selisih rata rata paruh akhir terhadap paruh awal yang dianggap berarti.
TREND_THRESHOLD = 0.5


@dataclass(frozen=True)
class TrendSummary:
    current_level: float | None
    direction: str
    points: int

    @property
    def has_trend(self) -> bool:
        return self.points >= MIN_POINTS_FOR_TREND


def smoothed_level(levels: list[int]) -> float | None:
    """Rata rata bergerak eksponensial, terurut dari terlama ke terbaru.

    Dipakai daripada rata rata biasa karena yang ingin dijawab adalah "di level
    mana mahasiswa ini sekarang", bukan "berapa rata rata sepanjang semester".
    Mahasiswa yang naik dari L1 ke L4 tidak sedang berada di L2.
    """
    if not levels:
        return None
    value = float(levels[0])
    for level in levels[1:]:
        value = SMOOTHING * level + (1 - SMOOTHING) * value
    return round(value, 2)


def trend_direction(levels: list[int]) -> str:
    """Bandingkan paruh akhir terhadap paruh awal.

    Sengaja tidak memakai regresi. Dengan lima titik, kemiringan garis regresi
    sangat sensitif terhadap satu pencilan, sedangkan perbandingan paruh lebih
    tahan dan lebih mudah dijelaskan ke dosen.
    """
    if len(levels) < MIN_POINTS_FOR_TREND:
        return "belum_cukup_data"

    half = len(levels) // 2
    earlier = levels[:half]
    later = levels[-half:]
    delta = (sum(later) / len(later)) - (sum(earlier) / len(earlier))

    if delta >= TREND_THRESHOLD:
        return "naik"
    if delta <= -TREND_THRESHOLD:
        return "turun"
    return "datar"


def summarise(levels: list[int]) -> TrendSummary:
    return TrendSummary(
        current_level=smoothed_level(levels),
        direction=trend_direction(levels),
        points=len(levels),
    )


def build_profile(submissions: QuerySet[Submission]) -> list[dict]:
    """Kelompokkan submission teranalisis menjadi satu deret per kelas.

    Pemanggil yang menentukan cakupan: dosen melihat mahasiswa di kelasnya,
    mahasiswa melihat dirinya sendiri. Perhitungannya sama persis.
    """
    analysed = (
        submissions.filter(analysis__isnull=False)
        .select_related("analysis", "assignment", "assignment__class_ref")
        .order_by("submitted_at")
    )

    grouped: dict[str, dict] = {}
    for submission in analysed:
        klass = submission.assignment.class_ref
        entry = grouped.setdefault(
            str(klass.id),
            {
                "class_id": str(klass.id),
                "class_name": klass.name,
                "subject": klass.subject,
                "points": [],
            },
        )
        entry["points"].append(
            {
                "submission_id": str(submission.id),
                "label": submission.assignment.title,
                "level": submission.analysis.bloom_level,
                "expected": submission.assignment.expected_bloom_level,
                "ai_band": submission.analysis.ai_band,
                "submitted_at": submission.submitted_at,
            }
        )

    result = []
    for entry in grouped.values():
        levels = [point["level"] for point in entry["points"]]
        summary = summarise(levels)
        expected = [point["expected"] for point in entry["points"]]
        result.append(
            {
                **entry,
                "current_level": summary.current_level,
                "direction": summary.direction,
                "point_count": summary.points,
                # Target rata rata dipakai frontend untuk menggambar garis
                # acuan pada grafik.
                "average_target": round(sum(expected) / len(expected), 2)
                if expected
                else None,
            }
        )
    result.sort(key=lambda item: item["class_name"])
    return result
