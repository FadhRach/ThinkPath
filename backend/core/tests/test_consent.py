"""Tes persetujuan pemrosesan data pribadi.

Yang dijaga, masing-masing dengan pasal UU No. 27 Tahun 2022 yang mendasarinya:

1. Persetujuan terekam dan buktinya bisa ditunjukkan (Pasal 22 ayat (1), 24):
   setiap peristiwa menjadi baris baru, tidak ada yang ditimpa.
2. Butir untuk tujuan berbeda dapat dibedakan (Pasal 22 ayat (4)): butir wajib
   harus dicentang semua, butir yang tidak dikenal ditolak.
3. Penarikan menghentikan pemrosesan baru (Pasal 9, 40), termasuk dari token
   lama yang masih memuat klaim persetujuan.
4. Teks jawaban hanya dikirim ke penyedia di luar negeri bila mahasiswa
   mengizinkan (Pasal 56 ayat (4)).
5. Perubahan kebijakan meminta persetujuan ulang (Pasal 21 ayat (2)).
"""
from __future__ import annotations

import re
from datetime import timedelta
from pathlib import Path
from unittest.mock import patch

import jwt
import requests
from django.conf import settings
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from academics.models import (
    AnalysisSource,
    Assignment,
    Class,
    ClassMembership,
    Submission,
)
from core import privacy
from core.authentication import create_access_token
from core.models import ConsentAction, ConsentRecord, EducationLevel, Profile, Role

ANSWER = (
    "Ketimpangan antarwilayah muncul karena investasi menumpuk di kota besar. "
    "Akibatnya daerah tertinggal kekurangan lapangan kerja dan layanan dasar."
)
STUDENT_REQUIRED = list(privacy.REQUIRED_ITEMS[Role.STUDENT])
TEACHER_REQUIRED = list(privacy.REQUIRED_ITEMS[Role.TEACHER])


def claims(token: str) -> dict:
    return jwt.decode(token, settings.SECRET_KEY, algorithms=["HS256"])


class ConsentTestBase(TestCase):
    def setUp(self):
        env = patch.dict("os.environ", {"GROQ_API_KEY": "", "WINSTON_API_KEY": ""})
        env.start()
        self.addCleanup(env.stop)

        self.dosen = Profile.objects.create(
            email="dosen@test.local", display_name="Dosen Uji", role=Role.TEACHER
        )
        self.mhs = Profile.objects.create(
            email="mhs@test.local", display_name="Mahasiswa Uji", role=Role.STUDENT
        )
        kelas = Class.objects.create(
            owner=self.dosen,
            name="Ekonomi Pembangunan B",
            subject="Ekonomi Pembangunan",
            education_level=EducationLevel.S1,
            join_code="EP-3B1XY",
        )
        ClassMembership.objects.create(class_ref=kelas, student_profile=self.mhs)
        self.assignment = Assignment.objects.create(
            class_ref=kelas,
            title="Ketimpangan antarwilayah",
            instructions="",
            deadline=timezone.now() + timedelta(days=7),
            expected_bloom_level=4,
        )

    def client_for(self, profile: Profile, token: str | None = None) -> APIClient:
        client = APIClient()
        client.credentials(
            HTTP_AUTHORIZATION=f"Bearer {token or create_access_token(profile)}"
        )
        return client

    def give(self, profile: Profile, items: list[str], version: str | None = None):
        return self.client_for(profile).post(
            "/api/me/consent",
            {"policy_version": version or privacy.PRIVACY_POLICY_VERSION, "items": items},
            format="json",
        )

    def submit(self, token: str | None = None):
        return self.client_for(self.mhs, token).post(
            f"/api/assignments/{self.assignment.id}/submissions",
            {"text_answer": ANSWER},
            format="json",
        )


