"""Integritas data submission saat permintaan saling balapan, dan constraint DB.

Constraint di basis data adalah penjaga terakhir: validasi serializer bisa
dilewati oleh dua permintaan yang tiba bersamaan atau oleh skrip/seed.
"""
from __future__ import annotations

from datetime import timedelta
from unittest.mock import patch

from django.db import IntegrityError, transaction
from django.test import TestCase
from django.utils import timezone
from rest_framework.exceptions import ValidationError
from rest_framework.test import APIClient

from apps.academics.models import (
    Assignment,
    Class,
    ClassMembership,
    Submission,
    SubmissionStatus,
)
from apps.academics.services import submissions as submission_service
from apps.accounts.authentication import create_access_token
from apps.accounts.models import ConsentAction, EducationLevel, Profile, Role
from apps.accounts.privacy import REQUIRED_ITEMS, record_consent

ANSWER = (
    "Ketimpangan antarwilayah muncul karena investasi menumpuk di Jawa, "
    "sementara infrastruktur di luar Jawa tertinggal sehingga biaya logistik tinggi."
)


class SubmissionRaceTest(TestCase):
    def setUp(self):
        env = patch.dict("os.environ", {"GROQ_API_KEY": "", "WINSTON_API_KEY": ""})
        env.start()
        self.addCleanup(env.stop)

        teacher = Profile.objects.create(email="dosen@test.local", role=Role.TEACHER)
        self.student = Profile.objects.create(email="mhs@test.local", role=Role.STUDENT)
        kelas = Class.objects.create(
            owner=teacher,
            name="Ekonomi Pembangunan",
            subject="Ekonomi",
            education_level=EducationLevel.S1,
            join_code="EP-RACE1",
        )
        ClassMembership.objects.create(class_ref=kelas, student_profile=self.student)
        record_consent(self.student.id, ConsentAction.GIVEN, REQUIRED_ITEMS[Role.STUDENT])
        self.assignment = Assignment.objects.create(
            class_ref=kelas,
            title="Ketimpangan",
            deadline=timezone.now() + timedelta(days=7),
            expected_bloom_level=4,
        )

    def _post(self):
        client = APIClient()
        client.credentials(HTTP_AUTHORIZATION=f"Bearer {create_access_token(self.student)}")
        return client.post(
            f"/api/assignments/{self.assignment.id}/submissions",
            {"text_answer": ANSWER},
            format="json",
        )

    def test_double_first_submit_returns_400_not_500(self):
        """Klik ganda: permintaan kedua sama-sama mengira belum ada jawaban."""
        self.assertEqual(self._post().status_code, 201)
        with patch.object(submission_service.Submission.objects, "filter") as lookup:
            lookup.return_value.first.return_value = None
            response = self._post()
        self.assertEqual(response.status_code, 400)
        self.assertEqual(Submission.objects.count(), 1)

    def test_revision_rejected_when_graded_meanwhile(self):
        """Dosen menilai selagi analisis revisi masih berjalan."""
        self.assertEqual(self._post().status_code, 201)
        submission = Submission.objects.get()
        real_verified = submission_service.verified_source

        def grade_meanwhile(*args, **kwargs):
            # Dosen menilai setelah pemeriksaan awal, sebelum baris dikunci.
            Submission.objects.filter(pk=submission.pk).update(
                status=SubmissionStatus.REVIEWED, grade=80
            )
            return real_verified(*args, **kwargs)

        with patch.object(submission_service, "verified_source", side_effect=grade_meanwhile):
            response = self._post()
        self.assertEqual(response.status_code, 400)
        submission.refresh_from_db()
        self.assertEqual(submission.revision_count, 0)
        self.assertEqual(submission.grade, 80)

    def test_sequential_resubmit_is_revision(self):
        self.assertEqual(self._post().status_code, 201)
        self.assertEqual(self._post().status_code, 201)
        submission = Submission.objects.get()
        self.assertEqual(submission.revision_count, 1)

    def test_create_service_rejects_duplicate(self):
        self.assertEqual(self._post().status_code, 201)
        with self.assertRaises(ValidationError):
            submission_service._create(
                self.assignment, self.student, {"text_answer": ANSWER}
            )


class DatabaseConstraintTest(TestCase):
    @classmethod
    def setUpTestData(cls):
        teacher = Profile.objects.create(email="dosen@test.local", role=Role.TEACHER)
        cls.student = Profile.objects.create(email="mhs@test.local", role=Role.STUDENT)
        cls.kelas = Class.objects.create(
            owner=teacher,
            name="Metpen",
            subject="Metpen",
            education_level=EducationLevel.S1,
            join_code="MP-CHK1",
        )
        cls.assignment = Assignment.objects.create(
            class_ref=cls.kelas, title="Tugas", expected_bloom_level=3
        )

    def _submission(self, **extra):
        return Submission.objects.create(
            assignment=self.assignment,
            student_profile=self.student,
            started_at=timezone.now(),
            **extra,
        )

    def assertRejected(self, create):
        with self.assertRaises(IntegrityError), transaction.atomic():
            create()

    def test_grade_out_of_range(self):
        self.assertRejected(lambda: self._submission(grade=101))

    def test_negative_revision_count(self):
        self.assertRejected(lambda: self._submission(revision_count=-1))

    def test_bloom_target_out_of_range(self):
        self.assertRejected(
            lambda: Assignment.objects.create(
                class_ref=self.kelas, title="x", expected_bloom_level=7
            )
        )

    def test_semester_out_of_range(self):
        self.kelas.semester = 15
        self.assertRejected(self.kelas.save)
