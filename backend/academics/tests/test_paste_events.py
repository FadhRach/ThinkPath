"""Tes deteksi paste nyata lewat SubmissionListView.post.

ReasoningEvent.PASTE dan seluruh matematikanya (_paste_value/
PASTE_DOMINATES_RATIO di process_signals.py, agregasi _paste_char_count di
views.py) sudah ada sejak lama tapi tidak pernah punya baris nyata untuk
dihitung - tidak ada endpoint yang menerimanya. Berkas ini adalah pengaman
regresi begitu jalur itu akhirnya terisi data sungguhan.

run_analysis di-mock di seluruh berkas ini supaya tes fokus menguji APA yang
dikirim ke process forensics (jumlah karakter tempelan, jendela waktu),
bukan bagaimana heuristik/LLM menilai teksnya - itu sudah diuji lengkap di
test_analysis_decoupling.py dan test_thresholds.py.
"""
from __future__ import annotations

from datetime import timedelta
from unittest.mock import patch

from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from academics.models import (
    Assignment,
    Class,
    ClassMembership,
    EventType,
    ReasoningEvent,
    Submission,
)
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
    """Menangkap ProcessContext yang benar-benar dikirim tiap panggilan."""

    def __init__(self):
        self.calls: list = []

    def __call__(self, text, education_level, expected_bloom_level, process=None):
        self.calls.append(process)
        return _fake_analysis()


class PasteEventTestCase(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.teacher = register_profile(
            email="dosen@kampus.test", password=PASSWORD,
            display_name="Dosen Uji", role=Role.TEACHER,
        )
        self.student = register_profile(
            email="mhs@kampus.test", password=PASSWORD,
            display_name="Mahasiswa Uji", role=Role.STUDENT,
        )
        self.kelas = Class.objects.create(
            owner=self.teacher, name="Kelas Uji", subject="Uji",
            education_level=EducationLevel.S1, join_code="UJI-0002",
        )
        ClassMembership.objects.create(class_ref=self.kelas, student_profile=self.student)
        self.assignment = Assignment.objects.create(
            class_ref=self.kelas, title="Tugas Uji", expected_bloom_level=3,
        )
        token = create_access_token(self.student)
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")

    def _submit(self, **extra):
        started_at = timezone.now() - timedelta(minutes=10)
        payload = {"text_answer": ANSWER, "started_at": started_at.isoformat(), **extra}
        return self.client.post(
            f"/api/assignments/{self.assignment.id}/submissions", payload, format="json"
        )

    def test_paste_events_create_real_reasoning_events(self):
        with patch("academics.views.run_analysis", side_effect=_RunAnalysisSpy()):
            response = self._submit(
                paste_events=[{"at": timezone.now().isoformat(), "char_count": 120}]
            )
        self.assertEqual(response.status_code, 201)

        submission = Submission.objects.get(id=response.data["id"])
        paste_rows = submission.reasoning_events.filter(event_type=EventType.PASTE)
        self.assertEqual(paste_rows.count(), 1)
        self.assertEqual(paste_rows.first().payload["char_count"], 120)

    def test_multiple_paste_events_are_aggregated(self):
        spy = _RunAnalysisSpy()
        with patch("academics.views.run_analysis", side_effect=spy):
            self._submit(
                paste_events=[
                    {"at": timezone.now().isoformat(), "char_count": 50},
                    {"at": timezone.now().isoformat(), "char_count": 70},
                ]
            )
        self.assertEqual(spy.calls[0].paste_char_count, 120)

    def test_paste_event_outside_work_window_is_dropped(self):
        far_future = (timezone.now() + timedelta(hours=1)).isoformat()
        spy = _RunAnalysisSpy()
        with patch("academics.views.run_analysis", side_effect=spy):
            response = self._submit(paste_events=[{"at": far_future, "char_count": 999}])
        self.assertEqual(response.status_code, 201)
        self.assertEqual(spy.calls[0].paste_char_count, 0)

        submission = Submission.objects.get(id=response.data["id"])
        self.assertEqual(
            submission.reasoning_events.filter(event_type=EventType.PASTE).count(), 0
        )

    def test_revision_paste_events_count_toward_that_same_revision(self):
        """Perbaikan urutan hitung: tempelan pada request revisi ini harus
        ikut memengaruhi analisis revisi ITU JUGA, bukan tertunda ke revisi
        berikutnya."""
        spy = _RunAnalysisSpy()
        with patch("academics.views.run_analysis", side_effect=spy):
            self._submit(paste_events=[{"at": timezone.now().isoformat(), "char_count": 30}])
            revise_response = self._submit(
                paste_events=[{"at": timezone.now().isoformat(), "char_count": 40}]
            )
        self.assertEqual(revise_response.status_code, 201)

        # Panggilan pertama (create): hanya 30. Panggilan kedua (revise):
        # akumulasi dari create (30, sudah tersimpan) + 40 baru pada request
        # ini = 70, dihitung SEBELUM baris barunya disimpan.
        self.assertEqual(spy.calls[0].paste_char_count, 30)
        self.assertEqual(spy.calls[1].paste_char_count, 70)

        submission = Submission.objects.get(id=revise_response.data["id"])
        self.assertEqual(
            submission.reasoning_events.filter(event_type=EventType.PASTE).count(), 2
        )

    def test_paste_dominant_answer_stops_trusting_pace(self):
        """Jalur end-to-end untuk PASTE_DOMINATES_RATIO - sebelumnya hanya
        diuji terhadap ProcessContext sintetis di test_analysis_decoupling.py,
        tidak pernah lewat request nyata."""
        spy = _RunAnalysisSpy()
        with patch("academics.views.run_analysis", side_effect=spy):
            self._submit(
                paste_events=[
                    {"at": timezone.now().isoformat(), "char_count": len(ANSWER)}
                ]
            )
        process = spy.calls[0]
        self.assertEqual(process.paste_char_count, len(ANSWER))
        self.assertGreaterEqual(process.paste_char_count / process.char_count, 0.5)
