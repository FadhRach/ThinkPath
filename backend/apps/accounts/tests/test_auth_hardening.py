"""Pengerasan autentikasi tahap 1: sandi, waktu login, token, dan throttle per akun."""
from __future__ import annotations

import subprocess
import sys
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path
from unittest.mock import patch

import jwt
from django.conf import settings
from django.core.cache import cache
from django.test import TestCase
from rest_framework.test import APIClient

from apps.accounts.authentication import create_access_token, signing_key
from apps.accounts.models import AuthSession, ConsentAction, ConsentRecord, Profile, Role
from apps.accounts.privacy import PRIVACY_POLICY_VERSION, REQUIRED_ITEMS, record_consent
from apps.accounts.services import authenticate_credentials

BASE_DIR = Path(settings.BASE_DIR)


def register(client: APIClient, **overrides):
    return client.post(
        "/api/auth/register",
        {
            "email": "baru@campus.test",
            "password": "kata-sandi-aman-91",
            "display_name": "Budi Santoso",
            "role": Role.STUDENT,
            "accept_policy": True,
            "policy_version": PRIVACY_POLICY_VERSION,
            **overrides,
        },
        format="json",
    )


class PasswordPolicyTest(TestCase):
    def setUp(self):
        cache.clear()
        self.client = APIClient()

    def test_weak_passwords_are_refused(self):
        for password in ("pendek1", "1234567890", "password123", "baru@campus.test", "budisantoso"):
            with self.subTest(password=password):
                response = register(self.client, password=password)
                self.assertEqual(response.status_code, 400, password)
        self.assertFalse(Profile.objects.exists())

    def test_messages_are_in_indonesian(self):
        body = str(register(self.client, password="1234567").json())
        for fragment in ("minimal 10 karakter", "terlalu umum", "hanya berisi angka"):
            self.assertIn(fragment, body)
        self.assertNotIn("This password", body)

    def test_strong_password_is_accepted(self):
        self.assertEqual(register(self.client).status_code, 201)

    def test_stale_frontend_bundle_gets_a_readable_message(self):
        response = self.client.post(
            "/api/auth/register",
            {"email": "x@campus.test", "password": "kata-sandi-aman-91", "display_name": "X", "role": Role.STUDENT},
            format="json",
        )
        self.assertEqual(response.status_code, 400)
        self.assertIn("Muat ulang", str(response.json()))


class LoginTimingTest(TestCase):
    def test_unknown_email_still_pays_for_a_password_hash(self):
        """Selisih waktu 138 ms vs 12 ms (terukur) membocorkan email terdaftar."""
        with patch("apps.accounts.services.check_password") as dummy:
            self.assertIsNone(authenticate_credentials("tidak-ada@campus.test", "apa-saja-123"))
        dummy.assert_called_once()


def forge(profile, **claims):
    """Token yang ditandatangani benar tetapi klaimnya kurang atau salah."""
    base = {
        "iss": settings.JWT_ISSUER,
        "aud": settings.JWT_AUDIENCE,
        "sub": str(profile.id),
        "sid": str(AuthSession.objects.create(
            profile=profile, expires_at=datetime.now(timezone.utc) + timedelta(days=1)
        ).pk),
        "iat": datetime.now(timezone.utc),
        "exp": datetime.now(timezone.utc) + timedelta(hours=1),
    }
    base.update(claims)
    return jwt.encode({k: v for k, v in base.items() if v is not None}, signing_key(), algorithm="HS256")


class TokenRequiredClaimsTest(TestCase):
    def setUp(self):
        self.profile = Profile.objects.create(email="m@campus.test", role=Role.STUDENT)
        self.client = APIClient()

    def _call(self, token: str):
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
        return self.client.get("/api/me")

    def test_valid_token_works(self):
        self.assertEqual(self._call(create_access_token(self.profile)).status_code, 200)
        self.assertEqual(self._call(forge(self.profile)).status_code, 200)

    def test_each_required_claim_is_enforced(self):
        for claim in ("exp", "iat", "sub", "sid", "iss", "aud"):
            with self.subTest(missing=claim):
                self.assertEqual(self._call(forge(self.profile, **{claim: None})).status_code, 401)

    def test_wrong_issuer_or_audience_is_refused(self):
        self.assertEqual(self._call(forge(self.profile, iss="orang-lain")).status_code, 401)
        self.assertEqual(self._call(forge(self.profile, aud="aplikasi-lain")).status_code, 401)

    def test_token_signed_with_the_raw_django_secret_is_refused(self):
        token = jwt.encode(
            {"sub": str(self.profile.id), "iat": datetime.now(timezone.utc), "exp": datetime.now(timezone.utc) + timedelta(hours=1)},
            settings.SECRET_KEY,
            algorithm="HS256",
        )
        self.assertEqual(self._call(token).status_code, 401)

    def test_token_for_a_session_of_someone_else_is_refused(self):
        other = Profile.objects.create(email="lain@campus.test", role=Role.STUDENT)
        sid = AuthSession.objects.create(profile=other, expires_at=datetime.now(timezone.utc) + timedelta(days=1)).pk
        self.assertEqual(self._call(forge(self.profile, sid=str(sid))).status_code, 401)


