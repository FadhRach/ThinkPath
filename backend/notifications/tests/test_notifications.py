"""Tes materi, jadwal mahasiswa, dan notifikasi.

Keputusan produk yang dijaga:

1. Notifikasi ke mahasiswa tidak pernah menyebut indikasi AI, termasuk undangan
   sesi diskusi yang lahir dari verifikasi verbal.
2. Dosen tidak dibanjiri: pengumpulan untuk tugas yang sama digabung selama
   belum dibaca.
3. Pengingat tenggat dikirim sekali, tanpa penjadwal, saat mahasiswa membuka
   lonceng.
4. Gagal menulis notifikasi tidak pernah menggagalkan aksi utamanya.
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
    Material,
    Submission,
    SubmissionStatus,
    VerbalVerification,
    VerificationStatus,
)
from academics.schedule import build_student_schedule
from core.authentication import create_access_token
from core.models import ConsentAction, EducationLevel, Profile, Role
from core.privacy import REQUIRED_ITEMS, record_consent
from notifications.models import Notification, NotificationKind
from notifications.services import notify_once

ANSWER = (
    "Ketimpangan antarwilayah muncul karena investasi menumpuk di kota besar. "
    "Akibatnya daerah tertinggal kekurangan lapangan kerja dan layanan dasar."
)


class Base(TestCase):
    def setUp(self):
        env = patch.dict("os.environ", {"GROQ_API_KEY": "", "WINSTON_API_KEY": ""})
        env.start()
        self.addCleanup(env.stop)

        self.dosen = Profile.objects.create(
            email="dosen@test.local", display_name="Dosen Uji", role=Role.TEACHER
        )
        self.dosen_lain = Profile.objects.create(
            email="lain@test.local", display_name="Dosen Lain", role=Role.TEACHER
        )
        self.mhs = Profile.objects.create(
            email="mhs@test.local", display_name="Mahasiswa Satu", role=Role.STUDENT
        )
        self.mhs2 = Profile.objects.create(
            email="mhs2@test.local", display_name="Mahasiswa Dua", role=Role.STUDENT
        )
        self.orang_luar = Profile.objects.create(
            email="luar@test.local", display_name="Bukan Anggota", role=Role.STUDENT
        )
        self.kelas = Class.objects.create(
            owner=self.dosen,
            name="Ekonomi Pembangunan B",
            subject="Ekonomi Pembangunan",
            education_level=EducationLevel.S1,
            join_code="EP-3B1XY",
        )
        for student in (self.mhs, self.mhs2):
            ClassMembership.objects.create(class_ref=self.kelas, student_profile=student)
            # Mengumpulkan jawaban mensyaratkan persetujuan Kebijakan Privasi.
            record_consent(student.id, ConsentAction.GIVEN, REQUIRED_ITEMS[Role.STUDENT])

    def client_for(self, profile: Profile) -> APIClient:
        client = APIClient()
        client.credentials(HTTP_AUTHORIZATION=f"Bearer {create_access_token(profile)}")
        return client

    def make_assignment(self, title="Ketimpangan antarwilayah", deadline_in=timedelta(days=7)):
        return Assignment.objects.create(
            class_ref=self.kelas,
            title=title,
            instructions="",
            deadline=timezone.now() + deadline_in,
            expected_bloom_level=4,
        )

    def submit(self, student: Profile, assignment: Assignment):
        return self.client_for(student).post(
            f"/api/assignments/{assignment.id}/submissions",
            {"text_answer": ANSWER},
            format="json",
        )

    def inbox(self, profile: Profile):
        return Notification.objects.filter(recipient=profile).order_by("-created_at")


class MaterialTest(Base):
    def url(self, kelas=None):
        return f"/api/classes/{(kelas or self.kelas).id}/materials"

    def test_teacher_shares_material_and_members_are_notified(self):
        response = self.client_for(self.dosen).post(
            self.url(),
            {
                "title": "Slide pertemuan 3",
                "topic": "Pertemuan 3",
                "url": "https://example.org/slide.pdf",
            },
            format="json",
        )
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data["class_name"], "Ekonomi Pembangunan B")
        for student in (self.mhs, self.mhs2):
            note = self.inbox(student).first()
            self.assertEqual(note.kind, NotificationKind.MATERIAL_NEW)
            self.assertEqual(note.body, "Ekonomi Pembangunan B · Pertemuan 3")
            # Langsung ke materinya, bukan ke daftar seluruh kelas.
            self.assertEqual(
                note.link, f"/student/materi/{self.kelas.id}#materi-{response.data['id']}"
            )
        self.assertFalse(self.inbox(self.orang_luar).exists())

    def test_topic_is_optional_and_normalised(self):
        dosen = self.client_for(self.dosen)
        general = dosen.post(self.url(), {"title": "Silabus", "description": "x"}, format="json")
        self.assertEqual(general.data["topic"], "")
        spaced = dosen.post(
            self.url(),
            {"title": "Slide", "topic": "  Pertemuan   3 ", "description": "x"},
            format="json",
        )
        # Spasi berlebih akan memecah satu topik menjadi dua kelompok.
        self.assertEqual(spaced.data["topic"], "Pertemuan 3")

    def test_owner_can_edit_without_notifying_again(self):
        material = Material.objects.create(
            class_ref=self.kelas, title="Slide", description="Ringkasan"
        )
        response = self.client_for(self.dosen).patch(
            f"/api/materials/{material.id}",
            {"topic": "Pertemuan 4", "title": "Slide pertemuan 4"},
            format="json",
        )
        self.assertEqual(response.status_code, 200)
        material.refresh_from_db()
        self.assertEqual((material.topic, material.title), ("Pertemuan 4", "Slide pertemuan 4"))
        self.assertEqual(material.description, "Ringkasan")
        self.assertFalse(self.inbox(self.mhs).exists())

    def test_edit_still_needs_a_summary_or_a_link(self):
        material = Material.objects.create(
            class_ref=self.kelas, title="Slide", description="Ringkasan"
        )
        response = self.client_for(self.dosen).patch(
            f"/api/materials/{material.id}", {"description": ""}, format="json"
        )
        self.assertEqual(response.status_code, 400)
        material.refresh_from_db()
        self.assertEqual(material.description, "Ringkasan")

    def test_student_sees_only_materials_of_joined_classes(self):
        kelas_lain = Class.objects.create(
            owner=self.dosen_lain,
            name="Statistika A",
            subject="Statistika",
            education_level=EducationLevel.S1,
            join_code="ST-1A1XY",
        )
        Material.objects.create(class_ref=self.kelas, title="Milik kelas", description="x")
        Material.objects.create(class_ref=kelas_lain, title="Kelas lain", description="x")
        response = self.client_for(self.mhs).get("/api/student/materials")
        self.assertEqual([row["title"] for row in response.data], ["Milik kelas"])

    def test_only_http_links_are_accepted(self):
        for link in ("javascript:alert(1)", "ftp://example.org/file"):
            response = self.client_for(self.dosen).post(
                self.url(), {"title": "Tautan", "url": link}, format="json"
            )
            self.assertEqual(response.status_code, 400, link)

    def test_material_needs_a_summary_or_a_link(self):
        response = self.client_for(self.dosen).post(
            self.url(), {"title": "Kosong"}, format="json"
        )
        self.assertEqual(response.status_code, 400)

    def test_other_teacher_cannot_touch_materials(self):
        material = Material.objects.create(class_ref=self.kelas, title="Milik", description="x")
        other = self.client_for(self.dosen_lain)
        self.assertEqual(other.get(self.url()).status_code, 404)
        self.assertEqual(
            other.patch(
                f"/api/materials/{material.id}", {"title": "Diambil alih"}, format="json"
            ).status_code,
            404,
        )
        self.assertEqual(other.delete(f"/api/materials/{material.id}").status_code, 404)
        self.assertEqual(Material.objects.get(pk=material.pk).title, "Milik")
        student = self.client_for(self.mhs)
        self.assertEqual(
            student.patch(
                f"/api/materials/{material.id}", {"title": "Diubah"}, format="json"
            ).status_code,
            403,
        )

    def test_owner_can_delete(self):
        material = Material.objects.create(class_ref=self.kelas, title="Milik", description="x")
        response = self.client_for(self.dosen).delete(f"/api/materials/{material.id}")
        self.assertEqual(response.status_code, 204)
        self.assertFalse(Material.objects.filter(pk=material.pk).exists())


class StudentNotificationTest(Base):
    def test_new_assignment_reaches_members_only(self):
        response = self.client_for(self.dosen).post(
            f"/api/classes/{self.kelas.id}/assignments",
            {
                "title": "Ruang fiskal daerah",
                "instructions": "",
                "deadline": (timezone.now() + timedelta(days=5)).isoformat(),
                "expected_bloom_level": 5,
            },
            format="json",
        )
        self.assertEqual(response.status_code, 201)
        note = self.inbox(self.mhs).get()
        self.assertEqual(note.kind, NotificationKind.ASSIGNMENT_NEW)
        self.assertEqual(note.link, f"/student/submit/{response.data['id']}")
        self.assertIsNotNone(note.event_at)
        self.assertFalse(self.inbox(self.orang_luar).exists())

    def test_grading_notifies_once_for_the_same_values(self):
        assignment = self.make_assignment()
        self.submit(self.mhs, assignment)
        submission = Submission.objects.get(student_profile=self.mhs)
        dosen = self.client_for(self.dosen)
        payload = {"grade": 88, "teacher_feedback": "Argumen runtut."}
        dosen.patch(f"/api/submissions/{submission.id}", payload, format="json")
        dosen.patch(f"/api/submissions/{submission.id}", payload, format="json")
        graded = self.inbox(self.mhs).filter(kind=NotificationKind.SUBMISSION_GRADED)
        self.assertEqual(graded.count(), 1)
        self.assertIn("Nilai 88", graded.get().body)

    def test_session_invite_never_mentions_ai(self):
        assignment = self.make_assignment()
        self.submit(self.mhs, assignment)
        submission = Submission.objects.get(student_profile=self.mhs)
        dosen = self.client_for(self.dosen)
        url = f"/api/submissions/{submission.id}/verification"
        when = timezone.now() + timedelta(days=2)

        dosen.put(url, {"status": "scheduled", "scheduled_at": when.isoformat()}, format="json")
        invite = self.inbox(self.mhs).get(kind=NotificationKind.SESSION_SCHEDULED)
        self.assertEqual(invite.title, "Undangan sesi diskusi jawaban")
        for text in (invite.title, invite.body):
            self.assertNotIn("AI", text)
            self.assertNotIn("indikasi", text.lower())

        # Menyimpan ulang tanpa mengubah jam tidak mengirim apa pun.
        dosen.put(url, {"status": "scheduled", "scheduled_at": when.isoformat()}, format="json")
        self.assertEqual(self.inbox(self.mhs).filter(kind=NotificationKind.SESSION_SCHEDULED).count(), 1)

        later = when + timedelta(hours=3)
        dosen.put(url, {"status": "scheduled", "scheduled_at": later.isoformat()}, format="json")
        self.assertEqual(self.inbox(self.mhs).first().title, "Jadwal sesi diskusi jawaban diubah")

        dosen.delete(url)
        self.assertEqual(self.inbox(self.mhs).first().kind, NotificationKind.SESSION_CANCELLED)

    def test_completed_session_is_not_announced(self):
        assignment = self.make_assignment()
        self.submit(self.mhs, assignment)
        submission = Submission.objects.get(student_profile=self.mhs)
        self.client_for(self.dosen).put(
            f"/api/submissions/{submission.id}/verification",
            {"status": "completed", "outcome": "can_explain"},
            format="json",
        )
        self.assertFalse(
            self.inbox(self.mhs)
            .filter(kind__in=[NotificationKind.SESSION_SCHEDULED, NotificationKind.SESSION_CANCELLED])
            .exists()
        )

    def test_deadline_reminder_is_created_once_when_the_bell_opens(self):
        soon = self.make_assignment(title="Tenggat besok", deadline_in=timedelta(hours=10))
        self.make_assignment(title="Masih lama", deadline_in=timedelta(days=3))
        done = self.make_assignment(title="Sudah dikerjakan", deadline_in=timedelta(hours=5))
        self.submit(self.mhs, done)

        client = self.client_for(self.mhs)
        client.get("/api/notifications")
        client.post("/api/notifications/read", {}, format="json")
        client.get("/api/notifications")

        reminders = self.inbox(self.mhs).filter(kind=NotificationKind.DEADLINE_SOON)
        self.assertEqual([note.link for note in reminders], [f"/student/submit/{soon.id}"])

    def test_deadline_reminder_survives_two_bells_opening_at_once(self):
        # Dua permintaan lonceng di worker berbeda sama-sama lolos pemeriksaan
        # "sudah ada?". Yang kalah cepat harus berhenti dengan tenang, bukan
        # menulis pengingat kedua atau merobohkan daftar notifikasinya.
        soon = self.make_assignment(title="Tenggat besok", deadline_in=timedelta(hours=10))
        self.client_for(self.mhs).get("/api/notifications")

        stale_check = patch(
            "notifications.services.Notification.objects.filter",
            return_value=Notification.objects.none(),
        )
        with stale_check:
            sent = notify_once(
                self.mhs.id,
                kind=NotificationKind.DEADLINE_SOON,
                group_key=f"deadline:{soon.id}",
                title="Tenggat kurang dari 24 jam",
            )
        self.assertFalse(sent)
        self.assertEqual(
            self.inbox(self.mhs).filter(kind=NotificationKind.DEADLINE_SOON).count(), 1
        )
        response = self.client_for(self.mhs).get("/api/notifications")
        self.assertEqual(response.status_code, 200)


class TeacherNotificationTest(Base):
    def test_submissions_for_one_assignment_are_grouped_while_unread(self):
        assignment = self.make_assignment()
        self.submit(self.mhs, assignment)
        self.submit(self.mhs2, assignment)

        grouped = self.inbox(self.dosen).filter(kind=NotificationKind.SUBMISSIONS_NEW)
        self.assertEqual(grouped.count(), 1)
        note = grouped.get()
        self.assertEqual(note.count, 2)
        self.assertTrue(note.title.startswith("2 pengumpulan baru"))
        self.assertIn("Mahasiswa Dua", note.body)

        self.client_for(self.dosen).post("/api/notifications/read", {}, format="json")
        self.submit(self.mhs, assignment)  # revisi
        self.assertEqual(grouped.count(), 2)
        self.assertIn("merevisi", grouped.first().body)

    def test_joining_by_code_notifies_the_owner(self):
        self.client_for(self.orang_luar).post(
            "/api/join", {"join_code": self.kelas.join_code}, format="json"
        )
        note = self.inbox(self.dosen).get(kind=NotificationKind.STUDENTS_JOINED)
        self.assertIn("Bukan Anggota", note.body)

        # Bergabung ulang tidak dihitung dua kali.
        self.client_for(self.orang_luar).post(
            "/api/join", {"join_code": self.kelas.join_code}, format="json"
        )
        self.assertEqual(self.inbox(self.dosen).get().count, 1)


class InboxApiTest(Base):
    def test_list_and_mark_read_only_touch_own_notifications(self):
        mine = Notification.objects.create(recipient=self.mhs, kind="material_new", title="A")
        other = Notification.objects.create(recipient=self.mhs2, kind="material_new", title="B")

        client = self.client_for(self.mhs)
        response = client.get("/api/notifications")
        self.assertEqual(response.data["unread_count"], 1)
        self.assertEqual([item["title"] for item in response.data["items"]], ["A"])

        response = client.post(
            "/api/notifications/read", {"ids": [str(mine.id), str(other.id)]}, format="json"
        )
        self.assertEqual(response.data["unread_count"], 0)
        other.refresh_from_db()
        self.assertIsNone(other.read_at)

    def test_requires_login(self):
        self.assertIn(APIClient().get("/api/notifications").status_code, (401, 403))

    def test_failed_notification_never_breaks_the_action(self):
        with patch(
            "notifications.events.assignment_created", side_effect=RuntimeError("mati")
        ), self.assertLogs("notifications.services", level="ERROR"):
            response = self.client_for(self.dosen).post(
                f"/api/classes/{self.kelas.id}/assignments",
                {
                    "title": "Tetap tersimpan",
                    "instructions": "",
                    "deadline": (timezone.now() + timedelta(days=5)).isoformat(),
                    "expected_bloom_level": 4,
                },
                format="json",
            )
        self.assertEqual(response.status_code, 201)
        self.assertTrue(Assignment.objects.filter(title="Tetap tersimpan").exists())


class ScheduleTest(Base):
    def test_agenda_lists_upcoming_deadlines_and_own_sessions(self):
        past = self.make_assignment(title="Sudah lewat", deadline_in=-timedelta(days=1))
        open_task = self.make_assignment(title="Belum dikerjakan", deadline_in=timedelta(days=2))
        graded = self.make_assignment(title="Sudah dinilai", deadline_in=timedelta(days=4))
        self.submit(self.mhs, graded)
        Submission.objects.filter(assignment=graded).update(status=SubmissionStatus.REVIEWED)

        own = Submission.objects.get(assignment=graded, student_profile=self.mhs)
        VerbalVerification.objects.create(
            submission=own,
            status=VerificationStatus.SCHEDULED,
            scheduled_at=timezone.now() + timedelta(days=1),
        )
        self.submit(self.mhs2, open_task)
        theirs = Submission.objects.get(assignment=open_task, student_profile=self.mhs2)
        VerbalVerification.objects.create(
            submission=theirs,
            status=VerificationStatus.SCHEDULED,
            scheduled_at=timezone.now() + timedelta(days=1),
        )

        response = self.client_for(self.mhs).get("/api/student/schedule")
        self.assertEqual(response.status_code, 200)
        rows = [(row["kind"], row["status"], row["title"]) for row in response.data]
        self.assertEqual(
            rows,
            [
                ("session", "scheduled", "Sesi diskusi jawaban: Sudah dinilai"),
                ("deadline", "not_submitted", "Belum dikerjakan"),
                ("deadline", "graded", "Sudah dinilai"),
            ],
        )
        self.assertNotIn(past.title, [row["title"] for row in response.data])

    def test_non_member_sees_nothing(self):
        self.make_assignment()
        self.assertEqual(build_student_schedule(self.orang_luar.id), [])

    def calendar(self, start, end, profile=None):
        return self.client_for(profile or self.mhs).get(
            "/api/student/schedule",
            {"start": start.isoformat(), "end": end.isoformat()},
        )

    def test_calendar_range_includes_past_items_and_session_history(self):
        now = timezone.now()
        missed = self.make_assignment(title="Terlewat", deadline_in=-timedelta(days=3))
        done = self.make_assignment(title="Selesai dibahas", deadline_in=-timedelta(days=6))
        self.make_assignment(title="Di luar rentang", deadline_in=timedelta(days=40))

        Assignment.objects.filter(pk=done.pk).update(deadline=now + timedelta(days=1))
        self.submit(self.mhs, done)
        Assignment.objects.filter(pk=done.pk).update(deadline=now - timedelta(days=6))
        own = Submission.objects.get(assignment=done, student_profile=self.mhs)
        VerbalVerification.objects.create(
            submission=own,
            status=VerificationStatus.COMPLETED,
            scheduled_at=now - timedelta(days=4),
            outcome="can_explain",
            notes="Catatan dosen yang tidak boleh bocor.",
        )

        response = self.calendar(now - timedelta(days=14), now + timedelta(days=14))
        self.assertEqual(response.status_code, 200)
        rows = [(row["kind"], row["status"], row["title"]) for row in response.data]
        self.assertEqual(
            rows,
            [
                ("deadline", "submitted", "Selesai dibahas"),
                ("session", "done", "Sesi diskusi jawaban: Selesai dibahas"),
                ("deadline", "not_submitted", missed.title),
            ],
        )
        self.assertTrue(all(row["class_id"] == str(self.kelas.id) for row in response.data))
        # Riwayat sesi tidak membawa kesimpulan maupun catatan dosen.
        self.assertNotIn("Catatan dosen", str(response.data))
        self.assertNotIn("can_explain", str(response.data))

    def test_cancelled_session_is_left_out_of_the_calendar(self):
        now = timezone.now()
        assignment = self.make_assignment()
        self.submit(self.mhs, assignment)
        VerbalVerification.objects.create(
            submission=Submission.objects.get(student_profile=self.mhs),
            status=VerificationStatus.CANCELLED,
            scheduled_at=now + timedelta(days=1),
        )
        response = self.calendar(now, now + timedelta(days=30))
        self.assertEqual([row["kind"] for row in response.data], ["deadline"])

    def test_calendar_range_is_validated(self):
        now = timezone.now()
        client = self.client_for(self.mhs)
        cases = [
            {"start": now.isoformat()},
            {"start": "2026-09-01T00:00:00", "end": "2026-09-30T00:00:00"},
            {"start": "kemarin", "end": now.isoformat()},
            {"start": now.isoformat(), "end": (now - timedelta(days=1)).isoformat()},
            {"start": now.isoformat(), "end": (now + timedelta(days=90)).isoformat()},
        ]
        for params in cases:
            response = client.get("/api/student/schedule", params)
            self.assertEqual(response.status_code, 400, params)

        # Dekat batas tahun 9999 dulu meluap saat menghitung start + 62 hari
        # dan berakhir sebagai galat 500. Rentang sah di sana cukup kosong.
        response = client.get(
            "/api/student/schedule",
            {"start": "9999-12-31T00:00:00+00:00", "end": "9999-12-31T12:00:00+00:00"},
        )
        self.assertEqual((response.status_code, response.data), (200, []))

    def test_calendar_accepts_an_unencoded_plus_offset(self):
        # "+07:00" yang tidak di-encode tiba sebagai spasi di query string.
        response = self.client_for(self.mhs).get(
            "/api/student/schedule?start=2026-09-01T00:00:00+07:00&end=2026-10-01T00:00:00+07:00"
        )
        self.assertEqual(response.status_code, 200)
