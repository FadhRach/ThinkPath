"""Tes bukti proses pengerjaan: revisi, tindakan menempel, dan jejak pertumbuhan kata.

Keputusan yang dijaga agar tidak kembali:

1. **Revisi tidak diskor.** Yang tersedia hanya jumlah tombol Simpan Revisi
   setelah jawaban dikumpulkan, dan submit pertama selalu bernilai nol,
   sehingga dulu jawaban yang sama berbeda band hanya karena tombol yang
   ditekan (+7,5 poin). Revisi kini ditampilkan, tidak diskor.

2. **Tindakan menempel tidak direkam maupun diskor.** Mahasiswa wajar menempel
   kutipan dari artikel yang ia rujuk. Kolom tempelan yang masih dikirim klien
   lama diabaikan.

3. **Simpan Revisi dan Analisis Ulang memakai ulang jejak pertumbuhan kata.**
   Dulu keduanya membuangnya, sehingga siasat tempel-lalu-tunggu yang sudah
   tertangkap kembali terbaca wajar.
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
    Submission,
)
from academics.process_signals import ProcessContext, ProgressSample, evaluate_process
from core.authentication import create_access_token
from core.models import ConsentAction, EducationLevel, Profile, Role
from core.privacy import REQUIRED_ITEMS, record_consent

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
    }
    base.update(overrides)
    return evaluate_process(ProcessContext(**base))


def _gradual(total_words: int, minutes: int) -> list[tuple[int, int]]:
    """Cuplikan tiap 30 detik untuk menulis bertahap dari nol."""
    steps = minutes * 2
    return [(step * 30, round(total_words * step / steps)) for step in range(steps + 1)]


class RevisionIsNotScoredTest(SimpleTestCase):
    def test_revision_count_does_not_move_the_value(self):
        """Esai yang sama tidak boleh berubah nilai hanya karena Simpan Revisi."""
        first, _ = _process_value(revision_count=0)
        revised, _ = _process_value(revision_count=3)
        self.assertEqual(first, revised)

    def test_patient_first_submission_scores_zero(self):
        """300 kata dalam 30 menit tidak menyumbang apa pun.

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


class PasteIsNotMeasuredTest(SimpleTestCase):
    def test_evidence_never_talks_about_pasting(self):
        _, evidence = _process_value()
        self.assertNotIn("tempel", evidence.lower())

    def test_quote_sized_burst_moves_the_value_proportionally(self):
        """Satu kutipan 60 kata di tengah esai 400 kata hanya bergeser sedikit.

        Kurva tetap melihat lonjakan, tetapi sumbangannya sebanding porsinya.
        Seluruh jawaban yang muncul sekaligus tetap bernilai penuh.
        """
        typed = _gradual(340, 30)
        quote_at = len(typed) // 2
        with_quote = tuple(
            ProgressSample(offset, words + (60 if index >= quote_at else 0))
            for index, (offset, words) in enumerate(typed)
        )
        value, evidence = _process_value(word_count=400, progress=with_quote)
        # Selang yang memuat kutipan juga membawa beberapa kata yang diketik,
        # jadi porsinya sedikit di atas 60/400.
        self.assertGreater(value, 0.1)
        self.assertLess(value, 0.2)
        self.assertIn("satu lonjakan", evidence)

        whole = tuple(
            ProgressSample(offset, 0 if offset == 0 else 400)
            for offset, _ in typed
        )
        full, _ = _process_value(word_count=400, progress=whole)
        self.assertEqual(full, 1.0)


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
        self.assertEqual(by_curve, 1.0)
        self.assertIn("lonjakan", evidence)


class SubmissionProcessApiTest(TestCase):
    """Jalur API: kolom tempelan diabaikan, jejak kurva bertahan saat revisi."""

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
        # Mengumpulkan jawaban mensyaratkan persetujuan Kebijakan Privasi.
        record_consent(
            self.student.id, ConsentAction.GIVEN, REQUIRED_ITEMS[Role.STUDENT]
        )
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
        """Seluruh jawaban muncul sekaligus di awal, lalu jendela dibiarkan terbuka."""
        started = timezone.now() - timedelta(minutes=20)
        offsets = (5, 35, 65, 95, 125)
        words = (0, 150, 150, 150, 150)
        return {
            "started_at": started.isoformat(),
            "progress": [
                {"at": (started + timedelta(seconds=o)).isoformat(), "word_count": w}
                for o, w in zip(offsets, words)
            ],
        }

    def test_pastes_sent_by_an_old_client_are_ignored(self):
        """Frontend dan backend di-deploy terpisah; form lama masih mengirim kolom ini."""
        started = timezone.now() - timedelta(minutes=10)
        response = self._submit(
            started_at=started.isoformat(),
            pastes=[{"at": (started + timedelta(minutes=1)).isoformat(), "char_count": 600}],
        )
        self.assertEqual(response.status_code, 201)
        submission = Submission.objects.get(pk=response.data["id"])
        self.assertFalse(
            submission.reasoning_events.filter(event_type=EventType.PASTE).exists()
        )
        self.assertNotIn("tempel", self._process_evidence(submission).lower())

    def test_revision_keeps_the_growth_curve(self):
        response = self._submit(**self._burst_payload())
        submission = Submission.objects.get(pk=response.data["id"])
        self.assertIn("lonjakan", self._process_evidence(submission))

        revised = self._submit(text_answer=ANSWER + " Saya menambahkan satu kalimat penutup.")
        self.assertEqual(revised.status_code, 201)
        submission.refresh_from_db()
        evidence = self._process_evidence(submission)
        self.assertEqual(submission.revision_count, 1)
        self.assertIn("lonjakan", evidence)
        self.assertIn("direvisi 1 kali", evidence)

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
