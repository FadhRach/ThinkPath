"""Setiap analisis tersimpan permanen; hasil terkini hanya menunjuk yang terakhir."""
from __future__ import annotations

from datetime import timedelta
from unittest.mock import patch

from django.core.cache import cache
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from apps.academics.models import Assignment, Class, ClassMembership, Submission
from apps.accounts.authentication import create_access_token
from apps.accounts.models import ConsentAction, EducationLevel, Profile, Role
from apps.accounts.privacy import REQUIRED_ITEMS, record_consent
from apps.analysis.models import AnalysisResult, AnalysisRun, AnalysisTrigger

ANSWER = (
    "Ketimpangan antarwilayah muncul karena investasi menumpuk di Jawa, "
    "sementara infrastruktur di luar Jawa tertinggal sehingga biaya logistik tinggi."
)


def _client(profile):
    client = APIClient()
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {create_access_token(profile)}")
    return client


class AnalysisHistoryTest(TestCase):
    def setUp(self):
        cache.clear()
        env = patch.dict("os.environ", {"GROQ_API_KEY": "", "WINSTON_API_KEY": ""})
        env.start()
        self.addCleanup(env.stop)
        self.teacher = Profile.objects.create(email="d@test.local", role=Role.TEACHER)
        self.student = Profile.objects.create(email="m@test.local", role=Role.STUDENT)
        record_consent(self.student.id, ConsentAction.GIVEN, REQUIRED_ITEMS[Role.STUDENT])
        klass = Class.objects.create(
            owner=self.teacher, name="K", subject="E", education_level=EducationLevel.S1, join_code="AH-HIST1"
        )
        ClassMembership.objects.create(class_ref=klass, student_profile=self.student)
        self.assignment = Assignment.objects.create(
            class_ref=klass, title="T", expected_bloom_level=3, deadline=timezone.now() + timedelta(days=2)
        )

    def test_submit_revise_and_reanalyze_each_leave_a_row(self):
        student = _client(self.student)
        url = f"/api/assignments/{self.assignment.id}/submissions"
        self.assertEqual(student.post(url, {"text_answer": ANSWER}, format="json").status_code, 201)
        self.assertEqual(student.post(url, {"text_answer": ANSWER + " Tambahan."}, format="json").status_code, 201)
        submission = Submission.objects.get()
        self.assertEqual(_client(self.teacher).post(f"/api/submissions/{submission.id}/reanalyze").status_code, 202)

        runs = list(AnalysisRun.objects.filter(submission=submission).order_by("created_at"))
        self.assertEqual([r.trigger for r in runs], [AnalysisTrigger.SUBMIT, AnalysisTrigger.REVISE, AnalysisTrigger.REANALYZE])
        self.assertEqual(runs[2].requested_by, self.teacher)
        self.assertIsNone(runs[0].requested_by)
        self.assertEqual(AnalysisResult.objects.filter(submission=submission).count(), 1)
        self.assertEqual(AnalysisResult.objects.get().ai_score, runs[2].ai_score)
        self.assertNotEqual(runs[0].text_sha256, runs[1].text_sha256)
        self.assertIn("signal_breakdown", runs[0].payload)
        self.assertIn("word_count", runs[0].process_context)

    def test_teacher_sees_the_history_newest_first_without_payload(self):
        student = _client(self.student)
        student.post(f"/api/assignments/{self.assignment.id}/submissions", {"text_answer": ANSWER}, format="json")
        submission = Submission.objects.get()
        teacher = _client(self.teacher)
        teacher.post(f"/api/submissions/{submission.id}/reanalyze")
        detail = teacher.get(f"/api/submissions/{submission.id}").json()
        history = detail["analysis_history"]
        self.assertEqual([h["trigger"] for h in history], ["reanalyze", "submit"])
        self.assertNotIn("payload", history[0])
        self.assertIn("process_band", detail["analysis"])
