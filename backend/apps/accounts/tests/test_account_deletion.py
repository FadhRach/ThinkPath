"""H7: hapus akun sampai tuntas, termasuk berkas di disk, tanpa menyentuh data orang lain."""
from __future__ import annotations

import os
import tempfile
import uuid
from datetime import timedelta
from io import StringIO
from pathlib import Path

from django.core.cache import cache
from django.core.files.base import ContentFile
from django.core.files.storage import default_storage
from django.core.management import call_command
from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient

from apps.academics.models import (
    Assignment,
    Class,
    ClassMembership,
    Submission,
    SubmissionDraft,
)
from apps.accounts.authentication import create_access_token
from apps.accounts.models import (
    AccountDeletion,
    AuthSession,
    ConsentAction,
    ConsentRecord,
    EducationLevel,
    Profile,
    Role,
)
from apps.accounts.privacy import REQUIRED_ITEMS, record_consent
from apps.analysis.models import AnalysisJob, AnalysisResult, AnalysisRun, JobStatus
from apps.cekpaham.models import CekPaham, CekPahamAttempt
from apps.notifications.models import Notification

PASSWORD = "kata-sandi-aman-91"


def put(path: str, data: bytes = b"x", age_hours: float = 0) -> str:
    saved = default_storage.save(path, ContentFile(data))
    if age_hours:
        full = Path(default_storage.path(saved))
        old = (timezone.now() - timedelta(hours=age_hours)).timestamp()
        os.utime(full, (old, old))
    return saved


