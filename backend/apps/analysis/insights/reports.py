"""Laporan lintas kelas: kesenjangan Bloom terhadap target di depan, sebaran band AI hanya konteks.

Cakupan ditentukan queryset pemanggil (kini kelas milik dosen sendiri).
"""
from __future__ import annotations

from django.db.models import Avg, Count, F, Q, QuerySet

from apps.academics.models import Class, Submission
from apps.analysis.choices import AiBand, AnalysisSource

# Submission dianggap "punya analisis" hanya kalau baris AnalysisResult-nya ada.
ANALYSED = Q(analysis__isnull=False)


def submissions_for_classes(classes: QuerySet[Class]) -> QuerySet[Submission]:
    return Submission.objects.filter(
        assignment__class_ref__in=classes
    ).select_related("assignment", "assignment__class_ref", "analysis")


def build_overview(classes: QuerySet[Class]) -> dict:
    """Ringkasan seluruh kelas dalam cakupan, dalam SATU aggregate (biaya utamanya round trip)."""
    submissions = submissions_for_classes(classes)

    stats = submissions.aggregate(
        submission_count=Count("id"),
        analysed_count=Count("id", filter=ANALYSED),
        gap_below=Count(
            "id",
            filter=Q(analysis__bloom_level__lt=F("assignment__expected_bloom_level")),
        ),
        gap_on_target=Count(
            "id",
            filter=Q(analysis__bloom_level=F("assignment__expected_bloom_level")),
        ),
        gap_above=Count(
            "id",
            filter=Q(analysis__bloom_level__gt=F("assignment__expected_bloom_level")),
        ),
        band_low=Count("id", filter=Q(analysis__ai_band=AiBand.LOW)),
        band_mid=Count("id", filter=Q(analysis__ai_band=AiBand.MID)),
        band_high=Count("id", filter=Q(analysis__ai_band=AiBand.HIGH)),
        # llm hanya ada di baris lama; seed = data contoh.
        src_llm=Count("id", filter=Q(analysis__analysis_source=AnalysisSource.LLM)),
        src_heuristic=Count(
            "id", filter=Q(analysis__analysis_source=AnalysisSource.HEURISTIC)
        ),
        src_seed=Count("id", filter=Q(analysis__analysis_source=AnalysisSource.SEED)),
        src_detector=Count(
            "id", filter=Q(analysis__analysis_source=AnalysisSource.DETECTOR)
        ),
    )

    return {
        "class_count": classes.count(),
        "submission_count": stats["submission_count"],
        "analysed_count": stats["analysed_count"],
        "cognitive_gap": {
            "below": stats["gap_below"],
            "on_target": stats["gap_on_target"],
            "above": stats["gap_above"],
        },
        "ai_band": {
            "low": stats["band_low"],
            "mid": stats["band_mid"],
            "high": stats["band_high"],
        },
        "provenance": {
            "llm": stats["src_llm"],
            "heuristic": stats["src_heuristic"],
            "seed": stats["src_seed"],
            "detector": stats["src_detector"],
        },
    }


def _metrics_by(analysed: QuerySet[Submission], key_path: str) -> dict:
    """Metrik dihitung dari sisi Submission lalu dikelompokkan (anotasi di Class menggandakan baris)."""
    grouped = analysed.values(key=F(key_path)).annotate(
        analysed_count=Count("id"),
        below_target_count=Count(
            "id",
            filter=Q(analysis__bloom_level__lt=F("assignment__expected_bloom_level")),
        ),
        high_band_count=Count("id", filter=Q(analysis__ai_band=AiBand.HIGH)),
        avg_bloom=Avg("analysis__bloom_level"),
    )
    return {item["key"]: item for item in grouped}


def _ratio(part: int, whole: int) -> float | None:
    return round(part / whole, 3) if whole else None


def build_per_class(classes: QuerySet[Class]) -> list[dict]:
    """Satu baris per kelas, diurutkan dari porsi jawaban di bawah target terbesar (bukan porsi indikasi AI)."""
    analysed = submissions_for_classes(classes).filter(ANALYSED)
    metrics = _metrics_by(analysed, "assignment__class_ref_id")

    rows = []
    # Jumlah tugas dianotasi di query daftar kelas, bukan round trip kedua.
    for item in classes.annotate(assignment_count=Count("assignments")):
        stat = metrics.get(item.id, {})
        total = stat.get("analysed_count", 0)
        below = stat.get("below_target_count", 0)
        avg_bloom = stat.get("avg_bloom")
        rows.append(
            {
                "id": str(item.id),
                "name": item.name,
                "subject": item.subject,
                "education_level": item.education_level,
                "program_studi": item.program_studi,
                "semester": item.semester,
                "assignment_count": item.assignment_count,
                "analysed_count": total,
                "below_target_count": below,
                "below_target_ratio": _ratio(below, total),
                "high_band_count": stat.get("high_band_count", 0),
                "avg_bloom": round(avg_bloom, 2) if avg_bloom is not None else None,
            }
        )

    # Rasio None (kelas tanpa data) selalu di bawah.
    rows.sort(
        key=lambda row: (
            row["below_target_ratio"] is None,
            -(row["below_target_ratio"] or 0),
        )
    )
    return rows


def _group_rows(classes: QuerySet[Class], field: str, label_key: str) -> list[dict]:
    """Kelompokkan submission menurut satu kolom di Class."""
    analysed = submissions_for_classes(classes).filter(ANALYSED)
    metrics = _metrics_by(analysed, f"assignment__class_ref__{field}")

    rows = []
    for key, stat in metrics.items():
        total = stat["analysed_count"]
        avg_bloom = stat["avg_bloom"]
        rows.append(
            {
                label_key: key,
                "analysed_count": total,
                "below_target_count": stat["below_target_count"],
                "below_target_ratio": _ratio(stat["below_target_count"], total),
                "high_band_count": stat["high_band_count"],
                "avg_bloom": round(avg_bloom, 2) if avg_bloom is not None else None,
            }
        )
    return rows


def build_per_program(classes: QuerySet[Class]) -> list[dict]:
    rows = _group_rows(classes, "program_studi", "program_studi")
    # Prodi kosong (mata kuliah umum) diletakkan paling akhir.
    rows.sort(key=lambda row: (not row["program_studi"], row["program_studi"] or ""))
    return rows


def build_per_semester(classes: QuerySet[Class]) -> list[dict]:
    rows = _group_rows(classes, "semester", "semester")
    # Semester None (lintas semester) paling akhir.
    rows.sort(key=lambda row: (row["semester"] is None, row["semester"] or 0))
    return rows


def build_report(classes: QuerySet[Class]) -> dict:
    return {
        "overview": build_overview(classes),
        "per_class": build_per_class(classes),
        "per_program": build_per_program(classes),
        "per_semester": build_per_semester(classes),
    }
