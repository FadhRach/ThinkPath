"""Penjaga biaya: batas panjang jawaban dan throttle pada endpoint yang memicu API berbayar."""
from __future__ import annotations

from datetime import timedelta
from unittest.mock import patch

from django.core.cache import cache
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from apps.academics.models import Assignment, Class, ClassMembership
from apps.accounts.authentication import create_access_token
from apps.accounts.models import ConsentAction, EducationLevel, Profile, Role
from apps.accounts.privacy import REQUIRED_ITEMS, record_consent

ANSWER = (
    "Ketimpangan antarwilayah muncul karena investasi menumpuk di Jawa, "
    "sementara infrastruktur di luar Jawa tertinggal sehingga biaya logistik tinggi."
)


def _client(profile: Profile) -> APIClient:
    client = APIClient()
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {create_access_token(profile)}")
    return client


class CostGuardBase(TestCase):
    def setUp(self):
        cache.clear()
        env = patch.dict("os.environ", {"GROQ_API_KEY": "", "WINSTON_API_KEY": ""})
        env.start()
        self.addCleanup(env.stop)
        self.teacher = Profile.objects.create(email="d@test.local", role=Role.TEACHER)
        self.student = Profile.objects.create(email="m@test.local", role=Role.STUDENT)
        record_consent(self.student.id, ConsentAction.GIVEN, REQUIRED_ITEMS[Role.STUDENT])
        self.klass = Class.objects.create(
            owner=self.teacher, name="Kelas", subject="Ekonomi",
            education_level=EducationLevel.S1, join_code="KD-COST1",
        )
        ClassMembership.objects.create(class_ref=self.klass, student_profile=self.student)
        self.assignment = Assignment.objects.create(
            class_ref=self.klass, title="Tugas", expected_bloom_level=3,
            deadline=timezone.now() + timedelta(days=3),
        )

    def _submit(self, text=ANSWER):
        return _client(self.student).post(
            f"/api/assignments/{self.assignment.id}/submissions", {"text_answer": text}, format="json"
        )


class CostGuardTest(CostGuardBase):
    def test_answer_over_the_cap_is_refused(self):
        self.assertEqual(self._submit("a " * 10_001).status_code, 400)
        self.assertEqual(self._submit(("aaaa " * 4_000).strip()).status_code, 201)

    def test_submit_is_throttled_per_student(self):
        codes = [self._submit(f"{ANSWER} versi {i}").status_code for i in range(11)]
        self.assertEqual(codes[:10], [201] + [201] * 9)
        self.assertEqual(codes[10], 429)

    def test_reanalyze_is_throttled_per_teacher(self):
        self.assertEqual(self._submit().status_code, 201)
        from apps.academics.models import Submission

        submission = Submission.objects.get()
        teacher = _client(self.teacher)
        codes = [teacher.post(f"/api/submissions/{submission.id}/reanalyze").status_code for _ in range(21)]
        self.assertEqual(codes[:20], [202] * 20)
        self.assertEqual(codes[20], 429)

    def test_join_code_guessing_is_throttled(self):
        outsider = Profile.objects.create(email="x@test.local", role=Role.STUDENT)
        client = _client(outsider)
        codes = [client.post("/api/join", {"join_code": f"SALAH-{i:02d}"}, format="json").status_code for i in range(11)]
        self.assertEqual(codes[:10], [404] * 10)
        self.assertEqual(codes[10], 429)


class QueueAndHeadersTest(CostGuardBase):
    """Antrean dosen dibatasi, DOCX berbahaya ditolak, dan API tidak boleh di-cache."""

    def test_queue_is_capped_and_reports_the_real_total(self):
        from apps.academics.models import Submission

        for i in range(3):
            student = Profile.objects.create(email=f"s{i}@test.local", role=Role.STUDENT)
            Submission.objects.create(
                assignment=self.assignment, student_profile=student, text_answer="x",
                started_at=timezone.now(), submitted_at=timezone.now(),
            )
        teacher = _client(self.teacher)
        response = teacher.get("/api/submissions?limit=2")
        self.assertEqual(len(response.json()), 2)
        self.assertEqual(response["X-Total-Count"], "3")
        self.assertEqual(len(teacher.get("/api/submissions?limit=2&offset=2").json()), 1)
        self.assertEqual(len(teacher.get("/api/submissions?limit=abc").json()), 3)

    def test_api_responses_are_not_cacheable(self):
        self.assertEqual(_client(self.teacher).get("/api/classes")["Cache-Control"], "no-store")

    def test_docx_with_a_doctype_is_refused(self):
        import io
        import zipfile

        from rest_framework.exceptions import ValidationError

        from apps.academics.services.documents import extract

        buffer = io.BytesIO()
        with zipfile.ZipFile(buffer, "w") as archive:
            archive.writestr(
                "word/document.xml",
                '<?xml version="1.0"?><!DOCTYPE d [<!ENTITY a "aaaa">]><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"/>',
            )
        with self.assertRaises(ValidationError):
            extract(buffer.getvalue(), "docx", allow_external=False)
