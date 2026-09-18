"""Tes bukti proses pengerjaan: revisi, tempelan, dan jejak pertumbuhan kata.

Tiga bug yang dijaga agar tidak kembali:

1. **Revisi menambah +7,5 poin ke setiap submit pertama.** Yang tersedia hanya
   jumlah tombol Simpan Revisi setelah jawaban dikumpulkan, dan submit pertama
   selalu bernilai nol, sehingga jawaban yang sama berbeda band hanya karena
   tombol yang ditekan. Revisi kini ditampilkan, tidak diskor.

2. **Tempelan tidak pernah terekam.** Form tidak mengirim apa pun, jadi
   seperempat sinyal proses selalu nol dan bukti "tidak ada tempelan" tertulis
   untuk jawaban yang tempelannya tidak pernah diamati.

3. **Simpan Revisi dan Analisis Ulang membuang jejak pertumbuhan kata.** Siasat
   tempel-lalu-tunggu yang sudah tertangkap kembali terbaca wajar.
"""
from __future__ import annotations

from datetime import timedelta
from unittest.mock import patch

from django.test import SimpleTestCase, TestCase
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
from academics.process_signals import ProcessContext, ProgressSample, evaluate_process
from core.authentication import create_access_token
from core.models import EducationLevel, Profile, Role

# Jawaban sekitar 150 kata. Isinya tidak penting untuk tes ini; yang diuji
# adalah bukti proses, yang memang tidak membaca teks.
ANSWER = " ".join(
    [
        "Ketimpangan antarwilayah muncul karena investasi menumpuk di kota besar.",
        "Akibatnya daerah tertinggal kekurangan lapangan kerja dan layanan dasar.",
        "Menurut saya kebijakan transfer fiskal perlu dikaitkan dengan kinerja layanan.",
        "Namun syarat kinerja bisa merugikan daerah yang kapasitasnya paling lemah.",
        "Karena itu pendampingan teknis sebaiknya diberikan sebelum target ditagih.",
    ]
    * 3
)


def _process_value(**overrides) -> tuple[float, str]:
    base = {
        "duration_seconds": 30 * 60,
        "revision_count": 0,
        "word_count": 300,
        "char_count": 2000,
        "paste_char_count": 0,
    }
    base.update(overrides)
    return evaluate_process(ProcessContext(**base))


class RevisionIsNotScoredTest(SimpleTestCase):
    def test_revision_count_does_not_move_the_value(self):
        """Esai yang sama tidak boleh berubah nilai hanya karena Simpan Revisi."""
        first, _ = _process_value(revision_count=0)
        revised, _ = _process_value(revision_count=3)
        self.assertEqual(first, revised)

    def test_patient_first_submission_scores_zero(self):
        """300 kata dalam 30 menit tanpa tempelan tidak menyumbang apa pun.

        Sebelumnya bernilai 0,30 hanya karena submit pertama selalu tanpa revisi.
        """
        value, _ = _process_value()
        self.assertEqual(value, 0.0)

    def test_revision_is_still_reported_to_the_lecturer(self):
        _, evidence = _process_value(revision_count=2)
        self.assertIn("direvisi 2 kali setelah dikumpulkan", evidence)
        self.assertIn("tidak diskor", evidence)

    def test_first_submission_does_not_claim_missing_revisions(self):
        _, evidence = _process_value(revision_count=0)
        self.assertNotIn("revisi", evidence.lower())


