"""Tes agregasi layar Overview dosen.

Yang dijaga: sebaran level Bloom memisahkan jawaban yang di bawah target
tugasnya sendiri. Grafik di frontend mewarnai bagian itu, jadi kalau hitungannya
memakai rata rata target kelas, warnanya akan menuduh jawaban yang sebenarnya
sudah memenuhi tuntutan tugasnya.
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
from academics.overview import build_teacher_overview
from core.models import EducationLevel, Profile, Role


class BloomDistributionTest(TestCase):
    @classmethod
    def setUpTestData(cls):
        teacher = Profile.objects.create(
            email="dosen@test.local", display_name="Dosen Uji", role=Role.TEACHER
        )
        cls.student = Profile.objects.create(
            email="mhs@test.local", display_name="Mahasiswa Uji", role=Role.STUDENT
        )
        cls.kelas = Class.objects.create(
            owner=teacher,
            name="Metpen A",
            subject="Metodologi Penelitian",
            education_level=EducationLevel.S1,
            program_studi="Sistem Informasi",
            semester=5,
            join_code="MP-5A1XY",
        )
        tugas_l4 = cls._assignment("Tugas bertarget L4", expected=4, days=1)
        tugas_l3 = cls._assignment("Tugas bertarget L3", expected=3, days=2)

        # Target L4: L2 dan L3 di bawah target, L4 memenuhi.
        for bloom in (2, 3, 4):
            cls._submission(tugas_l4, bloom)
        # Target L3: L3 memenuhi, L5 di atas.
        for bloom in (3, 5):
            cls._submission(tugas_l3, bloom)

    @classmethod
    def _assignment(cls, title, expected, days):
        return Assignment.objects.create(
            class_ref=cls.kelas,
            title=title,
            instructions="",
            deadline=timezone.now() + timedelta(days=days),
            expected_bloom_level=expected,
        )

    @classmethod
    def _submission(cls, assignment, bloom):
        now = timezone.now()
        submission = Submission.objects.create(
            assignment=assignment,
            student_profile=cls.student,
            text_answer="teks",
            started_at=now - timedelta(minutes=20),
            submitted_at=now,
            duration_seconds=1200,
        )
        AnalysisResult.objects.create(
            submission=submission,
            ai_score=20,
            ai_band=AiBand.LOW,
            bloom_level=bloom,
            confidence=Confidence.MEDIUM,
            bloom_confidence=Confidence.MEDIUM,
            analysis_source=AnalysisSource.SEED,
        )

    def _bins(self):
        overview = build_teacher_overview(
            Class.objects.filter(id=self.kelas.id),
            Submission.objects.filter(assignment__class_ref=self.kelas),
        )
        return {item["level"]: item for item in overview[0]["bloom_distribution"]}

    def test_below_target_uses_each_assignment_target(self):
        bins = self._bins()
        self.assertEqual((bins[2]["count"], bins[2]["below_target"]), (1, 1))
        # L3 bercampur: di bawah target L4, tetapi memenuhi target L3.
        self.assertEqual((bins[3]["count"], bins[3]["below_target"]), (2, 1))
        self.assertEqual((bins[4]["count"], bins[4]["below_target"]), (1, 0))
        self.assertEqual((bins[5]["count"], bins[5]["below_target"]), (1, 0))

    def test_below_target_never_exceeds_count(self):
        for item in self._bins().values():
            self.assertLessEqual(item["below_target"], item["count"])
