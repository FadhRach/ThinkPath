"""Agregasi lintas kelas untuk layar Laporan.

Prinsip yang menentukan bentuk berkas ini:

**Kesenjangan kognitif di depan, skor AI di belakang.** Angka agregat jauh lebih
berbahaya daripada angka per submission. Kalimat seperti "Prodi X: 40% indikasi
AI tinggi" gampang berubah menjadi stigma, padahal skornya sendiri belum
dikalibrasi terhadap data berlabel. Karena itu metrik utama laporan ini adalah
selisih antara level Bloom yang teramati dan target dosen, yang menjawab
"materi mana yang belum tersampaikan", bukan "siapa yang menyontek".

Sebaran band AI tetap dilaporkan karena dosen berhak melihatnya, tetapi sebagai
konteks dan selalu disertai jumlah submission yang belum tervalidasi.

Cakupan ditentukan pemanggil lewat queryset, bukan di dalam modul ini. Sekarang
pemanggilnya membatasi ke kelas milik dosen sendiri. Ketika peran Kaprodi
dibangun, cukup ganti querysetnya menjadi seluruh kelas satu prodi tanpa
menulis ulang perhitungan di sini.
"""
from __future__ import annotations

from django.db.models import Avg, Count, F, Q, QuerySet

from .models import AiBand, AnalysisSource, Class, Submission

# Submission dianggap "punya analisis" hanya kalau baris AnalysisResult-nya ada.
ANALYSED = Q(analysis__isnull=False)


def submissions_for_classes(classes: QuerySet[Class]) -> QuerySet[Submission]:
    return Submission.objects.filter(
        assignment__class_ref__in=classes
    ).select_related("assignment", "assignment__class_ref", "analysis")


def build_overview(classes: QuerySet[Class]) -> dict:
    """Ringkasan seluruh kelas dalam cakupan."""
    submissions = submissions_for_classes(classes)
    analysed = submissions.filter(ANALYSED)

    gap_buckets = analysed.aggregate(
        below=Count("id", filter=Q(analysis__bloom_level__lt=F("assignment__expected_bloom_level"))),
        on_target=Count("id", filter=Q(analysis__bloom_level=F("assignment__expected_bloom_level"))),
        above=Count("id", filter=Q(analysis__bloom_level__gt=F("assignment__expected_bloom_level"))),
    )

    band_buckets = analysed.aggregate(
        low=Count("id", filter=Q(analysis__ai_band=AiBand.LOW)),
        mid=Count("id", filter=Q(analysis__ai_band=AiBand.MID)),
        high=Count("id", filter=Q(analysis__ai_band=AiBand.HIGH)),
    )

    # Berapa banyak angka yang sebenarnya berasal dari hitungan cadangan atau
    # data contoh. Tanpa ini, laporan terbaca seolah semuanya hasil analisis
    # penuh.
    provenance = analysed.aggregate(
        llm=Count("id", filter=Q(analysis__analysis_source=AnalysisSource.LLM)),
        heuristic=Count(
            "id", filter=Q(analysis__analysis_source=AnalysisSource.HEURISTIC)
        ),
        seed=Count("id", filter=Q(analysis__analysis_source=AnalysisSource.SEED)),
    )

    return {
        "class_count": classes.count(),
        "submission_count": submissions.count(),
        "analysed_count": analysed.count(),
        "cognitive_gap": gap_buckets,
        "ai_band": band_buckets,
        "provenance": provenance,
    }


def _metrics_by(analysed: QuerySet[Submission], key_path: str) -> dict:
    """Hitung metrik dari sisi submission, lalu kelompokkan menurut satu kolom.

    Sengaja TIDAK menganotasi langsung di Class. Class terhubung ke Submission
    lewat Assignment, dan menganotasi beberapa agregat sekaligus melewati dua
    relasi bertingkat membuat baris terduplikasi sehingga hitungannya
    menggelembung. Mengelompokkan dari sisi submission menghindari jebakan itu
    sepenuhnya: satu submission selalu satu baris.
    """
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
    """Satu baris per kelas, diurutkan dari yang paling butuh perhatian.

    Urutan ditentukan porsi jawaban di bawah target, bukan porsi indikasi AI.
    Ini penerapan langsung dari prinsip di docstring modul: yang naik ke atas
    adalah kelas yang materinya belum tersampaikan, bukan kelas yang paling
    dicurigai.
    """
    analysed = submissions_for_classes(classes).filter(ANALYSED)
    metrics = _metrics_by(analysed, "assignment__class_ref_id")

    assignment_counts = {
        item["id"]: item["assignment_count"]
        for item in classes.annotate(assignment_count=Count("assignments")).values(
            "id", "assignment_count"
        )
    }

    rows = []
    for item in classes:
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
                "assignment_count": assignment_counts.get(item.id, 0),
                "analysed_count": total,
                "below_target_count": below,
                "below_target_ratio": _ratio(below, total),
                "high_band_count": stat.get("high_band_count", 0),
                "avg_bloom": round(avg_bloom, 2) if avg_bloom is not None else None,
            }
        )

    # Rasio None (kelas tanpa submission teranalisis) selalu di bawah, karena
    # tidak ada yang bisa disimpulkan dari kelas kosong.
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
    # Semester None (kelas lintas semester) diletakkan paling akhir supaya
    # tabelnya terbaca urut 1, 2, 3, lalu "tidak ditentukan".
    rows.sort(key=lambda row: (row["semester"] is None, row["semester"] or 0))
    return rows


def build_report(classes: QuerySet[Class]) -> dict:
    return {
        "overview": build_overview(classes),
        "per_class": build_per_class(classes),
        "per_program": build_per_program(classes),
        "per_semester": build_per_semester(classes),
    }
