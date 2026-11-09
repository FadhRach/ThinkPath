import tempfile
from io import StringIO

from datetime import timedelta

from django.core.management import call_command
from django.test import TestCase, override_settings
from django.utils import timezone

from apps.academics.models import Assignment, ReasoningEvent, Submission
from apps.accounts.models import Profile
from apps.accounts.privacy import current_consent
from apps.cekpaham import judge
from apps.analysis.models import AnalysisResult
from apps.cekpaham.models import AttemptStatus, CekPaham, CekPahamAttempt, CekPahamReport
from apps.cekpaham.selectors import phase_of
from apps.cekpaham.services.attempts import start_attempt
from apps.cekpaham.services.gate import consent_state


class SeedDemoTest(TestCase):
    @classmethod
    def setUpClass(cls):
        # Seed menulis PDF demo; jangan sampai masuk folder media sungguhan.
        cls._media = tempfile.TemporaryDirectory()
        cls._settings = override_settings(MEDIA_ROOT=cls._media.name)
        cls._settings.enable()
        super().setUpClass()

    @classmethod
    def tearDownClass(cls):
        super().tearDownClass()
        cls._settings.disable()
        cls._media.cleanup()

    @classmethod
    def setUpTestData(cls):
        call_command("seed_demo_data", stdout=StringIO())

    def test_three_demo_states_exist(self):
        self.assertEqual(CekPaham.objects.count(), 3)
        self.assertEqual(CekPahamAttempt.objects.filter(status=AttemptStatus.SCORED).count(), 2)
        self.assertEqual(CekPahamReport.objects.filter(status="open").count(), 1)
        open_one = CekPaham.objects.get(attempts__isnull=True)
        self.assertEqual(open_one.submission.student_profile.email, "mhs01@thinkpath.local")
        self.assertEqual(phase_of(open_one), "open")

    def test_mhs01_has_a_quick_open_task_to_do_live(self):
        mhs01 = Profile.objects.get(email="mhs01@thinkpath.local")
        task = Assignment.objects.get(title="Bubble sort atau merge sort?")
        self.assertGreater(task.deadline, timezone.now() + timedelta(days=4))
        self.assertFalse(task.submissions.filter(student_profile=mhs01).exists())
        self.assertTrue(task.submissions.exists())  # teman sekelas sudah mulai mengumpulkan

    def test_seeding_twice_does_not_duplicate_and_resets_rehearsal(self):
        mhs01 = Profile.objects.get(email="mhs01@thinkpath.local")
        task = Assignment.objects.get(title="Bubble sort atau merge sort?")
        open_one = CekPaham.objects.get(attempts__isnull=True)
        before = (Submission.objects.count(), AnalysisResult.objects.count(), ReasoningEvent.objects.count())
        start_attempt(open_one, mhs01.id)
        Submission.objects.create(assignment=task, student_profile=mhs01, text_answer="latihan", started_at=timezone.now())

        call_command("seed_demo_data", stdout=StringIO())

        self.assertEqual((CekPaham.objects.count(), CekPahamAttempt.objects.count(), CekPahamReport.objects.count()), (3, 2, 1))
        self.assertEqual((Submission.objects.count(), AnalysisResult.objects.count(), ReasoningEvent.objects.count()), before)
        self.assertFalse(open_one.attempts.exists())

    def test_every_demo_account_has_consent_so_login_goes_straight_in(self):
        students = Profile.objects.filter(role="student")
        self.assertEqual(students.count(), 20)
        for profile in Profile.objects.all():
            self.assertIsNotNone(current_consent(profile.id), profile.email)
        self.assertTrue(all(consent_state(p.id)["ready"] for p in students))

    def test_demo_evidence_quotes_really_appear_in_the_transcript(self):
        for attempt in CekPahamAttempt.objects.all():
            transcript = judge._normalize(attempt.final_transcript)
            for dim in attempt.ai_dimensions.values():
                for quote in dim["evidence"]:
                    self.assertIn(judge._normalize(quote), transcript)

    def test_demo_rows_are_marked_as_demo(self):
        for attempt in CekPahamAttempt.objects.all():
            self.assertTrue(attempt.ai_summary.startswith("[DATA DEMO]"))
