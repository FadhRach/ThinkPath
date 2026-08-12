"""Tes agregasi laporan.

Berbeda dari berkas tes lain di folder ini, tes ini menyentuh basis data. Itu
memang perlu: yang diuji adalah kebenaran query agregat, dan query agregat tidak
bisa diuji tanpa baris sungguhan.

Jebakan utama yang dijaga di sini adalah penggelembungan hitungan. Class
terhubung ke Submission lewat Assignment, jadi menganotasi beberapa agregat
sekaligus melewati dua relasi bertingkat akan menduplikasi baris: kelas dengan
dua tugas akan melaporkan jumlah submission dua kali lipat. Bug itu tidak
memunculkan galat apa pun, hanya angka yang salah di layar dosen.
"""
from __future__ import annotations

from datetime import timedelta

from django.test import TestCase
from django.utils import timezone

from academics.models import (
    AiBand,
    AnalysisResult,
    AnalysisSource,
    Assignment,
    Class,
    Confidence,
    Submission,
)
from academics.reports import build_report
from core.models import EducationLevel, Profile, Role


class ReportAggregationTest(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.teacher = Profile.objects.create(
            email="dosen@test.local", display_name="Dosen Uji", role=Role.TEACHER
        )
        cls.other_teacher = Profile.objects.create(
            email="lain@test.local", display_name="Dosen Lain", role=Role.TEACHER
        )
        cls.student = Profile.objects.create(
            email="mhs@test.local", display_name="Mahasiswa Uji", role=Role.STUDENT
        )

        # Kelas dengan DUA tugas. Inilah bentuk yang memicu penggelembungan
        # kalau agregasinya dilakukan dari sisi Class.
        cls.kelas = cls._make_class("Metpen A", "Sistem Informasi", 5, cls.teacher)
        cls.tugas_a = cls._make_assignment(cls.kelas, "Tugas A", expected=4)
        cls.tugas_b = cls._make_assignment(cls.kelas, "Tugas B", expected=3)

        # Kelas milik dosen lain, tidak boleh ikut terhitung.
        cls.kelas_lain = cls._make_class(
            "Kelas Lain", "Ilmu Ekonomi", 3, cls.other_teacher
        )
        cls.tugas_lain = cls._make_assignment(cls.kelas_lain, "Tugas Lain", expected=4)

        # Tugas A: 2 di bawah target, 1 tepat target.
        cls._make_submission(cls.tugas_a, bloom=2, band=AiBand.LOW)
        cls._make_submission(cls.tugas_a, bloom=3, band=AiBand.HIGH)
        cls._make_submission(cls.tugas_a, bloom=4, band=AiBand.LOW)
        # Tugas B: 1 di atas target.
        cls._make_submission(cls.tugas_b, bloom=5, band=AiBand.MID)
        # Kelas dosen lain.
        cls._make_submission(cls.tugas_lain, bloom=1, band=AiBand.HIGH)

        # Satu submission TANPA analisis: harus terhitung di submission_count
        # tetapi tidak di analysed_count.
        cls._make_submission(cls.tugas_a, bloom=None, band=None)

    @staticmethod
    def _make_class(name, program_studi, semester, owner):
        return Class.objects.create(
            owner=owner,
            name=name,
            subject=name,
            education_level=EducationLevel.S1,
            program_studi=program_studi,
            semester=semester,
            join_code=f"{name[:2].upper()}-{semester}{len(name)}XY",
        )

    @staticmethod
    def _make_assignment(class_ref, title, expected):
        return Assignment.objects.create(
            class_ref=class_ref,
            title=title,
            instructions="",
            deadline=timezone.now() + timedelta(days=7),
            expected_bloom_level=expected,
        )

    @classmethod
    def _make_submission(cls, assignment, bloom, band):
        now = timezone.now()
        submission = Submission.objects.create(
            assignment=assignment,
            student_profile=cls.student,
            text_answer="teks",
            started_at=now - timedelta(minutes=20),
            submitted_at=now,
            duration_seconds=1200,
        )
        if bloom is not None:
            AnalysisResult.objects.create(
                submission=submission,
                ai_score=50,
                ai_band=band,
                bloom_level=bloom,
                confidence=Confidence.MEDIUM,
                bloom_confidence=Confidence.MEDIUM,
                analysis_source=AnalysisSource.SEED,
            )
        return submission

    def _report(self):
        return build_report(Class.objects.filter(owner_id=self.teacher.id))

    def test_counts_are_not_inflated_by_multiple_assignments(self):
        """Kelas dengan dua tugas tidak boleh melaporkan submission dua kali."""
        report = self._report()
        row = next(r for r in report["per_class"] if r["name"] == "Metpen A")
        self.assertEqual(row["analysed_count"], 4)
        self.assertEqual(row["assignment_count"], 2)

    def test_other_teachers_classes_are_excluded(self):
        report = self._report()
        names = {row["name"] for row in report["per_class"]}
        self.assertNotIn("Kelas Lain", names)
        self.assertEqual(report["overview"]["class_count"], 1)

    def test_unanalysed_submission_counted_separately(self):
        report = self._report()
        overview = report["overview"]
        self.assertEqual(overview["submission_count"], 5)
        self.assertEqual(overview["analysed_count"], 4)

    def test_cognitive_gap_buckets_sum_to_analysed(self):
        report = self._report()
        gap = report["overview"]["cognitive_gap"]
        self.assertEqual(gap["below"], 2)
        self.assertEqual(gap["on_target"], 1)
        self.assertEqual(gap["above"], 1)
        self.assertEqual(
            sum(gap.values()), report["overview"]["analysed_count"]
        )

    def test_ai_band_buckets_sum_to_analysed(self):
        report = self._report()
        band = report["overview"]["ai_band"]
        self.assertEqual(sum(band.values()), report["overview"]["analysed_count"])

    def test_provenance_is_reported(self):
        """Tanpa ini, laporan terbaca seolah semua angka hasil analisis penuh."""
        report = self._report()
        provenance = report["overview"]["provenance"]
        self.assertEqual(provenance["seed"], 4)
        self.assertEqual(provenance["llm"], 0)

    def test_grouping_totals_match_the_overview(self):
        report = self._report()
        analysed = report["overview"]["analysed_count"]
        for key in ("per_class", "per_program", "per_semester"):
            total = sum(row["analysed_count"] for row in report[key])
            self.assertEqual(total, analysed, f"{key} tidak menjumlah ke total")

    def test_per_class_sorted_by_cognitive_gap_not_ai_score(self):
        """Yang naik ke atas adalah kelas yang materinya belum tersampaikan.

        Mengurutkan berdasarkan indikasi AI akan mengubah laporan pedagogis
        menjadi daftar kecurigaan.
        """
        kelas_b = self._make_class("Kelas Aman", "Sistem Informasi", 5, self.teacher)
        tugas_b = self._make_assignment(kelas_b, "Tugas Aman", expected=1)
        # Semua tepat target, tetapi seluruhnya berindikasi AI tinggi.
        for _ in range(3):
            self._make_submission(tugas_b, bloom=1, band=AiBand.HIGH)

        rows = self._report()["per_class"]
        self.assertEqual(rows[0]["name"], "Metpen A")
        self.assertGreater(rows[0]["below_target_ratio"], rows[1]["below_target_ratio"])
        self.assertLess(rows[0]["high_band_count"], rows[1]["high_band_count"])

    def test_class_without_analysis_sorts_last(self):
        kosong = self._make_class("Kelas Kosong", "Sistem Informasi", 1, self.teacher)
        self._make_assignment(kosong, "Belum dikerjakan", expected=4)
        rows = self._report()["per_class"]
        self.assertEqual(rows[-1]["name"], "Kelas Kosong")
        self.assertIsNone(rows[-1]["below_target_ratio"])