class SessionLifecycleTest(TestCase):
    def setUp(self):
        cache.clear()
        self.client = APIClient()
        self.password = "kata-sandi-aman-91"
        self.profile = Profile(email="s@campus.test", role=Role.STUDENT, display_name="Sari")
        self.profile.set_password(self.password)
        self.profile.save()

    def login(self) -> str:
        response = APIClient().post("/api/auth/login", {"email": "s@campus.test", "password": self.password}, format="json")
        self.assertEqual(response.status_code, 200)
        return response.json()["token"]

    def call(self, token: str, method="get", path="/api/me", **kwargs):
        client = APIClient()
        client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
        return getattr(client, method)(path, **kwargs)

    def test_logout_kills_the_token_on_the_server(self):
        token = self.login()
        self.assertEqual(self.call(token).status_code, 200)
        self.assertEqual(self.call(token, "post", "/api/auth/logout").status_code, 204)
        self.assertEqual(self.call(token).status_code, 401)

    def test_each_login_is_its_own_session(self):
        first, second = self.login(), self.login()
        self.call(first, "post", "/api/auth/logout")
        self.assertEqual(self.call(first).status_code, 401)
        self.assertEqual(self.call(second).status_code, 200)

    def test_expired_session_is_refused_even_with_a_valid_signature(self):
        token = self.login()
        AuthSession.objects.update(expires_at=datetime.now(timezone.utc) - timedelta(seconds=1))
        cache.clear()
        self.assertEqual(self.call(token).status_code, 401)

    def test_deleting_the_account_ends_the_session(self):
        token = self.login()
        self.profile.delete()
        cache.clear()
        self.assertEqual(self.call(token).status_code, 401)

    def test_consent_refresh_keeps_the_same_session(self):
        token = self.login()
        before = AuthSession.objects.count()
        body = {"policy_version": PRIVACY_POLICY_VERSION}
        response = self.call(token, "post", "/api/me/consent", data=body, format="json")
        self.assertEqual(response.status_code, 201)
        self.assertEqual(AuthSession.objects.count(), before)
        self.assertEqual(self.call(response.json()["token"]).status_code, 200)

    def test_password_change_revokes_other_sessions_but_not_this_one(self):
        mine, other = self.login(), self.login()
        response = self.call(mine, "post", "/api/me/password",
                             data={"current_password": self.password, "new_password": "sandi-yang-baru-77"}, format="json")
        self.assertEqual(response.status_code, 200, response.content)
        self.assertEqual(self.call(mine).status_code, 200)
        self.assertEqual(self.call(other).status_code, 401)
        self.profile.refresh_from_db()
        self.assertTrue(self.profile.check_password("sandi-yang-baru-77"))

    def test_password_change_rules(self):
        token = self.login()
        cases = {
            "salah": {"current_password": "bukan-sandinya", "new_password": "sandi-yang-baru-77"},
            "sama": {"current_password": self.password, "new_password": self.password},
            "lemah": {"current_password": self.password, "new_password": "1234567890"},
            "mirip email": {"current_password": self.password, "new_password": "s@campus.test"},
        }
        for label, data in cases.items():
            with self.subTest(label):
                cache.clear()
                self.assertEqual(self.call(token, "post", "/api/me/password", data=data, format="json").status_code, 400)
        self.profile.refresh_from_db()
        self.assertTrue(self.profile.check_password(self.password))


