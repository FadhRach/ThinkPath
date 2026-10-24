"""Tes daftar dosen dan teman sekelas.

Yang dijaga: hanya mahasiswa anggota yang melihat; dosen dan orang luar mendapat 404/403;
email tidak pernah bocor, termasuk untuk akun tanpa nama tampil.
"""
from __future__ import annotations

from django.test import TestCase
from rest_framework.test import APIClient

from apps.academics.models import Class, ClassMembership
from apps.accounts.authentication import create_access_token
from apps.accounts.models import EducationLevel, Profile, Role


def _client(profile: Profile) -> APIClient:
    client = APIClient()
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {create_access_token(profile)}")
    return client


class ClassPeopleTests(TestCase):
    def setUp(self):
        self.dosen = Profile.objects.create(email="d@t.local", display_name="Dosen Uji", role=Role.TEACHER)
        self.a = Profile.objects.create(email="a@t.local", display_name="Ani", role=Role.STUDENT)
        self.b = Profile.objects.create(email="b@t.local", display_name="", role=Role.STUDENT)
        self.luar = Profile.objects.create(email="x@t.local", display_name="Luar", role=Role.STUDENT)
        self.kelas = Class.objects.create(
            owner=self.dosen, name="Ekonomi B", subject="Ekonomi",
            education_level=EducationLevel.S1, join_code="EP-PEOPL1",
        )
        for student in (self.a, self.b):
            ClassMembership.objects.create(class_ref=self.kelas, student_profile=student)
        self.url = f"/api/classes/{self.kelas.id}/people"

    def test_member_sees_teacher_and_classmates(self):
        response = _client(self.a).get(self.url)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["teacher"], {"display_name": "Dosen Uji"})
        self.assertEqual(
            [(s["display_name"], s["is_me"]) for s in response.data["students"]],
            [("Mahasiswa", False), ("Ani", True)],
        )

    def test_email_never_leaks(self):
        body = _client(self.a).get(self.url).content.decode()
        self.assertNotIn("@t.local", body)

    def test_non_member_gets_404(self):
        self.assertEqual(_client(self.luar).get(self.url).status_code, 404)

    def test_teacher_is_refused(self):
        self.assertEqual(_client(self.dosen).get(self.url).status_code, 403)

    def test_anonymous_is_refused(self):
        self.assertIn(APIClient().get(self.url).status_code, (401, 403))

    def test_archived_class_without_owner_still_lists(self):
        Class.objects.filter(pk=self.kelas.pk).update(owner=None)
        response = _client(self.a).get(self.url)
        self.assertEqual(response.status_code, 200)
        self.assertIsNone(response.data["teacher"])