class PasteEvidenceTest(SimpleTestCase):
    def test_unrecorded_paste_is_not_reported_as_no_paste(self):
        value, evidence = _process_value(paste_recorded=False)
        self.assertEqual(value, 0.0)
        self.assertIn("tempelan tidak terekam", evidence)
        self.assertNotIn("tidak ada teks yang ditempel", evidence)

    def test_recorded_zero_paste_says_so(self):
        _, evidence = _process_value(paste_recorded=True)
        self.assertIn("tidak ada teks yang ditempel", evidence)

    def test_unrecorded_paste_never_dominates(self):
        """Revisi dari form lama pernah menghasilkan bukti yang bertentangan.

        Penanda rekaman mati sementara karakter tempelan sesi pertama masih
        tersimpan, sehingga bukti berbunyi "didominasi tempelan" berdampingan
        dengan "tempelan tidak terekam".
        """
        value, evidence = _process_value(paste_char_count=1200, paste_recorded=False)
        self.assertEqual(value, 0.0)
        self.assertNotIn("didominasi tempelan", evidence)

    def test_paste_dominated_answer_reaches_full_value(self):
        """Tempelan 100 persen kini mencapai 1,0, bukan tertahan revisi."""
        value, evidence = _process_value(paste_char_count=2000)
        self.assertEqual(value, 1.0)
        self.assertIn("didominasi tempelan", evidence)


class GrowthReplacesPaceTest(SimpleTestCase):
    def test_paste_then_wait_is_caught_by_the_curve(self):
        """400 kata dalam 20 menit terbaca wajar dari laju, tidak dari kurva."""
        burst = tuple(
            ProgressSample(offset_seconds=offset, word_count=words)
            for offset, words in ((0, 0), (30, 400), (60, 400), (90, 400), (1200, 400))
        )
        by_pace, _ = _process_value(duration_seconds=20 * 60, word_count=400)
        by_curve, evidence = _process_value(
            duration_seconds=20 * 60, word_count=400, progress=burst
        )
        self.assertEqual(by_pace, 0.0)
        self.assertGreater(by_curve, 0.6)
        self.assertIn("lonjakan", evidence)


