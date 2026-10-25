"""Reset sandi lewat email: tidak membocorkan akun, sekali pakai, mencabut sesi."""
from __future__ import annotations

import re
from datetime import timedelta
from unittest import mock

from django.core import mail
from django.core.cache import cache
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from apps.accounts.authentication import create_access_token
from apps.accounts.models import AuthSession, PasswordResetToken, Profile, Role

OLD = "kata-sandi-lama-91"
NEW = "kata-sandi-baru-77"


class PasswordResetTest(TestCase):
    def setUp(self):
        cache.clear()
        patch = mock.patch("apps.accounts.password_reset._run_in_background", side_effect=lambda work: work())
        patch.start()
        self.addCleanup(patch.stop)
        self.profile = Profile(email="mhs@campus.test", role=Role.STUDENT, display_name="Sari")
        self.profile.set_password(OLD)
        self.profile.save()
        self.api = APIClient()

    def request(self, email="mhs@campus.test"):
        return self.api.post("/api/auth/password-reset", {"email": email}, format="json")

    def token_from_mail(self) -> str:
        return re.search(r"token=([\w-]+)", mail.outbox[-1].body).group(1)

    def confirm(self, token, password=NEW):
        return self.api.post("/api/auth/password-reset/confirm", {"token": token, "new_password": password}, format="json")

    def test_unknown_and_known_email_get_the_same_answer(self):
        known, unknown = self.request(), self.request("tidak-ada@campus.test")
        self.assertEqual((known.status_code, known.json()), (unknown.status_code, unknown.json()))
        self.assertEqual(known.status_code, 202)
        self.assertEqual(len(mail.outbox), 1)
        self.assertEqual(mail.outbox[0].to, ["mhs@campus.test"])

    def test_link_sets_new_password_once_and_revokes_sessions(self):
        token_before = create_access_token(self.profile)
        self.request()
        token = self.token_from_mail()
        stored = PasswordResetToken.objects.get()
        self.assertNotEqual(stored.token_hash, token)  # hanya hash yang disimpan

        self.assertEqual(self.confirm(token).status_code, 200)
        self.profile.refresh_from_db()
        self.assertTrue(self.profile.check_password(NEW))
        self.assertFalse(AuthSession.objects.filter(profile=self.profile, revoked_at__isnull=True).exists())
        cache.clear()
        stale = APIClient()
        stale.credentials(HTTP_AUTHORIZATION=f"Bearer {token_before}")
        self.assertEqual(stale.get("/api/me").status_code, 401)

        again = self.confirm(token, "kata-sandi-lain-55")
        self.assertEqual(again.status_code, 400)
        self.profile.refresh_from_db()
        self.assertTrue(self.profile.check_password(NEW))

    def test_new_link_invalidates_the_previous_one(self):
        self.request()
        first = self.token_from_mail()
        PasswordResetToken.objects.update(created_at=timezone.now() - timedelta(minutes=5))
        self.request()
        self.assertEqual(self.confirm(first).status_code, 400)
        self.assertEqual(self.confirm(self.token_from_mail()).status_code, 200)

    def test_requests_within_a_minute_send_one_email(self):
        self.request()
        self.request()
        self.assertEqual(len(mail.outbox), 1)

    def test_expired_or_garbage_token_is_refused(self):
        self.request()
        token = self.token_from_mail()
        PasswordResetToken.objects.update(expires_at=timezone.now() - timedelta(seconds=1))
        self.assertEqual(self.confirm(token).status_code, 400)
        self.assertEqual(self.confirm("bukan-token").status_code, 400)

    def test_weak_password_keeps_the_link_usable(self):
        self.request()
        token = self.token_from_mail()
        weak = self.confirm(token, "12345678")
        self.assertEqual(weak.status_code, 400)
        self.assertEqual(self.confirm(token).status_code, 200)

    def test_smtp_failure_does_not_break_the_request(self):
        with mock.patch("apps.accounts.password_reset.send_mail", side_effect=OSError("smtp mati")):
            self.assertEqual(self.request().status_code, 202)

    def test_request_is_throttled(self):
        codes = [self.request(f"u{i}@campus.test").status_code for i in range(11)]
        self.assertEqual(codes[-1], 429)
