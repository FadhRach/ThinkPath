"""Tes jawaban kaya (editor): pembersihan dokumen, teks polos turunan server, dan batas kirim.

Yang dijaga:
1. Teks polos selalu diturunkan server dari dokumen; teks kiriman klien diabaikan bila ada rich_answer.
2. Elemen/atribut di luar daftar putih ditolak: tidak ada HTML mentah, skrip, atau tautan javascript:.
3. Minimal 5 kata untuk mengumpulkan (draf tidak dibatasi); tenggat tetap menutup pengumpulan.
4. Draf dan jawaban menyimpan dokumen; revisi menggantinya; mahasiswa lain tidak melihatnya.
"""
from __future__ import annotations

from datetime import timedelta
from unittest.mock import patch

from django.core.cache import cache
from django.test import TestCase
from django.utils import timezone
from rest_framework.exceptions import ValidationError
from rest_framework.test import APIClient

from apps.academics.models import Assignment, Class, ClassMembership, Submission, SubmissionDraft
from apps.academics.services.rich_text import clean_rich_doc, rich_to_plain
from apps.accounts.authentication import create_access_token
from apps.accounts.models import ConsentAction, EducationLevel, Profile, Role
from apps.accounts.privacy import REQUIRED_ITEMS, record_consent


def para(*content):
    return {"type": "paragraph", "content": list(content)}


def text(value, *marks):
    node = {"type": "text", "text": value}
    if marks:
        node["marks"] = [{"type": mark} for mark in marks]
    return node


def doc(*blocks):
    return {"type": "doc", "content": list(blocks)}


class CleanDocTest(TestCase):
    def test_plain_text_is_derived_from_blocks(self):
        cleaned = clean_rich_doc(
            doc(
                para(text("Halo ", "bold"), text("dunia")),
                {"type": "bulletList", "content": [
                    {"type": "listItem", "content": [para(text("satu"))]},
                    {"type": "listItem", "content": [para(text("dua"))]},
                ]},
                {"type": "blockMath", "attrs": {"latex": "x^2"}},
            )
        )
        self.assertEqual(rich_to_plain(cleaned), "Halo dunia\n\nsatu\ndua")

    def test_table_cells_are_tab_separated_and_math_is_skipped(self):
        cleaned = clean_rich_doc(
            doc(
                {"type": "table", "content": [{"type": "tableRow", "content": [
                    {"type": "tableCell", "content": [para(text("a"))]},
                    {"type": "tableCell", "content": [
                        para(text("b"), {"type": "inlineMath", "attrs": {"latex": "y"}})
                    ]},
                ]}]}
            )
        )
        self.assertEqual(rich_to_plain(cleaned), "a\tb")

    def test_unknown_node_and_mark_are_refused(self):
        with self.assertRaises(ValidationError):
            clean_rich_doc(doc({"type": "script", "content": []}))
        with self.assertRaises(ValidationError):
            clean_rich_doc(doc(para({"type": "text", "text": "x", "marks": [{"type": "highlight"}]})))

    def test_javascript_links_are_refused(self):
        bad = {"type": "text", "text": "klik", "marks": [{"type": "link", "attrs": {"href": "javascript:alert(1)"}}]}
        with self.assertRaises(ValidationError):
            clean_rich_doc(doc(para(bad)))

    def test_only_small_raster_images_are_allowed(self):
        ok = {"type": "image", "attrs": {"src": "data:image/png;base64,iVBORw0KGgo=", "alt": "x"}}
        clean_rich_doc(doc(para(ok)))
        for src in ("https://evil.example/x.png", "data:image/svg+xml;base64,PHN2Zz4=", "data:text/html;base64,AAA="):
            with self.assertRaises(ValidationError):
                clean_rich_doc(doc(para({"type": "image", "attrs": {"src": src}})))

    def test_extra_attributes_are_dropped(self):
        node = {"type": "paragraph", "attrs": {"onclick": "x()", "style": "color:red"}, "content": [text("a")]}
        cleaned = clean_rich_doc(doc(node))
        self.assertNotIn("attrs", cleaned["content"][0])

    def test_depth_is_limited(self):
        nested = para(text("a"))
        for _ in range(15):
            nested = {"type": "blockquote", "content": [nested]}
        with self.assertRaises(ValidationError):
            clean_rich_doc(doc(nested))

    def test_not_a_doc_is_refused(self):
        for value in (None, [], {"type": "paragraph"}, "teks"):
            with self.assertRaises(ValidationError):
                clean_rich_doc(value)


def _client(profile):
    client = APIClient()
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {create_access_token(profile)}")
    return client