class GivingConsentTest(ConsentTestBase):
    def test_new_account_has_no_consent_and_cannot_submit(self):
        self.assertIsNone(claims(create_access_token(self.mhs))["consent"])
        status = self.client_for(self.mhs).get("/api/me/consent").data
        self.assertEqual(status["status"], "none")

        response = self.submit()
        self.assertEqual(response.status_code, 403)
        self.assertIn("Kebijakan Privasi", str(response.data["detail"]))
        self.assertFalse(Submission.objects.exists())

    def test_consent_returns_a_fresh_token_and_unlocks_submission(self):
        response = self.give(self.mhs, STUDENT_REQUIRED)
        self.assertEqual(response.status_code, 201)
        self.assertEqual(claims(response.data["token"])["consent"], privacy.PRIVACY_POLICY_VERSION)
        self.assertEqual(response.data["consent"]["status"], "given")
        self.assertFalse(response.data["consent"]["external_ai"])

        record = ConsentRecord.objects.get(profile=self.mhs)
        self.assertEqual(record.action, ConsentAction.GIVEN)
        self.assertEqual(record.items, sorted(STUDENT_REQUIRED))
        self.assertEqual(self.submit().status_code, 201)

    def test_every_required_item_must_be_agreed_separately(self):
        for items in (STUDENT_REQUIRED[:-1], [], [*STUDENT_REQUIRED, "jual_data"]):
            response = self.give(self.mhs, items)
            self.assertEqual(response.status_code, 400, items)
        self.assertFalse(ConsentRecord.objects.exists())

    def test_consent_for_an_old_policy_version_is_refused(self):
        response = self.give(self.mhs, STUDENT_REQUIRED, version="2020-01-01")
        self.assertEqual(response.status_code, 400)
        self.assertFalse(ConsentRecord.objects.exists())

    def test_teacher_agrees_to_duties_and_has_no_external_option(self):
        self.assertEqual(self.give(self.dosen, [privacy.ITEM_COURSE_DATA]).status_code, 400)
        self.assertEqual(
            self.give(
                self.dosen, [*TEACHER_REQUIRED, privacy.ITEM_EXTERNAL_AI]
            ).status_code,
            400,
        )
        self.assertEqual(self.give(self.dosen, TEACHER_REQUIRED).status_code, 201)
        response = self.client_for(self.dosen).patch(
            "/api/me/consent", {"external_ai": True}, format="json"
        )
        self.assertEqual(response.status_code, 400)


class ChangingConsentTest(ConsentTestBase):
    def test_optional_choice_is_recorded_as_new_rows_only_when_it_changes(self):
        self.give(self.mhs, STUDENT_REQUIRED)
        client = self.client_for(self.mhs)
        on = client.patch("/api/me/consent", {"external_ai": True}, format="json")
        self.assertTrue(on.data["consent"]["external_ai"])
        client.patch("/api/me/consent", {"external_ai": True}, format="json")
        off = client.patch("/api/me/consent", {"external_ai": False}, format="json")
        self.assertFalse(off.data["consent"]["external_ai"])

        actions = [row["action"] for row in off.data["consent"]["history"]]
        self.assertEqual(actions, ["updated", "updated", "given"])
        self.assertEqual(ConsentRecord.objects.filter(profile=self.mhs).count(), 3)

    def test_optional_choice_needs_a_current_consent(self):
        response = self.client_for(self.mhs).patch(
            "/api/me/consent", {"external_ai": True}, format="json"
        )
        self.assertEqual(response.status_code, 400)

    def test_withdrawal_stops_new_processing_even_from_an_old_token(self):
        old_token = self.give(self.mhs, STUDENT_REQUIRED).data["token"]
        self.assertEqual(self.submit(old_token).status_code, 201)
        submission = Submission.objects.get()

        response = self.client_for(self.mhs, old_token).post("/api/me/consent/withdraw")
        self.assertEqual(response.data["consent"]["status"], "withdrawn")
        self.assertIsNone(claims(response.data["token"])["consent"])

        # Token lama masih memuat klaim persetujuan; server tetap menolak.
        self.assertEqual(claims(old_token)["consent"], privacy.PRIVACY_POLICY_VERSION)
        self.assertEqual(self.submit(old_token).status_code, 403)
        reanalyze = self.client_for(self.dosen).post(
            f"/api/submissions/{submission.id}/reanalyze"
        )
        self.assertEqual(reanalyze.status_code, 403)
        # Hasil yang sudah ada tidak ikut terhapus oleh penarikan.
        self.assertTrue(Submission.objects.filter(pk=submission.pk).exists())

    def test_history_is_append_only_and_private(self):
        self.give(self.mhs, STUDENT_REQUIRED)
        self.client_for(self.mhs).post("/api/me/consent/withdraw")
        self.give(self.mhs, STUDENT_REQUIRED)

        status = self.client_for(self.mhs).get("/api/me/consent").data
        self.assertEqual(
            [row["action"] for row in status["history"]], ["given", "withdrawn", "given"]
        )
        self.assertEqual(status["status"], "given")
        self.assertEqual(self.client_for(self.dosen).get("/api/me/consent").data["history"], [])

    def test_policy_update_asks_for_consent_again(self):
        self.give(self.mhs, STUDENT_REQUIRED)
        with patch.object(privacy, "PRIVACY_POLICY_VERSION", "2099-01-01"):
            status = self.client_for(self.mhs).get("/api/me/consent").data
            self.assertEqual(status["status"], "outdated")
            self.assertIsNone(claims(create_access_token(self.mhs))["consent"])
            self.assertEqual(self.submit().status_code, 403)
            self.assertEqual(self.give(self.mhs, STUDENT_REQUIRED).status_code, 201)
            self.assertEqual(self.submit().status_code, 201)