class SubmissionProcessApiTest(TestCase):
    """Jalur API: rekam tempelan, lalu pertahankan bukti saat revisi dan analisis ulang."""

    def setUp(self):
        env = patch.dict("os.environ", {"GROQ_API_KEY": "", "WINSTON_API_KEY": ""})
        env.start()
        self.addCleanup(env.stop)

        self.teacher = Profile.objects.create(
            email="dosen@test.local", display_name="Dosen Uji", role=Role.TEACHER
        )
        self.student = Profile.objects.create(
            email="mhs@test.local", display_name="Mahasiswa Uji", role=Role.STUDENT
        )
        kelas = Class.objects.create(
            owner=self.teacher,
            name="Ekonomi Pembangunan B",
            subject="Ekonomi Pembangunan",
            education_level=EducationLevel.S1,
            program_studi="Ilmu Ekonomi",
            semester=3,
            join_code="EP-3B1XY",
        )
        ClassMembership.objects.create(class_ref=kelas, student_profile=self.student)
        self.assignment = Assignment.objects.create(
            class_ref=kelas,
            title="Ketimpangan antarwilayah",
            instructions="",
            deadline=timezone.now() + timedelta(days=7),
            expected_bloom_level=4,
        )

    def _client_for(self, profile: Profile) -> APIClient:
        client = APIClient()
        client.credentials(HTTP_AUTHORIZATION=f"Bearer {create_access_token(profile)}")
        return client

    def _submit(self, **extra):
        return self._client_for(self.student).post(
            f"/api/assignments/{self.assignment.id}/submissions",
            {"text_answer": ANSWER, **extra},
            format="json",
        )

    @staticmethod
    def _process_evidence(submission: Submission) -> str:
        submission.analysis.refresh_from_db()
        row = next(
            item
            for item in submission.analysis.signal_breakdown
            if item["key"] == "process_forensics"
        )
        return row["evidence"]

    def _burst_payload(self) -> dict:
        """Tempel seluruh jawaban di awal, lalu biarkan jendela terbuka."""
        started = timezone.now() - timedelta(minutes=20)
        offsets = (5, 35, 65, 95, 125)
        words = (0, 150, 150, 150, 150)
        return {
            "started_at": started.isoformat(),
            "progress": [
                {"at": (started + timedelta(seconds=o)).isoformat(), "word_count": w}
                for o, w in zip(offsets, words)
            ],
            "pastes": [],
        }

    def test_create_records_pastes_and_tracking_marker(self):
        started = timezone.now() - timedelta(minutes=10)
        response = self._submit(
            started_at=started.isoformat(),
            pastes=[{"at": (started + timedelta(minutes=1)).isoformat(), "char_count": 600}],
        )
        self.assertEqual(response.status_code, 201)
        submission = Submission.objects.get(pk=response.data["id"])

        pastes = submission.reasoning_events.filter(event_type=EventType.PASTE)
        self.assertEqual([event.payload["char_count"] for event in pastes], [600])
        start_event = submission.reasoning_events.get(event_type=EventType.STARTED)
        self.assertTrue(start_event.payload["paste_tracking"])
        self.assertIn("600 karakter ditempel", self._process_evidence(submission))

    def test_paste_outside_the_session_is_ignored(self):
        started = timezone.now() - timedelta(minutes=10)
        response = self._submit(
            started_at=started.isoformat(),
            pastes=[{"at": (started - timedelta(hours=1)).isoformat(), "char_count": 900}],
        )
        submission = Submission.objects.get(pk=response.data["id"])
        self.assertFalse(submission.reasoning_events.filter(event_type=EventType.PASTE).exists())

    def test_old_client_without_pastes_is_marked_untracked(self):
        response = self._submit(
            started_at=(timezone.now() - timedelta(minutes=10)).isoformat()
        )
        submission = Submission.objects.get(pk=response.data["id"])
        start_event = submission.reasoning_events.get(event_type=EventType.STARTED)
        self.assertFalse(start_event.payload["paste_tracking"])
        self.assertIn("tempelan tidak terekam", self._process_evidence(submission))

    def test_revision_keeps_the_growth_curve(self):
        response = self._submit(**self._burst_payload())
        submission = Submission.objects.get(pk=response.data["id"])
        self.assertIn("lonjakan", self._process_evidence(submission))

        revised = self._submit(
            text_answer=ANSWER + " Saya menambahkan satu kalimat penutup.",
            started_at=(timezone.now() - timedelta(minutes=1)).isoformat(),
            pastes=[],
        )
        self.assertEqual(revised.status_code, 201)
        submission.refresh_from_db()
        evidence = self._process_evidence(submission)
        self.assertEqual(submission.revision_count, 1)
        self.assertIn("lonjakan", evidence)
        self.assertIn("direvisi 1 kali", evidence)

    def test_revision_session_pastes_are_counted(self):
        response = self._submit(**self._burst_payload())
        submission = Submission.objects.get(pk=response.data["id"])

        opened = timezone.now() - timedelta(minutes=2)
        self._submit(
            text_answer=ANSWER + " Paragraf tambahan yang ditempel dari sumber lain.",
            started_at=opened.isoformat(),
            pastes=[{"at": (opened + timedelta(seconds=30)).isoformat(), "char_count": 350}],
        )
        self.assertEqual(
            submission.reasoning_events.filter(event_type=EventType.PASTE).count(), 1
        )
        self.assertIn("350 karakter ditempel", self._process_evidence(submission))

    def test_reanalysis_keeps_the_growth_curve(self):
        response = self._submit(**self._burst_payload())
        submission = Submission.objects.get(pk=response.data["id"])
        before = self._process_evidence(submission)

        reanalysed = self._client_for(self.teacher).post(
            f"/api/submissions/{submission.id}/reanalyze", format="json"
        )
        self.assertEqual(reanalysed.status_code, 200)
        after = next(
            item["evidence"]
            for item in reanalysed.data["analysis"]["signal_breakdown"]
            if item["key"] == "process_forensics"
        )
        self.assertIn("lonjakan", after)
        self.assertEqual(before, after)

    def test_untracked_revision_marks_pastes_untracked(self):
        """Satu sesi tanpa rekaman tempelan membuat seluruh jawaban tidak terekam."""
        response = self._submit(**self._burst_payload())
        submission = Submission.objects.get(pk=response.data["id"])
        self._submit(text_answer=ANSWER + " Revisi dari form lama tanpa rekaman.")

        revision = ReasoningEvent.objects.get(
            submission=submission, event_type=EventType.REVISION
        )
        self.assertFalse(revision.payload["paste_tracking"])
        self.assertIn("tempelan tidak terekam", self._process_evidence(submission))