class RichApiTest(TestCase):
    def setUp(self):
        cache.clear()
        env = patch.dict("os.environ", {"GROQ_API_KEY": "", "WINSTON_API_KEY": ""})
        env.start()
        self.addCleanup(env.stop)
        self.dosen = Profile.objects.create(email="d@t.local", display_name="Dosen", role=Role.TEACHER)
        self.mhs = Profile.objects.create(email="m@t.local", display_name="Mhs", role=Role.STUDENT)
        self.lain = Profile.objects.create(email="l@t.local", display_name="Lain", role=Role.STUDENT)
        for student in (self.mhs, self.lain):
            record_consent(student.id, ConsentAction.GIVEN, REQUIRED_ITEMS[Role.STUDENT])
        self.kelas = Class.objects.create(
            owner=self.dosen, name="K", subject="S", education_level=EducationLevel.S1, join_code="RT-RICH01"
        )
        ClassMembership.objects.create(class_ref=self.kelas, student_profile=self.mhs)
        self.tugas = Assignment.objects.create(
            class_ref=self.kelas, title="T", expected_bloom_level=3,
            deadline=timezone.now() + timedelta(days=2),
        )
        self.submit_url = f"/api/assignments/{self.tugas.id}/submissions"
        self.draft_url = f"/api/assignments/{self.tugas.id}/draft"
        self.body = doc(para(text("Ketimpangan antarwilayah muncul karena investasi menumpuk", "bold")))

    def test_server_derives_text_and_ignores_client_text(self):
        response = _client(self.mhs).post(
            self.submit_url,
            {"rich_answer": self.body, "text_answer": "kata kata palsu yang berbeda sekali"},
            format="json",
        )
        self.assertEqual(response.status_code, 201, response.content)
        saved = Submission.objects.get()
        self.assertEqual(saved.text_answer, "Ketimpangan antarwilayah muncul karena investasi menumpuk")
        self.assertEqual(saved.rich_answer, clean_rich_doc(self.body))

    def test_fewer_than_five_words_cannot_be_submitted_but_draft_can(self):
        short = doc(para(text("hanya empat kata ini")))
        client = _client(self.mhs)
        self.assertEqual(client.post(self.submit_url, {"rich_answer": short}, format="json").status_code, 400)
        self.assertEqual(client.put(self.draft_url, {"rich_answer": short}, format="json").status_code, 200)
        self.assertEqual(SubmissionDraft.objects.get().rich_answer, clean_rich_doc(short))

    def test_plain_text_clients_still_work_with_the_word_minimum(self):
        client = _client(self.mhs)
        self.assertEqual(client.post(self.submit_url, {"text_answer": "satu dua"}, format="json").status_code, 400)
        ok = client.post(self.submit_url, {"text_answer": "satu dua tiga empat lima"}, format="json")
        self.assertEqual(ok.status_code, 201)
        self.assertIsNone(Submission.objects.get().rich_answer)

    def test_malicious_document_is_refused(self):
        bad = doc(para({"type": "text", "text": "x y z w v", "marks": [{"type": "link", "attrs": {"href": "javascript:1"}}]}))
        self.assertEqual(_client(self.mhs).post(self.submit_url, {"rich_answer": bad}, format="json").status_code, 400)

    def test_revision_replaces_the_document(self):
        client = _client(self.mhs)
        client.post(self.submit_url, {"rich_answer": self.body}, format="json")
        newer = doc(para(text("Versi revisi yang lebih panjang dan lengkap")))
        self.assertEqual(client.post(self.submit_url, {"rich_answer": newer}, format="json").status_code, 201)
        saved = Submission.objects.get()
        self.assertEqual(saved.revision_count, 1)
        self.assertEqual(saved.rich_answer, clean_rich_doc(newer))

    def test_deadline_closes_submission(self):
        Assignment.objects.filter(pk=self.tugas.pk).update(deadline=timezone.now() - timedelta(minutes=1))
        response = _client(self.mhs).post(self.submit_url, {"rich_answer": self.body}, format="json")
        self.assertEqual(response.status_code, 400)

    def test_detail_returns_the_document_only_to_the_owner(self):
        _client(self.mhs).post(self.submit_url, {"rich_answer": self.body}, format="json")
        url = f"/api/student/assignments/{self.tugas.id}"
        own = _client(self.mhs).get(url)
        self.assertEqual(own.data["submission"]["rich_answer"], clean_rich_doc(self.body))
        self.assertEqual(_client(self.lain).get(url).status_code, 404)

    def test_draft_is_returned_with_the_document(self):
        _client(self.mhs).put(self.draft_url, {"rich_answer": self.body}, format="json")
        detail = _client(self.mhs).get(f"/api/student/assignments/{self.tugas.id}")
        self.assertEqual(detail.data["draft"]["rich_answer"], clean_rich_doc(self.body))
