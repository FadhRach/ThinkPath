import re
from datetime import timedelta
from unittest.mock import patch

from django.utils import timezone

from apps.cekpaham.models import CekPahamAttempt
from apps.cekpaham.providers.groq_stt import Transcription
from apps.cekpaham.tests.base import CekPahamAPITestCase, good_transcription, good_verdict
from apps.cekpaham.tests.test_api import create_payload
from apps.notifications import events
from apps.notifications.models import Notification, NotificationKind

# Kata yang tidak boleh sampai ke mahasiswa: notifikasi tidak pernah membingkai
# Cek Paham sebagai kecurigaan atau menyinggung deteksi AI.
FORBIDDEN = re.compile(r"\bAI\b|indikasi|curiga|mencurigakan|palsu|plagiat|menyontek|kecurangan|skor|nilai", re.IGNORECASE)


class CekPahamNotificationTest(CekPahamAPITestCase):
    def mine(self, profile, kind=None):
        rows = Notification.objects.filter(recipient=profile).order_by("created_at")
        return list(rows.filter(kind=kind) if kind else rows)

    def create_via_api(self):
        path = f"/api/submissions/{self.submission.id}/cekpaham"
        return self.client_for(self.teacher).post(path, create_payload(), format="json")

    def test_student_is_told_neutrally_when_a_request_is_created(self):
        response = self.create_via_api()
        (note,) = self.mine(self.student, NotificationKind.CEKPAHAM_NEW)
        self.assertEqual(note.link, f"/student/cekpaham/{response.data['id']}")
        self.assertIn("Tugas 3", note.title)
        self.assertEqual(note.event_at.isoformat(), response.data["window_end"].replace("Z", "+00:00"))
        self.assertIsNone(FORBIDDEN.search(f"{note.title} {note.body}"), f"{note.title} | {note.body}")
        self.assertEqual(self.mine(self.teacher), [])

    def test_everything_sent_to_the_student_stays_neutral(self):
        cekpaham, _ = self.run_session()
        events.cekpaham_created(cekpaham)
        self.client_for(self.student).post(self.url(cekpaham, "/report"), {"reason": "other"}, format="json")
        report = CekPahamAttempt.objects.get().reports.get()
        self.client_for(self.teacher).post(f"/api/cekpaham/reports/{report.id}/resolve", {"resolution": "dismissed"}, format="json")
        events.ensure_deadline_reminders(self.student.id)
        for note in self.mine(self.student):
            if note.kind.startswith("cekpaham"):
                self.assertIsNone(FORBIDDEN.search(f"{note.title} {note.body}"), f"{note.title} | {note.body}")

    def test_teacher_hears_when_the_result_is_ready_only_once(self):
        cekpaham, _ = self.run_session()
        self.finalize(cekpaham)  # panggilan ulang yang idempoten
        (note,) = self.mine(self.teacher, NotificationKind.CEKPAHAM_RESULT)
        self.assertEqual(note.title, "Hasil Cek Paham siap: Mahasiswa")
        self.assertEqual(note.link, f"/dashboard/cekpaham/{cekpaham.id}")

    def test_teacher_hears_about_failures_and_dropped_sessions(self):
        failed = self.make_request()
        self.start(failed)
        with patch("apps.cekpaham.services.attempts.groq_stt.transcribe", return_value=Transcription(error_code="stt_quota")):
            self.finalize(failed)
        self.assertIn("perlu diproses ulang", self.mine(self.teacher)[-1].title)

        CekPahamAttempt.objects.all().delete()
        self.start(failed)
        self.client_for(self.student).post(self.url(failed, "/finalize"), {"interrupted": "true"}, format="multipart")
        self.assertIn("terputus", self.mine(self.teacher)[-1].title)

    def test_report_and_response_reach_the_right_person(self):
        cekpaham, _ = self.run_session()
        self.client_for(self.student).post(self.url(cekpaham, "/report"), {"reason": "mic_failure"}, format="json")
        reported = self.mine(self.teacher)[-1]
        self.assertEqual((reported.title, reported.body), ("Laporan Cek Paham dari Mahasiswa", "Mikrofon bermasalah"))

        report = CekPahamAttempt.objects.get().reports.get()
        self.client_for(self.teacher).post(f"/api/cekpaham/reports/{report.id}/resolve", {"resolution": "grant_retry"}, format="json")
        (answer,) = self.mine(self.student, NotificationKind.CEKPAHAM_RESOLVED)
        self.assertIn("mengulang", answer.body)

    def test_deadline_reminder_is_sent_once_and_only_while_it_is_useful(self):
        now = timezone.now()
        cekpaham = self.make_request(window_end=now + timedelta(hours=12))
        self.assertEqual(events.ensure_deadline_reminders(self.student.id), 1)
        self.assertEqual(events.ensure_deadline_reminders(self.student.id), 0)
        (note,) = self.mine(self.student, NotificationKind.CEKPAHAM_NEW)
        self.assertIn("segera ditutup", note.title)

        self.start(cekpaham)
        Notification.objects.all().delete()
        self.assertEqual(events.ensure_deadline_reminders(self.student.id), 0)  # sudah dikerjakan

    def test_no_reminder_when_the_window_is_far_off_or_not_open_yet(self):
        now = timezone.now()
        self.make_request(window_end=now + timedelta(days=3))
        self.assertEqual(events.ensure_deadline_reminders(self.student.id), 0)
        self.make_request(status="cancelled", window_end=now + timedelta(hours=5))
        self.assertEqual(events.ensure_deadline_reminders(self.student.id), 0)

    def test_a_notification_failure_never_fails_the_action(self):
        with patch("apps.notifications.events.cekpaham_created", side_effect=RuntimeError("boom")), \
             self.assertLogs(level="ERROR"):
            self.assertEqual(self.create_via_api().status_code, 201)

    def test_finalize_still_succeeds_when_the_teacher_notification_fails(self):
        cekpaham = self.make_request()
        self.start(cekpaham)
        with patch("apps.notifications.events.cekpaham_finished", side_effect=RuntimeError("boom")), \
             patch("apps.cekpaham.services.attempts.groq_stt.transcribe", return_value=good_transcription()), \
             patch("apps.cekpaham.services.attempts.judge.judge", return_value=good_verdict()), \
             self.assertLogs(level="ERROR"):
            response = self.finalize(cekpaham)
        self.assertEqual(response.data["state"], "done")
