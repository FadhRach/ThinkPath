"""H1: bukti proses dicatat server dari draf, dan baru dimulai saat mahasiswa menulis."""
from __future__ import annotations

from datetime import timedelta
from unittest.mock import patch

from django.core.cache import cache
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from apps.academics.models import Assignment, Class, ClassMembership, Submission, SubmissionDraft
from apps.academics.services.drafts import MAX_SAMPLES
from apps.accounts.authentication import create_access_token
from apps.accounts.models import ConsentAction, EducationLevel, Profile, Role
from apps.accounts.privacy import REQUIRED_ITEMS, record_consent

NOW_PATH = "apps.academics.services.drafts.timezone.now"
WORDS = "ketimpangan antarwilayah muncul karena investasi menumpuk di kota besar sementara "


def words(n: int) -> str:
    return " ".join((WORDS * (n // 8 + 1)).split()[:n])


def _client(profile):
    client = APIClient()
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {create_access_token(profile)}")
    return client


class DraftBase(TestCase):
    def setUp(self):
        cache.clear()
        env = patch.dict("os.environ", {"GROQ_API_KEY": "", "WINSTON_API_KEY": ""})
        env.start()
        self.addCleanup(env.stop)
        self.teacher = Profile.objects.create(email="d@test.local", role=Role.TEACHER)
        self.student = Profile.objects.create(email="m@test.local", role=Role.STUDENT)
        record_consent(self.student.id, ConsentAction.GIVEN, REQUIRED_ITEMS[Role.STUDENT])
        self.klass = Class.objects.create(
            owner=self.teacher, name="K", subject="E", education_level=EducationLevel.S1, join_code="DR-AFT01"
        )
        ClassMembership.objects.create(class_ref=self.klass, student_profile=self.student)
        self.assignment = Assignment.objects.create(
            class_ref=self.klass, title="T", expected_bloom_level=3, deadline=timezone.now() + timedelta(days=2)
        )
        self.client_s = _client(self.student)
        self.url = f"/api/assignments/{self.assignment.id}/draft"

    def put(self, text, at=None, **extra):
        body = {"text_answer": text, **extra}
        if at is None:
            return self.client_s.put(self.url, body, format="json")
        with patch(NOW_PATH, return_value=at):
            return self.client_s.put(self.url, body, format="json")


class StartTriggerTest(DraftBase):
    def test_opening_the_assignment_does_not_start_the_clock(self):
        response = self.client_s.get(f"/api/student/assignments/{self.assignment.id}")
        self.assertEqual(response.status_code, 200)
        self.assertIsNone(response.json()["draft"])
        self.assertFalse(SubmissionDraft.objects.exists())

    def test_empty_or_blank_text_does_not_start_either(self):
        for text in ("", "   \n  "):
            self.assertEqual(self.put(text).json(), {"started": False, "saved_at": None})
        self.assertFalse(SubmissionDraft.objects.exists())

    def test_first_text_starts_the_clock_at_server_time(self):
        t0 = timezone.now() - timedelta(minutes=3)
        response = self.put("Halo dunia ini awal", at=t0)
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.json()["started"])
        draft = SubmissionDraft.objects.get()
        self.assertEqual(draft.started_at, t0)
        self.assertEqual(draft.samples, [{"t": 0, "w": 4}])

    def test_word_counts_come_from_the_text_not_the_client(self):
        t0 = timezone.now() - timedelta(minutes=3)
        self.put("satu dua tiga", at=t0, word_count=9999, started_at="2020-01-01T00:00:00Z")
        draft = SubmissionDraft.objects.get()
        self.assertEqual(draft.samples[0]["w"], 3)
        self.assertEqual(draft.started_at, t0)

    def test_state_is_restored_for_the_form(self):
        self.put("tulisan yang belum dikumpulkan")
        detail = self.client_s.get(f"/api/student/assignments/{self.assignment.id}").json()
        self.assertEqual(detail["draft"]["text_answer"], "tulisan yang belum dikumpulkan")


class SamplingTest(DraftBase):
    def test_samples_are_at_least_thirty_seconds_apart_but_text_is_always_saved(self):
        """Kebijakan Privasi menjanjikan jumlah kata tiap 30 detik, tidak lebih rapat."""
        t0 = timezone.now() - timedelta(minutes=5)
        self.put(words(5), at=t0)
        self.put(words(8), at=t0 + timedelta(seconds=5))
        self.put(words(12), at=t0 + timedelta(seconds=25))
        draft = SubmissionDraft.objects.get()
        self.assertEqual(len(draft.samples), 1)
        self.assertEqual(draft.text_answer, words(12))
        self.put(words(20), at=t0 + timedelta(seconds=31))
        draft.refresh_from_db()
        self.assertEqual(draft.samples[-1], {"t": 31, "w": 20})

    def test_unchanged_text_adds_nothing(self):
        t0 = timezone.now() - timedelta(minutes=5)
        self.put(words(5), at=t0)
        self.put(words(5), at=t0 + timedelta(seconds=60))
        self.assertEqual(len(SubmissionDraft.objects.get().samples), 1)

    def test_samples_are_capped(self):
        t0 = timezone.now() - timedelta(hours=5)
        for i in range(MAX_SAMPLES + 10):
            cache.clear()  # lewati throttle 30/menit; yang diuji batas cuplikan
            with patch("apps.academics.services.drafts.SAMPLE_INTERVAL_SECONDS", 1):
                self.put(words(5) + f" x{i}", at=t0 + timedelta(seconds=i * 2))
        self.assertEqual(len(SubmissionDraft.objects.get().samples), MAX_SAMPLES)


class GuardsTest(DraftBase):
    def test_not_allowed_after_deadline(self):
        Assignment.objects.filter(pk=self.assignment.pk).update(deadline=timezone.now() - timedelta(minutes=1))
        self.assertEqual(self.put("terlambat").status_code, 400)

    def test_needs_consent(self):
        record_consent(self.student.id, ConsentAction.WITHDRAWN, [])
        self.assertEqual(self.put("tanpa persetujuan").status_code, 403)

    def test_outsider_and_teacher_are_refused(self):
        outsider = Profile.objects.create(email="x@test.local", role=Role.STUDENT)
        record_consent(outsider.id, ConsentAction.GIVEN, REQUIRED_ITEMS[Role.STUDENT])
        self.assertIn(_client(outsider).put(self.url, {"text_answer": "a"}, format="json").status_code, (403, 404))
        self.assertEqual(_client(self.teacher).put(self.url, {"text_answer": "a"}, format="json").status_code, 403)

    def test_text_over_the_cap_is_refused(self):
        self.assertEqual(self.put("a" * 20_001).status_code, 400)

    def test_autosave_is_throttled(self):
        codes = [self.put(f"tulisan {i}").status_code for i in range(31)]
        self.assertEqual(codes[:30], [200] * 30)
        self.assertEqual(codes[30], 429)

    def test_draft_is_refused_once_the_answer_is_submitted(self):
        self.client_s.post(
            f"/api/assignments/{self.assignment.id}/submissions", {"text_answer": words(60)}, format="json"
        )
        self.assertEqual(self.put("revisi lewat draf").status_code, 400)


class SubmitUsesTheDraftTest(DraftBase):
    def _type_gradually(self, minutes=12):
        t0 = timezone.now() - timedelta(minutes=minutes)
        # Satu simpan per jarak cuplikan server (30 detik), ±21 kata per menit.
        for i in range(minutes * 2):
            self.put(words(min(i * 10 + 5, 200)), at=t0 + timedelta(seconds=i * 30))

    def submit(self, text=None, **extra):
        return self.client_s.post(
            f"/api/assignments/{self.assignment.id}/submissions",
            {"text_answer": text or words(200), **extra},
            format="json",
        )

    def test_gradual_typing_reads_as_normal_and_the_draft_is_removed(self):
        self._type_gradually()
        response = self.submit()
        self.assertEqual(response.status_code, 201, response.content)
        submission = Submission.objects.get()
        self.assertEqual(submission.analysis.process_band, "normal")
        self.assertGreater(submission.duration_seconds, 600)
        self.assertFalse(SubmissionDraft.objects.exists())
        kinds = list(submission.reasoning_events.values_list("event_type", flat=True))
        self.assertEqual(kinds.count("started"), 1)
        self.assertGreaterEqual(kinds.count("progress"), 10)

    def test_text_that_grew_after_the_last_save_is_still_seen(self):
        t0 = timezone.now() - timedelta(minutes=10)
        self.put(words(10), at=t0)
        for i in range(1, 8):
            self.put(words(10 + i), at=t0 + timedelta(seconds=i * 25))
        self.submit(words(300))
        events = Submission.objects.get().reasoning_events.filter(event_type="progress").order_by("-occurred_at")
        self.assertEqual(events.first().payload["word_count"], 300)

    def test_submitting_without_ever_writing_is_a_measured_burst(self):
        self.submit(words(150))
        submission = Submission.objects.get()
        self.assertEqual(submission.duration_seconds, 0)
        self.assertEqual(submission.analysis.process_band, "attention")

    def test_swapping_the_whole_text_in_a_revision_is_seen(self):
        self._type_gradually()
        self.submit()
        swapped = " ".join(f"kata{i}" for i in range(220))
        self.assertEqual(self.submit(swapped).status_code, 201)
        submission = Submission.objects.get()
        self.assertEqual(submission.analysis.process_band, "attention")
        self.assertIn("lewat revisi", submission.analysis.process_evidence)
        revision = submission.reasoning_events.get(event_type="revision")
        self.assertGreaterEqual(revision.payload["inserted_words"], 200)
