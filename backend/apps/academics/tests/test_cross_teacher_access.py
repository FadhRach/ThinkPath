"""Dosen B tidak boleh menyentuh data dosen A, dan mahasiswa non-anggota tidak
boleh menyentuh kelas yang bukan miliknya (IDOR lintas akun).

Setiap endpoint yang menerima id objek dipanggil memakai id milik dosen A oleh
akun yang bukan pemiliknya. Balasan yang sah hanya 403/404, dan daftar tidak
boleh memuat data orang lain.
"""
from __future__ import annotations

from datetime import timedelta
from unittest.mock import patch

from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from apps.academics.models import (
    Assignment,
    Class,
    ClassMembership,
    Material,
    Submission,
)
from apps.forum.models import ForumPost
from apps.accounts.authentication import create_access_token
from apps.accounts.models import ConsentAction, EducationLevel, Profile, Role
from apps.accounts.privacy import REQUIRED_ITEMS, record_consent

ANSWER = (
    "Ketimpangan antarwilayah muncul karena investasi menumpuk di Jawa, "
    "sementara infrastruktur di luar Jawa tertinggal sehingga biaya logistik tinggi."
)
DENIED = (403, 404)


def _client(profile: Profile) -> APIClient:
    client = APIClient()
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {create_access_token(profile)}")
    return client


