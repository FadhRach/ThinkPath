"""H2: pengumpulan hanya menyimpan; worker yang menganalisis."""
from __future__ import annotations

from datetime import timedelta
from io import StringIO
from unittest.mock import patch

from django.core.cache import cache
from django.core.management import call_command
from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient

from apps.academics.models import AnalysisState, Assignment, Class, ClassMembership, Submission
from apps.academics.services import analysis_jobs
from apps.accounts.authentication import create_access_token
from apps.accounts.models import ConsentAction, EducationLevel, Profile, Role
from apps.accounts.privacy import ITEM_EXTERNAL_AI, REQUIRED_ITEMS, record_consent
from apps.analysis.choices import AnalysisSource
from apps.analysis.models import AnalysisJob, AnalysisResult, AnalysisRun, JobStatus

ANSWER = (
    "Ketimpangan antarwilayah muncul karena investasi menumpuk di Jawa, "
    "sementara infrastruktur di luar Jawa tertinggal sehingga biaya logistik tinggi."
)


def _client(profile):
    client = APIClient()
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {create_access_token(profile)}")
    return client


@override_settings(ANALYSIS_INLINE=False)
class QueuedAnalysisTest(TestCase):
    def setUp(self):
        cache.clear()
        env = patch.dict("os.environ", {"GROQ_API_KEY": "", "WINSTON_API_KEY": ""})
        env.start()
        self.addCleanup(env.stop)
        self.teacher = Profile.objects.create(email="d@test.local", role=Role.TEACHER)
        self.student = Profile.objects.create(email="m@test.local", role=Role.STUDENT)
        record_consent(self.student.id, ConsentAction.GIVEN, REQUIRED_ITEMS[Role.STUDENT])
        klass = Class.objects.create(
            owner=self.teacher, name="K", subject="E", education_level=EducationLevel.S1, join_code="JB-QUE01"
        )
        ClassMembership.objects.create(class_ref=klass, student_profile=self.student)
        self.assignment = Assignment.objects.create(
            class_ref=klass, title="T", expected_bloom_level=3, deadline=timezone.now() + timedelta(days=2)
        )
        self.url = f"/api/assignments/{self.assignment.id}/submissions"

    def submit(self, text=ANSWER):
        return _client(self.student).post(self.url, {"text_answer": text}, format="json")

    def work(self):
        """Satu putaran worker."""
        job = analysis_jobs.claim_next()
        if job:
            analysis_jobs.run_job(job)
        return job

    def test_submit_only_saves_and_queues(self):
        with patch("apps.academics.services.analysis_jobs.run_analysis") as analysis:
            response = self.submit()
        analysis.assert_not_called()
        self.assertEqual(response.status_code, 201)
        submission = Submission.objects.get()
        self.assertEqual(submission.analysis_state, AnalysisState.PENDING)
        self.assertFalse(AnalysisResult.objects.exists())
        self.assertEqual(AnalysisJob.objects.get().status, JobStatus.QUEUED)

    def test_teacher_sees_pending_state_without_a_result(self):
        self.submit()
        submission = Submission.objects.get()
        detail = _client(self.teacher).get(f"/api/submissions/{submission.id}").json()
        self.assertEqual(detail["analysis_state"], "pending")
        self.assertIsNone(detail["analysis"])
        row = _client(self.teacher).get("/api/submissions").json()[0]
        self.assertEqual(row["analysis_state"], "pending")

    def test_worker_completes_the_job(self):
        self.submit()
        self.assertIsNotNone(self.work())
        self.assertIsNone(self.work())
        submission = Submission.objects.get()
        self.assertEqual(submission.analysis_state, AnalysisState.DONE)
        self.assertEqual(AnalysisJob.objects.get().status, JobStatus.DONE)
        self.assertEqual(AnalysisResult.objects.get().submission_id, submission.id)
        self.assertEqual(AnalysisRun.objects.count(), 1)

    def test_a_revision_supersedes_the_waiting_job(self):
        self.submit()
        self.submit(ANSWER + " Tambahan penting.")
        statuses = sorted(AnalysisJob.objects.values_list("status", flat=True))
        self.assertEqual(statuses, [JobStatus.QUEUED, JobStatus.SUPERSEDED])
        self.work()
        self.assertEqual(AnalysisRun.objects.count(), 1)
        self.assertEqual(Submission.objects.get().analysis_state, AnalysisState.DONE)

    def test_result_of_a_job_whose_text_was_revised_meanwhile_is_dropped(self):
        self.submit()
        job = analysis_jobs.claim_next()
        self.submit(ANSWER + " Revisi sementara job berjalan.")
        analysis_jobs.run_job(job)
        job.refresh_from_db()
        self.assertEqual(job.status, JobStatus.SUPERSEDED)
        self.assertFalse(AnalysisResult.objects.exists())
        self.assertEqual(Submission.objects.get().analysis_state, AnalysisState.PENDING)

    def test_withdrawn_consent_is_honoured_when_the_job_runs(self):
        record_consent(self.student.id, ConsentAction.GIVEN, (*REQUIRED_ITEMS[Role.STUDENT], ITEM_EXTERNAL_AI))
        self.submit()
        record_consent(self.student.id, ConsentAction.WITHDRAWN, [])
        with patch.dict("os.environ", {"GROQ_API_KEY": "kunci", "WINSTON_API_KEY": "kunci"}), patch(
            "apps.analysis.providers.groq.call", side_effect=AssertionError("tidak boleh ke luar negeri")
        ), patch("apps.analysis.detector_cache.detect_cached", side_effect=AssertionError("tidak boleh")):
            self.work()
        self.assertEqual(AnalysisResult.objects.get().analysis_source, AnalysisSource.HEURISTIC)

    def test_unexpected_error_is_retried_then_falls_back_to_heuristics(self):
        self.submit()
        real = analysis_jobs.run_analysis

        def flaky(*args, allow_external=True, **kwargs):
            if allow_external:
                raise RuntimeError("DB putus")
            return real(*args, allow_external=False, **kwargs)

        with patch.object(analysis_jobs, "run_analysis", side_effect=flaky):
            for attempt in (1, 2):
                job = self.work()
                job.refresh_from_db()
                self.assertEqual(job.status, JobStatus.QUEUED, attempt)
                self.assertGreater(job.run_after, timezone.now())
                AnalysisJob.objects.filter(pk=job.pk).update(run_after=timezone.now())
            job = self.work()
        job.refresh_from_db()
        self.assertEqual(job.attempts, 3)
        self.assertEqual(job.status, JobStatus.DONE)
        self.assertIn("cadangan heuristik", job.error)
        self.assertEqual(Submission.objects.get().analysis_state, AnalysisState.DONE)

    def test_total_failure_marks_the_submission_failed(self):
        self.submit()
        AnalysisJob.objects.update(attempts=analysis_jobs.MAX_ATTEMPTS - 1)
        with patch.object(analysis_jobs, "run_analysis", side_effect=RuntimeError("rusak")):
            self.work()
        self.assertEqual(AnalysisJob.objects.get().status, JobStatus.FAILED)
        self.assertEqual(Submission.objects.get().analysis_state, AnalysisState.FAILED)

    def test_job_left_running_by_a_dead_worker_is_reclaimed(self):
        self.submit()
        first = analysis_jobs.claim_next()
        self.assertIsNone(analysis_jobs.claim_next())
        AnalysisJob.objects.filter(pk=first.pk).update(
            locked_at=timezone.now() - analysis_jobs.STALE_AFTER - timedelta(seconds=1)
        )
        again = analysis_jobs.claim_next()
        self.assertEqual(again.pk, first.pk)
        self.assertEqual(again.attempts, 2)

    def test_reanalysis_returns_202_and_the_worker_finishes_it(self):
        self.submit()
        self.work()
        submission = Submission.objects.get()
        response = _client(self.teacher).post(f"/api/submissions/{submission.id}/reanalyze")
        self.assertEqual(response.status_code, 202)
        self.assertEqual(response.json()["analysis_state"], "pending")
        self.work()
        self.assertEqual(AnalysisRun.objects.count(), 2)
        self.assertEqual(Submission.objects.get().analysis_state, AnalysisState.DONE)

    def test_worker_command_drains_the_queue(self):
        self.submit()
        call_command("run_analysis_worker", "--once", stdout=StringIO())
        self.assertEqual(Submission.objects.get().analysis_state, AnalysisState.DONE)
        self.assertFalse(AnalysisJob.objects.filter(status=JobStatus.QUEUED).exists())

    def test_deleted_submission_does_not_crash_the_worker(self):
        self.submit()
        job = analysis_jobs.claim_next()
        Submission.objects.all().delete()
        analysis_jobs.run_job(job)  # cascade sudah menghapus job; tidak boleh melempar
