from datetime import timedelta

from django.db import IntegrityError, transaction
from django.test import TestCase
from django.utils import timezone

from apps.academics.models import Assignment, Class, ClassMembership, Submission
from apps.accounts.models import EducationLevel, Profile, Role
from apps.cekpaham.models import (
    AttemptStatus,
    CekPaham,
    CekPahamAttempt,
    CekPahamReport,
    ReportReason,
    ReportStatus,
    RequestStatus,
)


class CekPahamModelTest(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.teacher = Profile.objects.create(
            email="dosen@test.local", display_name="Dosen", role=Role.TEACHER
        )
        student = Profile.objects.create(
            email="mhs@test.local", display_name="Mahasiswa", role=Role.STUDENT
        )
        kelas = Class.objects.create(
            owner=cls.teacher,
            name="Kelas A",
            subject="Algoritma",
            education_level=EducationLevel.S1,
            join_code="CP-0001",
        )
        ClassMembership.objects.create(class_ref=kelas, student_profile=student)
        assignment = Assignment.objects.create(
            class_ref=kelas, title="Tugas 1", instructions="Jelaskan.", expected_bloom_level=4
        )
        now = timezone.now()
        cls.submission = Submission.objects.create(
            assignment=assignment,
            student_profile=student,
            text_answer="Jawaban",
            started_at=now - timedelta(minutes=30),
            submitted_at=now,
            duration_seconds=1800,
        )

    def _request(self, **overrides) -> CekPaham:
        start = timezone.now()
        fields = {
            "submission": self.submission,
            "created_by": self.teacher,
            "question_text": "Mengapa kamu memilih pendekatan itu?",
            "language": "id",
            "answer_seconds": 45,
            "window_start": start,
            "window_end": start + timedelta(hours=2),
            **overrides,
        }
        return CekPaham.objects.create(**fields)

    def _fails(self, **overrides):
        with self.assertRaises(IntegrityError), transaction.atomic():
            self._request(**overrides)

    def test_window_must_end_after_it_starts(self):
        start = timezone.now()
        self._fails(window_start=start, window_end=start)

    def test_answer_seconds_stay_in_range(self):
        self._fails(answer_seconds=14)
        self._fails(answer_seconds=301)
        self._request(answer_seconds=15).delete()
        self._request(answer_seconds=300)

    def test_one_active_request_per_submission(self):
        first = self._request()
        self._fails()
        first.status = RequestStatus.CANCELLED
        first.save()
        self._request()  # setelah dibatalkan, boleh membuat lagi

    def _attempt(self, request, number, status=AttemptStatus.IN_PROGRESS):
        now = timezone.now()
        return CekPahamAttempt.objects.create(
            cekpaham=request,
            number=number,
            status=status,
            started_at=now,
            deadline_at=now + timedelta(seconds=45),
        )

    def test_attempt_number_is_unique_per_request(self):
        request = self._request()
        self._attempt(request, 1, AttemptStatus.VOIDED)
        with self.assertRaises(IntegrityError), transaction.atomic():
            self._attempt(request, 1, AttemptStatus.VOIDED)

    def test_only_one_unvoided_attempt_per_request(self):
        request = self._request()
        first = self._attempt(request, 1)
        with self.assertRaises(IntegrityError), transaction.atomic():
            self._attempt(request, 2)
        first.status = AttemptStatus.VOIDED
        first.save()
        self._attempt(request, 2)  # attempt baru baru boleh setelah yang lama di-void

    def test_attempt_score_cannot_exceed_100(self):
        attempt = self._attempt(self._request(), 1)
        attempt.ai_score = 101
        with self.assertRaises(IntegrityError), transaction.atomic():
            attempt.save()
        attempt.ai_score = None
        attempt.save()

    def test_report_resolution_matches_status(self):
        attempt = self._attempt(self._request(), 1)
        report = CekPahamReport.objects.create(attempt=attempt, reason=ReportReason.MIC_FAILURE)
        report.status = ReportStatus.DISMISSED  # tanpa resolved_at
        with self.assertRaises(IntegrityError), transaction.atomic():
            report.save()
        report.resolved_at = timezone.now()
        report.save()
