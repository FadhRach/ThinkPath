"""Tes instruksi tugas berformat.

Yang dijaga: teks polos diturunkan server dari dokumen; daftar tidak memuat dokumen (gambar bisa
besar) sedangkan detail memuatnya; dokumen berbahaya ditolak; hanya dosen pemilik yang mengubah.
"""
from __future__ import annotations

from datetime import timedelta

from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from apps.academics.models import Assignment, Class, ClassMembership
from apps.accounts.authentication import create_access_token
from apps.accounts.models import EducationLevel, Profile, Role


def _client(profile):
    client = APIClient()
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {create_access_token(profile)}")
    return client


def doc(text):
    return {"type": "doc", "content": [{"type": "paragraph", "content": [{"type": "text", "text": text}]}]}


class AssignmentRichTest(TestCase):
    def setUp(self):
        self.dosen = Profile.objects.create(email="d@t.local", display_name="Dosen", role=Role.TEACHER)
        self.lain = Profile.objects.create(email="d2@t.local", display_name="Lain", role=Role.TEACHER)
        self.mhs = Profile.objects.create(email="m@t.local", display_name="Mhs", role=Role.STUDENT)
        self.kelas = Class.objects.create(
            owner=self.dosen, name="K", subject="S", education_level=EducationLevel.S1, join_code="AR-RICH01"
        )
        ClassMembership.objects.create(class_ref=self.kelas, student_profile=self.mhs)
        self.deadline = (timezone.now() + timedelta(days=3)).isoformat()
        self.url = f"/api/classes/{self.kelas.id}/assignments"

    def create(self, **extra):
        body = {"title": "T", "deadline": self.deadline, "expected_bloom_level": 3, **extra}
        return _client(self.dosen).post(self.url, body, format="json")

    def test_plain_text_is_derived_from_the_document(self):
        response = self.create(instructions_rich=doc("Bandingkan dua teori."), instructions="abaikan")
        self.assertEqual(response.status_code, 201, response.content)
        self.assertEqual(response.data["instructions"], "Bandingkan dua teori.")
        self.assertEqual(response.data["instructions_rich"], doc("Bandingkan dua teori."))

    def test_list_omits_the_document_but_detail_has_it(self):
        created = self.create(instructions_rich=doc("Isi instruksi")).data
        listing = _client(self.dosen).get(self.url).data[0]
        self.assertNotIn("instructions_rich", listing)
        detail = _client(self.dosen).get(f"/api/assignments/{created['id']}").data
        self.assertEqual(detail["instructions_rich"], doc("Isi instruksi"))

    def test_student_detail_has_it_but_the_class_list_does_not(self):
        created = self.create(instructions_rich=doc("Untuk mahasiswa")).data
        student = _client(self.mhs)
        detail = student.get(f"/api/student/assignments/{created['id']}").data
        self.assertEqual(detail["assignment"]["instructions_rich"], doc("Untuk mahasiswa"))
        classes = student.get("/api/student/classes").data
        self.assertNotIn("instructions_rich", classes[0]["assignments"][0])

    def test_plain_instructions_only_clears_the_document(self):
        created = self.create(instructions_rich=doc("Versi kaya")).data
        response = _client(self.dosen).patch(
            f"/api/assignments/{created['id']}", {"instructions": "Versi polos"}, format="json"
        )
        self.assertEqual(response.status_code, 200)
        self.assertIsNone(response.data["instructions_rich"])
        self.assertEqual(response.data["instructions"], "Versi polos")

    def test_malicious_document_is_refused(self):
        bad = {"type": "doc", "content": [{"type": "paragraph", "content": [
            {"type": "text", "text": "x", "marks": [{"type": "link", "attrs": {"href": "javascript:1"}}]}
        ]}]}
        self.assertEqual(self.create(instructions_rich=bad).status_code, 400)

    def test_other_teacher_cannot_edit(self):
        created = self.create(instructions_rich=doc("Milik saya")).data
        response = _client(self.lain).patch(
            f"/api/assignments/{created['id']}", {"instructions_rich": doc("Curian")}, format="json"
        )
        self.assertEqual(response.status_code, 404)
        self.assertEqual(Assignment.objects.get(pk=created["id"]).instructions, "Milik saya")
