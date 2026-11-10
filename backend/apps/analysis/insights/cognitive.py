"""E4: profil kognitif = rata-rata bergerak eksponensial level Bloom per kelas, terurut waktu.

Mewarisi ketidakpastian E2; arah tren tidak disebut bila titik kurang dari tiga.
"""
from __future__ import annotations

from dataclasses import dataclass

from django.db.models import QuerySet

from apps.academics.models import Submission

# Bobot EMA: 0,5 = tugas terakhir menyumbang separuh nilai.
SMOOTHING = 0.5

# Di bawah ini arah tren tidak disebut.
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
    """EMA dari terlama ke terbaru: menjawab "di level mana sekarang", bukan rata-rata semester."""
    if not levels:
        return None
    value = float(levels[0])
    for level in levels[1:]:
        value = SMOOTHING * level + (1 - SMOOTHING) * value
    return round(value, 2)


def trend_direction(levels: list[int]) -> str:
    """Rata-rata paruh akhir vs paruh awal (lebih tahan pencilan daripada regresi pada sedikit titik)."""
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
    """Satu deret per kelas; cakupan (dosen/mahasiswa) ditentukan pemanggil."""
    analysed = (
        submissions.filter(analysis__isnull=False)
        .select_related("analysis", "assignment", "assignment__class_ref")
        # Hanya angka kecil yang dibaca; kolom teks besar tidak diangkut.
        .defer(
            "text_answer",
            "teacher_feedback",
            "assignment__instructions",
            "analysis__signals",
            "analysis__signal_breakdown",
            "analysis__summary",
            "analysis__recommendation",
        )
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
                # Garis acuan grafik di frontend.
                "average_target": round(sum(expected) / len(expected), 2)
                if expected
                else None,
            }
        )
    result.sort(key=lambda item: item["class_name"])
    return result