@override_settings(ANALYSIS_INLINE=False)
class AccountDeletionTest(TestCase):
    def setUp(self):
        cache.clear()
        tmp = tempfile.TemporaryDirectory()
        self.addCleanup(tmp.cleanup)
        override = override_settings(MEDIA_ROOT=tmp.name)
        override.enable()
        self.addCleanup(override.disable)

        self.teacher = self.make("dosen@campus.test", Role.TEACHER)
        self.other_teacher = self.make("dosen2@campus.test", Role.TEACHER)
        self.student = self.make("mhs@campus.test", Role.STUDENT)
        self.other_student = self.make("mhs2@campus.test", Role.STUDENT)

        self.klass = Class.objects.create(
            owner=self.teacher, name="K", subject="E", education_level=EducationLevel.S1, join_code="DL-ETE01"
        )
        self.other_class = Class.objects.create(
            owner=self.other_teacher, name="K2", subject="E", education_level=EducationLevel.S1, join_code="DL-ETE02"
        )
        for student in (self.student, self.other_student):
            ClassMembership.objects.create(class_ref=self.klass, student_profile=student)
        ClassMembership.objects.create(class_ref=self.other_class, student_profile=self.student)
        self.assignment = Assignment.objects.create(class_ref=self.klass, title="T", expected_bloom_level=3)
        self.other_assignment = Assignment.objects.create(class_ref=self.other_class, title="T2", expected_bloom_level=3)

        self.doc_a, self.doc_b, self.doc_c = uuid.uuid4(), uuid.uuid4(), uuid.uuid4()
        # self.student: dokumen untuk kelas dosen 1 (doc_a) dan kelas dosen 2 (doc_b); other_student: doc_c.
        self.sub_a = self.submit(self.student, self.assignment, self.doc_a)
        self.sub_b = self.submit(self.student, self.other_assignment, self.doc_b)
        self.sub_c = self.submit(self.other_student, self.assignment, self.doc_c)
        self.audio = put(f"cekpaham/{self.student.id}/{uuid.uuid4()}.webm")
        cekpaham = CekPaham.objects.create(
            submission=self.sub_a, created_by=self.teacher, question_text="Jelaskan alasanmu memilih ini.",
            language="id", answer_seconds=60, window_start=timezone.now(), window_end=timezone.now() + timedelta(days=1),
        )
        CekPahamAttempt.objects.create(
            cekpaham=cekpaham, number=1, started_at=timezone.now(), deadline_at=timezone.now(), audio_path=self.audio
        )
        Notification.objects.create(recipient=self.student, kind="assignment_new", title="Baru")
        SubmissionDraft.objects.create(
            assignment=self.other_assignment, student_profile=self.other_student, started_at=timezone.now()
        )

    def make(self, email, role):
        profile = Profile(email=email, role=role, display_name=email.split("@")[0])
        profile.set_password(PASSWORD)
        profile.save()
        record_consent(profile.id, ConsentAction.GIVEN, REQUIRED_ITEMS[role])
        return profile

    def submit(self, student, assignment, doc):
        put(f"documents/{student.id}/{doc}.pdf")
        put(f"documents/{student.id}/{doc}.txt")
        submission = Submission.objects.create(
            assignment=assignment, student_profile=student, text_answer="isi", source_document=doc,
            started_at=timezone.now(), submitted_at=timezone.now(),
        )
        AnalysisResult.objects.create(submission=submission, ai_score=10, ai_band="low", bloom_level=2)
        AnalysisRun.objects.create(
            submission=submission, trigger="submit", ai_score=10, ai_band="low", bloom_level=2,
            analysis_source="heuristic", text_sha256="0" * 64,
        )
        AnalysisJob.objects.create(submission=submission, trigger="submit")
        return submission

    def api_for(self, profile):
        client = APIClient()
        client.credentials(HTTP_AUTHORIZATION=f"Bearer {create_access_token(profile)}")
        return client

    def delete(self, profile, **overrides):
        body = {"password": PASSWORD, "confirm": "HAPUS", **overrides}
        return self.api_for(profile).delete("/api/me", body, format="json")

    def exists(self, path):
        return default_storage.exists(path)

    # --- mahasiswa -------------------------------------------------------

    def test_wrong_password_or_phrase_deletes_nothing(self):
        for overrides in ({"password": "salah-sekali-1"}, {"confirm": "hapus saja"}, {"confirm": ""}):
            with self.subTest(overrides=overrides):
                cache.clear()
                self.assertEqual(self.delete(self.student, **overrides).status_code, 400)
        self.assertTrue(Profile.objects.filter(pk=self.student.pk).exists())
        self.assertTrue(self.exists(f"documents/{self.student.id}/{self.doc_a}.pdf"))

    def test_student_deletion_removes_rows_files_and_sessions(self):
        token = create_access_token(self.student)
        paths = [
            f"documents/{self.student.id}/{self.doc_a}.pdf", f"documents/{self.student.id}/{self.doc_a}.txt",
            f"documents/{self.student.id}/{self.doc_b}.pdf", self.audio,
        ]
        self.assertEqual(self.delete(self.student).status_code, 204)

        self.assertFalse(Profile.objects.filter(pk=self.student.pk).exists())
        for model in (Submission, Notification, ConsentRecord, AuthSession, CekPahamAttempt):
            if model is Submission:
                self.assertFalse(model.objects.filter(student_profile_id=self.student.pk).exists())
        self.assertFalse(ConsentRecord.objects.filter(profile_id=self.student.pk).exists())
        self.assertFalse(AuthSession.objects.filter(profile_id=self.student.pk).exists())
        self.assertFalse(Notification.objects.filter(recipient_id=self.student.pk).exists())
        self.assertFalse(CekPahamAttempt.objects.exists())
        for path in paths:
            self.assertFalse(self.exists(path), path)
        api = APIClient()
        api.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
        cache.clear()
        self.assertEqual(api.get("/api/me").status_code, 401)

    def test_other_peoples_data_is_untouched(self):
        self.delete(self.student)
        self.assertTrue(Submission.objects.filter(pk=self.sub_c.pk).exists())
        self.assertTrue(self.exists(f"documents/{self.other_student.id}/{self.doc_c}.pdf"))
        self.assertTrue(Class.objects.filter(pk=self.klass.pk).exists())
        self.assertTrue(SubmissionDraft.objects.exists())

    def test_only_an_anonymous_ledger_row_remains(self):
        self.delete(self.student)
        row = AccountDeletion.objects.get()
        self.assertEqual(row.role, Role.STUDENT)
        self.assertGreaterEqual(row.files_removed, 4)
        self.assertNotEqual(row.id, self.student.id)
        flat = " ".join(str(v) for v in vars(row).values())
        self.assertNotIn(self.student.email, flat)
        self.assertNotIn(str(self.student.id), flat)

    # --- dosen -----------------------------------------------------------

    def test_teacher_deletion_keeps_the_class_as_an_archive(self):
        impact = self.api_for(self.teacher).get("/api/me/deletion-impact").json()
        self.assertEqual((impact["classes"], impact["students"], impact["submissions"]), (1, 2, 2))
        self.assertTrue(impact["classes_kept_as_archive"])
        self.assertEqual(self.delete(self.teacher).status_code, 204)

        self.klass.refresh_from_db()
        self.assertIsNone(self.klass.owner_id)
        self.assertIsNotNone(self.klass.owner_left_at)
        self.assertTrue(self.klass.is_archived)
        # Jawaban, berkas, dan hasil Cek Paham mahasiswa tetap ada.
        self.assertTrue(Submission.objects.filter(pk__in=[self.sub_a.pk, self.sub_c.pk]).count() == 2)
        self.assertTrue(self.exists(f"documents/{self.student.id}/{self.doc_a}.pdf"))
        self.assertTrue(self.exists(self.audio))
        self.assertTrue(CekPaham.objects.filter(created_by__isnull=True).exists())
        self.assertTrue(Class.objects.filter(pk=self.other_class.pk, owner=self.other_teacher).exists())
        self.assertEqual(AccountDeletion.objects.get().role, Role.TEACHER)

    def test_students_see_the_archive_notice_and_cannot_add_answers(self):
        self.delete(self.teacher)
        cache.clear()
        api = self.api_for(self.student)
        rows = {row["id"]: row for row in api.get("/api/student/classes").json()}
        archived = rows[str(self.klass.id)]
        self.assertTrue(archived["is_archived"])
        self.assertIsNone(archived["teacher_name"])
        self.assertIsNotNone(archived["owner_left_at"])
        self.assertFalse(rows[str(self.other_class.id)]["is_archived"])

        detail = api.get(f"/api/student/assignments/{self.assignment.id}").json()
        self.assertTrue(detail["class"]["is_archived"])

        blocked = api.put(f"/api/assignments/{self.assignment.id}/draft", {"text_answer": "tulisan baru"}, format="json")
        self.assertEqual(blocked.status_code, 400)
        self.assertIn("arsip", str(blocked.json()))
        joined = self.api_for(self.make("baru@campus.test", Role.STUDENT)).post(
            "/api/join", {"join_code": self.klass.join_code}, format="json"
        )
        self.assertEqual(joined.status_code, 400)

    def test_student_impact_counts(self):
        impact = self.api_for(self.student).get("/api/me/deletion-impact").json()
        self.assertEqual((impact["classes"], impact["submissions"], impact["files"]), (2, 2, 5))

    def test_deletion_attempts_are_throttled(self):
        codes = [self.delete(self.student, password="salah-sekali-1").status_code for _ in range(6)]
        self.assertEqual(codes, [400] * 5 + [429])

    def test_unauthenticated_cannot_delete(self):
        self.assertEqual(APIClient().delete("/api/me", {"password": PASSWORD, "confirm": "HAPUS"}, format="json").status_code, 401)


