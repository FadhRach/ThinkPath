from io import StringIO

from django.core.management import call_command
from django.test import TestCase

from apps.accounts.models import Profile
from apps.accounts.privacy import current_consent
from apps.cekpaham import judge
from apps.cekpaham.models import AttemptStatus, CekPaham, CekPahamAttempt, CekPahamReport
from apps.cekpaham.services.gate import consent_state


class SeedDemoTest(TestCase):
    @classmethod
    def setUpTestData(cls):
        call_command("seed_demo_data", stdout=StringIO())

    def test_three_demo_states_exist(self):
        self.assertEqual(CekPaham.objects.count(), 3)
        self.assertEqual(CekPahamAttempt.objects.filter(status=AttemptStatus.SCORED).count(), 2)
        self.assertEqual(CekPahamReport.objects.filter(status="open").count(), 1)
        open_one = CekPaham.objects.get(attempts__isnull=True)
        self.assertEqual(open_one.submission.student_profile.email, "mhs07@thinkpath.local")

    def test_seeding_twice_does_not_duplicate(self):
        call_command("seed_demo_data", stdout=StringIO())
        self.assertEqual((CekPaham.objects.count(), CekPahamAttempt.objects.count(), CekPahamReport.objects.count()), (3, 2, 1))

    def test_every_demo_account_has_consent_so_login_goes_straight_in(self):
        students = Profile.objects.filter(role="student")
        self.assertEqual(students.count(), 8)
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
