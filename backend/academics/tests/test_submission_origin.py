"""Tes perlakuan proses-forensik untuk submission yang berasal dari impor dokumen.

Keputusan produk yang dijaga: baseline impor tidak boleh terbaca sebagai
ledakan mengetik. Perbaikannya sengaja TIDAK menambah heuristik baru di
process_signals.py - ia memakai fallback netral yang sudah ada di sana
(duration_seconds=None -> _pace_value mengembalikan 0.5, "Durasi pengerjaan
tidak terekam"). Tes di sini membuktikan jalur document_import benar-benar
mendarat di fallback lama itu, bukan diam-diam membuat jalur baru.
"""
from __future__ import annotations

from datetime import timedelta
from unittest.mock import patch

from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from academics.models import Assignment, Class, ClassMembership, Submission, SubmissionOrigin
from academics.process_signals import evaluate_process
from academics.serializers import SubmissionDetailSerializer, StudentSubmissionStatusSerializer
from core.authentication import create_access_token
from core.models import EducationLevel, Role
from core.services import register_profile

ANSWER = "Jawaban ini sengaja dibuat cukup panjang untuk lolos validasi minimal lima puluh karakter."
PASSWORD = "rahasia123"


def _fake_analysis() -> dict:
    return {
        "ai_score": 20,
        "ai_band": "low",
        "bloom_level": 3,
        "confidence": "medium",
        "bloom_confidence": "medium",
        "signals": [],
        "signal_breakdown": [],
        "summary": "ringkasan",
        "recommendation": "rekomendasi",
        "analysis_source": "heuristic",
    }


class _RunAnalysisSpy:
    def __init__(self):
        self.calls: list = []

    def __call__(self, text, education_level, expected_bloom_level, process=None):
        self.calls.append(process)
        return _fake_analysis()


class SubmissionOriginTestCase(TestCase):
    def setUp(self):
        self.client = APIClient()
        teacher = register_profile(
            email="dosen@kampus.test", password=PASSWORD,
            display_name="Dosen Uji", role=Role.TEACHER,
        )
        self.student = register_profile(
            email="mhs@kampus.test", password=PASSWORD,
            display_name="Mahasiswa Uji", role=Role.STUDENT,
        )
        self.kelas = Class.objects.create(
            owner=teacher, name="Kelas Uji", subject="Uji",
            education_level=EducationLevel.S1, join_code="UJI-0003",
        )
        ClassMembership.objects.create(class_ref=self.kelas, student_profile=self.student)
        self.assignment = Assignment.objects.create(
            class_ref=self.kelas, title="Tugas Uji", expected_bloom_level=3,
        )
        token = create_access_token(self.student)
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")

    def _submit(self, **extra):
        started_at = timezone.now() - timedelta(seconds=5)
        payload = {"text_answer": ANSWER, "started_at": started_at.isoformat(), **extra}
        return self.client.post(
            f"/api/assignments/{self.assignment.id}/submissions", payload, format="json"
        )

    def test_document_import_stores_no_duration(self):
        spy = _RunAnalysisSpy()
        with patch("academics.views.run_analysis", side_effect=spy):
            response = self._submit(
                origin=SubmissionOrigin.DOCUMENT_IMPORT,
                import_metadata={
                    "filename": "tugas.pdf", "page_count": 1, "extraction_method": "pdf_text_layer",
                },
            )
        self.assertEqual(response.status_code, 201)

        submission = Submission.objects.get(id=response.data["id"])
        self.assertIsNone(submission.duration_seconds)
        self.assertEqual(submission.origin, SubmissionOrigin.DOCUMENT_IMPORT)
        self.assertEqual(spy.calls[0].duration_seconds, None)

    def test_progress_sent_alongside_import_is_ignored_server_side(self):
        """Pertahanan berlapis - klien yang tetap mengirim progress meski
        seharusnya menekannya tidak boleh dipercaya begitu saja."""
        spy = _RunAnalysisSpy()
        with patch("academics.views.run_analysis", side_effect=spy):
            self._submit(
                origin=SubmissionOrigin.DOCUMENT_IMPORT,
                progress=[
                    {"at": timezone.now().isoformat(), "word_count": 5},
                    {"at": timezone.now().isoformat(), "word_count": 50},
                ],
            )
        self.assertEqual(spy.calls[0].progress, ())

    def test_import_lands_on_the_existing_neutral_fallback(self):
        spy = _RunAnalysisSpy()
        with patch("academics.views.run_analysis", side_effect=spy):
            self._submit(origin=SubmissionOrigin.DOCUMENT_IMPORT)

        _, evidence = evaluate_process(spy.calls[0])
        self.assertIn("Durasi pengerjaan tidak terekam", evidence)

    def test_typed_submission_still_computes_real_duration(self):
        """Regresi: jalur mengetik biasa tidak boleh ikut jadi None."""
        spy = _RunAnalysisSpy()
        with patch("academics.views.run_analysis", side_effect=spy):
            self._submit()
        self.assertIsNotNone(spy.calls[0].duration_seconds)

    def test_revision_of_imported_submission_keeps_duration_none(self):
        spy = _RunAnalysisSpy()
        with patch("academics.views.run_analysis", side_effect=spy):
            self._submit(origin=SubmissionOrigin.DOCUMENT_IMPORT)
            revise_response = self._submit(text_answer=ANSWER + " Revisi manual sungguhan.")

        self.assertEqual(revise_response.status_code, 201)
        submission = Submission.objects.get(id=revise_response.data["id"])
        self.assertIsNone(submission.duration_seconds)
        self.assertEqual(submission.revision_count, 1)
        # duration_seconds diwarisi apa adanya, bukan dihitung ulang dari
        # started_at/submitted_at revisi ini.
        self.assertEqual(spy.calls[1].duration_seconds, None)

    def test_new_fields_appear_in_student_and_teacher_serializers(self):
        with patch("academics.views.run_analysis", side_effect=_RunAnalysisSpy()):
            response = self._submit(
                rich_content={"type": "doc", "content": []},
                origin=SubmissionOrigin.DOCUMENT_IMPORT,
                import_metadata={
                    "filename": "tugas.pdf", "page_count": 1, "extraction_method": "pdf_text_layer",
                },
            )
        submission = Submission.objects.get(id=response.data["id"])

        student_data = StudentSubmissionStatusSerializer(submission).data
        self.assertIn("rich_content", student_data)
        self.assertEqual(student_data["origin"], SubmissionOrigin.DOCUMENT_IMPORT)
        self.assertEqual(student_data["import_metadata"]["filename"], "tugas.pdf")

        teacher_data = SubmissionDetailSerializer(submission).data
        self.assertIn("rich_content", teacher_data)
        self.assertEqual(teacher_data["origin"], SubmissionOrigin.DOCUMENT_IMPORT)