class CrossAccountAccessTest(TestCase):
    def setUp(self):
        env = patch.dict("os.environ", {"GROQ_API_KEY": "", "WINSTON_API_KEY": ""})
        env.start()
        self.addCleanup(env.stop)

        self.teacher_a = Profile.objects.create(email="a@test.local", role=Role.TEACHER)
        self.teacher_b = Profile.objects.create(email="b@test.local", role=Role.TEACHER)
        self.student = Profile.objects.create(email="mhs@test.local", role=Role.STUDENT)
        self.outsider = Profile.objects.create(email="luar@test.local", role=Role.STUDENT)
        for student in (self.student, self.outsider):
            record_consent(student.id, ConsentAction.GIVEN, REQUIRED_ITEMS[Role.STUDENT])

        self.klass = Class.objects.create(
            owner=self.teacher_a,
            name="Ekonomi Pembangunan",
            subject="Ekonomi",
            education_level=EducationLevel.S1,
            join_code="EP-IDOR1",
        )
        ClassMembership.objects.create(class_ref=self.klass, student_profile=self.student)
        self.assignment = Assignment.objects.create(
            class_ref=self.klass,
            title="Ketimpangan",
            deadline=timezone.now() + timedelta(days=7),
            expected_bloom_level=4,
        )
        self.material = Material.objects.create(
            class_ref=self.klass, title="Bab 1", description="Ringkasan"
        )
        ForumPost.objects.create(
            class_ref=self.klass, author=self.teacher_a, kind="announcement", title="Info", body="Isi"
        )
        response = _client(self.student).post(
            f"/api/assignments/{self.assignment.id}/submissions",
            {"text_answer": ANSWER},
            format="json",
        )
        self.assertEqual(response.status_code, 201, response.content)
        self.submission = Submission.objects.get()

    def assertDenied(self, response, label: str):
        self.assertIn(response.status_code, DENIED, f"{label}: {response.status_code} {response.content[:200]!r}")

    @patch.dict("os.environ", {"GROQ_API_KEY": "dummy"})  # 503 sebelum cek kepemilikan bila kosong
    def test_teacher_b_cannot_read_or_write_teacher_a_objects(self):
        b = _client(self.teacher_b)
        k, a, s, m = self.klass.id, self.assignment.id, self.submission.id, self.material.id
        calls = {
            "assignments kelas": b.get(f"/api/classes/{k}/assignments"),
            "buat tugas": b.post(
                f"/api/classes/{k}/assignments",
                {
                    "title": "Curang",
                    "instructions": "x",
                    "deadline": (timezone.now() + timedelta(days=1)).isoformat(),
                    "expected_bloom_level": 3,
                },
                format="json",
            ),
            "materi kelas": b.get(f"/api/classes/{k}/materials"),
            "buat materi": b.post(f"/api/classes/{k}/materials", {"title": "x", "description": "y"}, format="json"),
            "roster": b.get(f"/api/classes/{k}/students"),
            "forum kelas": b.get(f"/api/classes/{k}/forum"),
            "buat pengumuman": b.post(
                f"/api/classes/{k}/forum",
                {"kind": "announcement", "title": "xyz", "body": "y"},
                format="json",
            ),
            "detail materi": b.get(f"/api/materials/{m}"),
            "ubah materi": b.patch(f"/api/materials/{m}", {"title": "x"}, format="json"),
            "hapus materi": b.delete(f"/api/materials/{m}"),
            "detail tugas": b.get(f"/api/assignments/{a}"),
            "daftar jawaban": b.get(f"/api/assignments/{a}/submissions"),
            "detail jawaban": b.get(f"/api/submissions/{s}"),
            "nilai jawaban": b.patch(f"/api/submissions/{s}", {"grade": 100}, format="json"),
            "analisis ulang": b.post(f"/api/submissions/{s}/reanalyze"),
            "dokumen jawaban": b.get(f"/api/submissions/{s}/document"),
            "profil kognitif": b.get(f"/api/students/{self.student.id}/profile"),
            "buat cek paham": b.post(
                f"/api/submissions/{s}/cekpaham",
                {
                    "question_text": "Jelaskan alasan kamu memilih pendekatan ini.",
                    "language": "id",
                    "answer_seconds": 60,
                    "window_start": timezone.now().isoformat(),
                    "window_end": (timezone.now() + timedelta(days=1)).isoformat(),
                },
                format="json",
            ),
        }
        for label, response in calls.items():
            with self.subTest(label):
                # PATCH/DELETE pada rute yang memang tidak mendukung metode itu
                # dibalas 405; itu bukan kebocoran, tapi tetap dicatat terpisah.
                self.assertIn(response.status_code, DENIED + (405,), f"{label}: {response.status_code} {response.content[:200]!r}")

        self.submission.refresh_from_db()
        self.assertIsNone(self.submission.grade)
        self.assertEqual(Assignment.objects.count(), 1)
        self.assertEqual(Material.objects.count(), 1)

    def test_cognitive_profile_of_a_new_member_is_empty_not_404(self):
        newcomer = Profile.objects.create(email="baru@test.local", role=Role.STUDENT)
        ClassMembership.objects.create(class_ref=self.klass, student_profile=newcomer)

        response = _client(self.teacher_a).get(f"/api/students/{newcomer.id}/profile")
        self.assertEqual(response.status_code, 200, response.content)
        self.assertEqual(response.data["classes"], [])
        self.assertIn(
            _client(self.teacher_a).get(f"/api/students/{self.outsider.id}/profile").status_code, DENIED
        )
        self.assertIn(
            _client(self.teacher_b).get(f"/api/students/{newcomer.id}/profile").status_code, DENIED
        )

    def test_teacher_b_lists_are_empty(self):
        b = _client(self.teacher_b)
        for path, key in (
            ("/api/classes", None),
            ("/api/assignments", None),
            ("/api/submissions", None),
            ("/api/cekpaham", None),
        ):
            with self.subTest(path):
                response = b.get(path)
                self.assertEqual(response.status_code, 200)
                body = response.json()
                items = body if isinstance(body, list) else next(iter(body.values()), [])
                self.assertEqual(items, [], f"{path} bocor: {body!r}"[:300])
        overview = b.get("/api/overview").json()
        self.assertEqual(overview["classes"], [])
        report = b.get("/api/reports/overview")
        self.assertNotIn("Ekonomi Pembangunan", report.content.decode())

    def test_outsider_student_cannot_touch_foreign_class(self):
        o = _client(self.outsider)
        a = self.assignment.id
        for label, response in {
            "detail tugas": o.get(f"/api/student/assignments/{a}"),
            "kirim jawaban": o.post(f"/api/assignments/{a}/submissions", {"text_answer": ANSWER}, format="json"),
        }.items():
            with self.subTest(label):
                self.assertDenied(response, label)
        self.assertEqual(Submission.objects.count(), 1)

    def test_student_cannot_use_teacher_endpoints(self):
        s = _client(self.student)
        for path in ("/api/classes", "/api/submissions", "/api/overview", "/api/reports/overview", "/api/cekpaham"):
            with self.subTest(path):
                self.assertEqual(s.get(path).status_code, 403)
        self.assertEqual(s.get(f"/api/submissions/{self.submission.id}").status_code, 403)
        self.assertEqual(_client(self.teacher_a).get("/api/student/classes").status_code, 403)

    def test_notifications_are_private(self):
        from apps.notifications.models import Notification

        note = Notification.objects.create(recipient=self.teacher_a, kind="submissions_new", title="Rahasia")
        b = _client(self.teacher_b)
        self.assertNotIn("Rahasia", b.get("/api/notifications").content.decode())
        b.post("/api/notifications/read", {"ids": [str(note.id)]}, format="json")
        note.refresh_from_db()
        self.assertIsNone(note.read_at)

    def test_teacher_b_cannot_join_as_student_or_read_cekpaham_of_a(self):
        # Dosen B tidak bisa memakai rute mahasiswa.
        self.assertEqual(_client(self.teacher_b).post("/api/join", {"join_code": "EP-IDOR1"}, format="json").status_code, 403)

    @patch.dict("os.environ", {"GROQ_API_KEY": "dummy"})
    def test_cekpaham_of_teacher_a_is_private(self):
        now = timezone.now()
        made = _client(self.teacher_a).post(
            f"/api/submissions/{self.submission.id}/cekpaham",
            {
                "question_text": "Jelaskan alasan kamu memilih pendekatan ini.",
                "language": "id",
                "answer_seconds": 60,
                "window_start": (now - timedelta(minutes=1)).isoformat(),
                "window_end": (now + timedelta(days=1)).isoformat(),
            },
            format="json",
        )
        self.assertEqual(made.status_code, 201, made.content)
        cp = made.json()["id"]
        b, o = _client(self.teacher_b), _client(self.outsider)
        for label, response in {
            "detail": b.get(f"/api/cekpaham/{cp}"),
            "batal": b.post(f"/api/cekpaham/{cp}/cancel"),
            "audio": b.get(f"/api/cekpaham/{cp}/attempts/1/audio"),
            "proses ulang": b.post(f"/api/cekpaham/{cp}/attempts/1/reprocess"),
            "mhs luar detail": o.get(f"/api/student/cekpaham/{cp}"),
            "mhs luar mulai": o.post(f"/api/student/cekpaham/{cp}/start"),
            "mhs luar lapor": o.post(f"/api/student/cekpaham/{cp}/report", {"reason": "other"}, format="json"),
        }.items():
            with self.subTest(label):
                self.assertDenied(response, label)