@override_settings(ANALYSIS_INLINE=False)
class PurgeStaleDataTest(TestCase):
    def setUp(self):
        tmp = tempfile.TemporaryDirectory()
        self.addCleanup(tmp.cleanup)
        override = override_settings(MEDIA_ROOT=tmp.name)
        override.enable()
        self.addCleanup(override.disable)
        self.student = Profile.objects.create(email="m@campus.test", role=Role.STUDENT)
        self.teacher = Profile.objects.create(email="d@campus.test", role=Role.TEACHER)
        klass = Class.objects.create(
            owner=self.teacher, name="K", subject="E", education_level=EducationLevel.S1, join_code="PG-ST001"
        )
        assignment = Assignment.objects.create(class_ref=klass, title="T", expected_bloom_level=3)
        self.kept_doc = uuid.uuid4()
        Submission.objects.create(
            assignment=assignment, student_profile=self.student, source_document=self.kept_doc, started_at=timezone.now()
        )

    def run_purge(self, *args):
        out = StringIO()
        call_command("purge_stale_data", *args, stdout=out)
        return out.getvalue()

    def test_orphans_go_and_live_files_stay(self):
        sid = self.student.id
        referenced = put(f"documents/{sid}/{self.kept_doc}.pdf", age_hours=100)
        fresh_upload = put(f"documents/{sid}/{uuid.uuid4()}.pdf")  # baru diunggah, belum dikumpulkan
        stale_upload = put(f"documents/{sid}/{uuid.uuid4()}.pdf", age_hours=48)
        ghost = put(f"documents/{uuid.uuid4()}/{uuid.uuid4()}.pdf")  # pemilik sudah tidak ada
        ghost_audio = put(f"cekpaham/{uuid.uuid4()}/{uuid.uuid4()}.webm")
        stale_audio = put(f"cekpaham/{sid}/{uuid.uuid4()}.webm", age_hours=48)

        report = self.run_purge("--dry-run")
        self.assertIn("4 berkas yatim akan dihapus", report)
        self.assertTrue(self.exists(stale_upload))

        self.run_purge()
        self.assertTrue(self.exists(referenced))
        self.assertTrue(self.exists(fresh_upload))
        for gone in (stale_upload, ghost, ghost_audio, stale_audio):
            self.assertFalse(self.exists(gone), gone)

    def exists(self, path):
        return default_storage.exists(path)

    def test_old_rows_are_removed(self):
        submission = Submission.objects.get()
        old = timezone.now() - timedelta(days=40)
        job = AnalysisJob.objects.create(submission=submission, trigger="submit", status=JobStatus.DONE)
        AnalysisJob.objects.filter(pk=job.pk).update(created_at=old)
        live = AnalysisJob.objects.create(submission=submission, trigger="submit", status=JobStatus.QUEUED)
        AnalysisJob.objects.filter(pk=live.pk).update(created_at=old)
        note = Notification.objects.create(recipient=self.student, kind="assignment_new", title="Lama")
        Notification.objects.filter(pk=note.pk).update(created_at=timezone.now() - timedelta(days=100))
        AuthSession.objects.create(profile=self.student, expires_at=old)
        AuthSession.objects.create(profile=self.student, expires_at=timezone.now() + timedelta(days=1))

        self.run_purge()
        self.assertEqual(list(AnalysisJob.objects.values_list("pk", flat=True)), [live.pk])
        self.assertFalse(Notification.objects.exists())
        self.assertEqual(AuthSession.objects.count(), 1)
