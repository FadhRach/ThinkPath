"""Tes verifikasi verbal.

Yang dijaga di sini bukan sekadar CRUD, melainkan dua keputusan produk yang
mudah tergerus saat kode berkembang:

1. **Kesimpulan hanya boleh diisi setelah sesi berlangsung.** Kalau dosen bisa
   mengisi kesimpulan pada sesi yang baru dijadwalkan, ia menyimpulkan sebelum
   berbicara, yang justru kebalikan dari tujuan fitur ini.

2. **Tidak ada pilihan yang berbunyi "terbukti menyontek".** Sistem ini tidak
   pernah menyimpulkan kecurangan. Yang dinilai adalah apakah mahasiswa mampu
   menjelaskan kembali karyanya.
"""
from __future__ import annotations

from datetime import timedelta

from django.test import TestCase
from django.utils import timezone

from academics.models import (
    Assignment,
    Class,
    Submission,
    VerbalVerification,
    VerificationOutcome,
    VerificationStatus,
)
from academics.serializers import VerificationWriteSerializer
from core.models import EducationLevel, Profile, Role


class OutcomeVocabularyTest(TestCase):
    """Pilihan kesimpulan adalah keputusan produk, bukan detail teknis."""

    def test_no_outcome_accuses_of_cheating(self):
        labels = " ".join(
            f"{value} {label}" for value, label in VerificationOutcome.choices
        ).lower()
        for forbidden in ("curang", "contek", "plagiat", "cheat", "terbukti"):
            self.assertNotIn(forbidden, labels)

    def test_outcomes_are_about_explaining(self):
        values = set(VerificationOutcome.values)
        self.assertEqual(
            values,
            {"can_explain", "partial", "cannot_explain", "inconclusive"},
        )


class WriteValidationTest(TestCase):
    def test_completed_requires_an_outcome(self):
        serializer = VerificationWriteSerializer(
            data={"status": VerificationStatus.COMPLETED}
        )
        self.assertFalse(serializer.is_valid())
        self.assertIn("outcome", serializer.errors)

    def test_scheduled_cannot_carry_an_outcome(self):
        """Menyimpulkan sebelum berbicara adalah kebalikan tujuan fitur ini."""
        serializer = VerificationWriteSerializer(
            data={
                "status": VerificationStatus.SCHEDULED,
                "scheduled_at": timezone.now(),
                "outcome": VerificationOutcome.CAN_EXPLAIN,
            }
        )
        self.assertFalse(serializer.is_valid())
        self.assertIn("outcome", serializer.errors)

    def test_scheduled_requires_a_time(self):
        serializer = VerificationWriteSerializer(
            data={"status": VerificationStatus.SCHEDULED}
        )
        self.assertFalse(serializer.is_valid())
        self.assertIn("scheduled_at", serializer.errors)

    def test_valid_schedule_passes(self):
        serializer = VerificationWriteSerializer(
            data={
                "status": VerificationStatus.SCHEDULED,
                "scheduled_at": timezone.now() + timedelta(days=1),
                "notes": "Tanya soal bagian metodologi.",
            }
        )
        self.assertTrue(serializer.is_valid(), serializer.errors)

    def test_valid_completion_passes(self):
        serializer = VerificationWriteSerializer(
            data={
                "status": VerificationStatus.COMPLETED,
                "outcome": VerificationOutcome.PARTIAL,
                "notes": "Paham kerangkanya, tidak bisa menjelaskan pilihan datanya.",
            }
        )
        self.assertTrue(serializer.is_valid(), serializer.errors)


class ScoreIsolationTest(TestCase):
    """Hasil verifikasi tidak boleh mengubah skor AI.

    Kalau skor disesuaikan berdasarkan hasil percakapan, skor yang keliru akan
    membenarkan dirinya sendiri: dosen curiga karena skor tinggi, lalu hasil
    percakapan dipakai menguatkan skor itu.
    """

    def test_verification_module_never_touches_analysis_score(self):
        import inspect
        from pathlib import Path

        source = Path(inspect.getfile(VerbalVerification)).read_text(encoding="utf-8")
        start = source.index("class VerbalVerification")
        end = source.index("class AnalysisResult")
        body = source[start:end]
        for forbidden in ("ai_score", "ai_band", "bloom_level"):
            self.assertNotIn(forbidden, body)


class VerificationLifecycleTest(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.teacher = Profile.objects.create(
            email="dosen@test.local", display_name="Dosen", role=Role.TEACHER
        )
        cls.student = Profile.objects.create(
            email="mhs@test.local", display_name="Mahasiswa", role=Role.STUDENT
        )
        kelas = Class.objects.create(
            owner=cls.teacher,
            name="Metpen",
            subject="Metpen",
            education_level=EducationLevel.S1,
            program_studi="Sistem Informasi",
            semester=5,
            join_code="MP-1234",
        )
        assignment = Assignment.objects.create(
            class_ref=kelas,
            title="Tugas",
            instructions="",
            deadline=timezone.now() + timedelta(days=3),
            expected_bloom_level=4,
        )
        now = timezone.now()
        cls.submission = Submission.objects.create(
            assignment=assignment,
            student_profile=cls.student,
            text_answer="teks",
            started_at=now - timedelta(minutes=30),
            submitted_at=now,
            duration_seconds=1800,
        )

    def test_one_verification_per_submission(self):
        VerbalVerification.objects.create(
            submission=self.submission, status=VerificationStatus.SCHEDULED
        )
        # OneToOne: menjadwalkan ulang memperbarui baris yang sama, bukan
        # menumpuk riwayat yang membingungkan di antrean.
        obj, created = VerbalVerification.objects.update_or_create(
            submission=self.submission,
            defaults={"status": VerificationStatus.CANCELLED},
        )
        self.assertFalse(created)
        self.assertEqual(VerbalVerification.objects.count(), 1)
        self.assertEqual(obj.status, VerificationStatus.CANCELLED)

    def test_deleting_submission_removes_verification(self):
        VerbalVerification.objects.create(submission=self.submission)
        self.submission.delete()
        self.assertEqual(VerbalVerification.objects.count(), 0)