class UploadTicketTest(TestCase):
    def setUp(self):
        cache.clear()
        self.student = Profile.objects.create(email="mhs@campus.test", role=Role.STUDENT)
        record_consent(self.student.id, ConsentAction.GIVEN, REQUIRED_ITEMS[Role.STUDENT])
        self.token = create_access_token(self.student)

    def ticket(self) -> str:
        client = APIClient()
        client.credentials(HTTP_AUTHORIZATION=f"Bearer {self.token}")
        response = client.post("/api/auth/upload-ticket")
        self.assertEqual(response.status_code, 200)
        return response.json()["ticket"]

    def call(self, token, method, path, **kwargs):
        client = APIClient()
        client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
        return getattr(client, method)(path, **kwargs)

    def test_ticket_is_refused_on_ordinary_endpoints(self):
        ticket = self.ticket()
        for method, path in (("get", "/api/me"), ("get", "/api/student/classes"), ("get", "/api/notifications"),
                             ("post", "/api/auth/upload-ticket"), ("post", "/api/me/password")):
            with self.subTest(path=path):
                self.assertEqual(self.call(ticket, method, path).status_code, 401)

    def test_ticket_is_accepted_where_declared(self):
        ticket = self.ticket()
        # 404 (tugas tidak ada), bukan 401: autentikasi lolos, rutenya yang kosong.
        response = self.call(ticket, "get", f"/api/assignments/{uuid.uuid4()}/documents/{uuid.uuid4()}")
        self.assertEqual(response.status_code, 404)

    def test_ticket_dies_with_the_session(self):
        ticket = self.ticket()
        self.call(self.token, "post", "/api/auth/logout")
        response = self.call(ticket, "get", f"/api/assignments/{uuid.uuid4()}/documents/{uuid.uuid4()}")
        self.assertEqual(response.status_code, 401)


class PerAccountLoginThrottleTest(TestCase):
    def test_guessing_one_account_from_many_ips_is_stopped(self):
        cache.clear()
        Profile.objects.create(email="korban@campus.test", role=Role.STUDENT)
        statuses = []
        for attempt in range(12):
            client = APIClient()
            # IP berbeda tiap percobaan, jadi batas per IP tidak pernah terpicu.
            response = client.post(
                "/api/auth/login",
                {"email": "korban@campus.test", "password": f"tebakan-{attempt}"},
                format="json",
                REMOTE_ADDR=f"10.0.0.{attempt + 1}",
            )
            statuses.append(response.status_code)
        self.assertEqual(statuses[:10], [401] * 10)
        self.assertEqual(statuses[10:], [429, 429])


class ConsentIdempotentTest(TestCase):
    def test_second_consent_call_does_not_move_the_proof(self):
        cache.clear()
        profile = Profile.objects.create(email="m@campus.test", role=Role.STUDENT)
        client = APIClient()
        client.credentials(HTTP_AUTHORIZATION=f"Bearer {create_access_token(profile)}")
        body = {"policy_version": PRIVACY_POLICY_VERSION}
        self.assertEqual(client.post("/api/me/consent", body, format="json").status_code, 201)
        again = client.post("/api/me/consent", body, format="json")
        self.assertEqual(again.status_code, 200)
        self.assertEqual(ConsentRecord.objects.filter(profile=profile, action=ConsentAction.GIVEN).count(), 1)

    def test_reaccept_after_withdrawal_still_records_a_new_row(self):
        profile = Profile.objects.create(email="n@campus.test", role=Role.STUDENT)
        record_consent(profile.id, ConsentAction.GIVEN, REQUIRED_ITEMS[Role.STUDENT])
        record_consent(profile.id, ConsentAction.WITHDRAWN, [])
        client = APIClient()
        client.credentials(HTTP_AUTHORIZATION=f"Bearer {create_access_token(profile)}")
        response = client.post("/api/me/consent", {"policy_version": PRIVACY_POLICY_VERSION}, format="json")
        self.assertEqual(response.status_code, 201)


class ProductionSecretTest(TestCase):
    def _boot(self, secret: str) -> subprocess.CompletedProcess:
        code = "import config.settings.production"
        env = {"DJANGO_SECRET_KEY": secret, "API_DOMAIN": "api.example.com", "PATH": "/usr/bin:/bin"}
        return subprocess.run([sys.executable, "-c", code], cwd=BASE_DIR, env=env, capture_output=True, text=True)

    def test_short_secret_refuses_to_boot(self):
        result = self._boot("terlalu-pendek")
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("minimal 32", result.stderr)

    def test_long_secret_boots(self):
        self.assertEqual(self._boot("k" * 40).returncode, 0)
