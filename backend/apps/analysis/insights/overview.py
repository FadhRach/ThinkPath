"""Overview dosen: sebaran skor AI vs selisih Bloom, distribusi level Bloom, tren rata-rata kelas.

Dua sumbu, bukan peringkat skor AI, agar mahasiswa jujur yang tertinggal target juga terlihat. Bukan vonis.
"""
from __future__ import annotations

from collections import defaultdict

from django.db.models import QuerySet

from apps.analysis.insights.cognitive import smoothed_level, trend_direction
from apps.academics.models import Submission

# Satu tingkat penuh agar pembulatan E2 tidak sendirian memindahkan orang ke "perlu perhatian".
GAP_THRESHOLD = -1.0


def _student_points(submissions: QuerySet[Submission]) -> dict:
    """Kelompokkan per (kelas, mahasiswa) dari sisi Submission (anotasi berjenjang menggandakan hitungan)."""
    grouped: dict[tuple[str, str], dict] = {}
    for submission in submissions:
        klass = submission.assignment.class_ref
        profile = submission.student_profile
        key = (str(klass.id), str(profile.id))
        entry = grouped.setdefault(
            key,
            {
                "student_id": str(profile.id),
                "display_name": profile.label,
                "levels": [],
                "targets": [],
                "ai_scores": [],
                "high_count": 0,
            },
        )
        entry["levels"].append(submission.analysis.bloom_level)
        entry["targets"].append(submission.assignment.expected_bloom_level)
        entry["ai_scores"].append(submission.analysis.ai_score)
        if submission.analysis.ai_band == "high":
            entry["high_count"] += 1
    return grouped


def _build_students(entries: list[dict]) -> list[dict]:
    students = []
    for entry in entries:
        levels = entry["levels"]
        targets = entry["targets"]
        scores = entry["ai_scores"]
        current = smoothed_level(levels)
        target = round(sum(targets) / len(targets), 2) if targets else None
        gap = (
            round(current - target, 2)
            if current is not None and target is not None
            else None
        )
        students.append(
            {
                "student_id": entry["student_id"],
                "display_name": entry["display_name"],
                # Rata-rata, bukan maksimum: satu jawaban bagus tidak mendefinisikan mahasiswa.
                "ai_mean": round(sum(scores) / len(scores), 1) if scores else 0.0,
                "high_count": entry["high_count"],
                "current_level": current,
                "average_target": target,
                "gap": gap,
                "direction": trend_direction(levels),
                "submission_count": len(levels),
            }
        )
    students.sort(key=lambda item: (item["gap"] is None, item["gap"]))
    return students


def _bloom_distribution(entries: list[dict]) -> list[dict]:
    """Jumlah submission per level; below_target dibanding target tugasnya sendiri, bukan rata-rata kelas."""
    counts: dict[int, int] = defaultdict(int)
    below: dict[int, int] = defaultdict(int)
    for entry in entries:
        for level, target in zip(entry["levels"], entry["targets"]):
            counts[level] += 1
            if level < target:
                below[level] += 1
    return [
        {
            "level": level,
            "count": counts.get(level, 0),
            "below_target": below.get(level, 0),
        }
        for level in range(1, 7)
    ]


def _cohort_trend(submissions: list[Submission]) -> list[dict]:
    """Rata-rata level kelas per tugas (dikunci pada tugas, bukan tanggal pengumpulan)."""
    by_assignment: dict[str, dict] = {}
    for submission in submissions:
        assignment = submission.assignment
        entry = by_assignment.setdefault(
            str(assignment.id),
            {
                "title": assignment.title,
                "expected": assignment.expected_bloom_level,
                "deadline": assignment.deadline,
                "levels": [],
            },
        )
        entry["levels"].append(submission.analysis.bloom_level)

    ordered = sorted(
        by_assignment.values(),
        key=lambda item: (item["deadline"] is None, item["deadline"]),
    )
    return [
        {
            "label": f"T{index + 1}",
            "title": entry["title"],
            "level": round(sum(entry["levels"]) / len(entry["levels"]), 2),
            "expected": entry["expected"],
        }
        for index, entry in enumerate(ordered)
    ]


def _class_average_target(trend: list[dict]) -> float | None:
    """Target kelas = rata-rata target tugas, bukan lewat mahasiswa."""
    if not trend:
        return None
    return round(sum(point["expected"] for point in trend) / len(trend), 2)


def build_teacher_overview(
    classes: QuerySet, submissions: QuerySet[Submission]
) -> list[dict]:
    """Satu blok per kelas; kelas tanpa data tetap dikembalikan dengan deret kosong."""
    analysed = list(
        submissions.filter(analysis__isnull=False)
        .select_related(
            "analysis", "assignment", "assignment__class_ref", "student_profile"
        )
        # defer kolom teks besar; defer (bukan only) agar kolom kecil baru tak memicu query susulan.
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

    grouped = _student_points(analysed)
    per_class_entries: dict[str, list[dict]] = defaultdict(list)
    for (class_id, _), entry in grouped.items():
        per_class_entries[class_id].append(entry)

    per_class_submissions: dict[str, list[Submission]] = defaultdict(list)
    for submission in analysed:
        per_class_submissions[str(submission.assignment.class_ref_id)].append(submission)

    result = []
    for klass in classes:
        class_id = str(klass.id)
        entries = per_class_entries.get(class_id, [])
        students = _build_students(entries)
        trend = _cohort_trend(per_class_submissions.get(class_id, []))
        below = [
            student
            for student in students
            if student["gap"] is not None and student["gap"] <= GAP_THRESHOLD
        ]
        result.append(
            {
                "class_id": class_id,
                "class_name": klass.name,
                "subject": klass.subject,
                "students": students,
                "below_target_count": len(below),
                # Terpisah dari below_target_count: keduanya sering tidak beririsan.
                "high_band_count": sum(
                    1 for student in students if student["high_count"] > 0
                ),
                "bloom_distribution": _bloom_distribution(entries),
                "cohort_trend": trend,
                "average_target": _class_average_target(trend),
            }
        )
    result.sort(key=lambda item: item["class_name"])
    return result