class ExternalAnalysisTest(ConsentTestBase):
    """Groq dan Winston hanya dipanggil bila mahasiswa mengizinkan."""

    def setUp(self):
        super().setUp()
        keys = patch.dict("os.environ", {"GROQ_API_KEY": "kunci", "WINSTON_API_KEY": "kunci"})
        keys.start()
        self.addCleanup(keys.stop)
        groq = patch(
            "academics.llm._call_groq", side_effect=requests.ConnectionError("uji")
        )
        detector = patch("academics.llm.detector_cache.detect_cached", return_value=None)
        self.groq = groq.start()
        self.detector = detector.start()
        self.addCleanup(groq.stop)
        self.addCleanup(detector.stop)

    def test_without_permission_nothing_leaves_the_server(self):
        self.give(self.mhs, STUDENT_REQUIRED)
        self.assertEqual(self.submit().status_code, 201)
        self.groq.assert_not_called()
        self.detector.assert_not_called()
        self.assertEqual(
            Submission.objects.get().analysis.analysis_source, AnalysisSource.HEURISTIC
        )

    def test_with_permission_the_external_chain_is_tried(self):
        self.give(self.mhs, [*STUDENT_REQUIRED, privacy.ITEM_EXTERNAL_AI])
        self.assertEqual(self.submit().status_code, 201)
        self.groq.assert_called_once()
        self.detector.assert_called_once()

    def test_turning_permission_off_applies_to_the_next_revision(self):
        self.give(self.mhs, [*STUDENT_REQUIRED, privacy.ITEM_EXTERNAL_AI])
        self.submit()
        self.client_for(self.mhs).patch(
            "/api/me/consent", {"external_ai": False}, format="json"
        )
        self.groq.reset_mock()
        self.detector.reset_mock()
        self.assertEqual(self.submit().status_code, 201)
        self.groq.assert_not_called()
        self.detector.assert_not_called()


class PolicyVersionSyncTest(TestCase):
    def test_frontend_shows_the_same_policy_version(self):
        # Halaman kebijakan dan layar persetujuan ada di frontend. Versi yang
        # berbeda berarti pengguna menyetujui teks yang tidak sama dengan yang
        # dicatat backend sebagai bukti.
        path = Path(settings.BASE_DIR).parent / "frontend" / "lib" / "privacy.ts"
        if not path.exists():
            self.skipTest("frontend tidak ada di checkout ini")
        match = re.search(
            r'PRIVACY_POLICY_VERSION\s*=\s*"([^"]+)"', path.read_text(encoding="utf-8")
        )
        self.assertIsNotNone(match)
        self.assertEqual(match.group(1), privacy.PRIVACY_POLICY_VERSION)
