"""Tes pipa ekstraksi dokumen (OCR).

Tidak ada satu pun tes di sini yang menyentuh jaringan nyata - pymupdf.open
dan call_vision_llm selalu di-mock. Ini mengikuti konvensi test_detector.py:
kegagalan penyedia eksternal harus dijawab jalur ini, bukan menjatuhkan
request mahasiswa, dan itu hanya bisa dibuktikan tanpa benar benar bergantung
pada penyedia tersebut hidup saat tes dijalankan.
"""
from __future__ import annotations

import os
from unittest.mock import patch

from django.test import SimpleTestCase, TestCase
from rest_framework.test import APIClient

from academics import document_extraction as ext
from academics.models import Assignment, Class, ClassMembership
from core.authentication import create_access_token
from core.models import EducationLevel, Profile, Role
from core.services import register_profile


class _FakePixmap:
    def tobytes(self, fmt):
        return b"fake-png-bytes"


class _FakePage:
    def __init__(self, text: str = ""):
        self._text = text

    def get_text(self):
        return self._text

    def get_pixmap(self, dpi=150):
        return _FakePixmap()


class _FakeDocument:
    def __init__(self, pages: list[_FakePage]):
        self._pages = pages

    @property
    def page_count(self):
        return len(self._pages)

    def load_page(self, index):
        return self._pages[index]


LONG_TEXT = "Ini paragraf hasil ekstraksi lapisan teks native yang cukup panjang untuk lolos ambang minimum."


class PdfTextLayerTest(SimpleTestCase):
    @patch.object(ext, "call_vision_llm")
    @patch.object(ext, "fetch_blob", return_value=b"dummy-pdf-bytes")
    @patch.object(ext.pymupdf, "open")
    def test_native_text_layer_skips_vision(self, mock_open, mock_fetch, mock_vision):
        mock_open.return_value = _FakeDocument([_FakePage(LONG_TEXT), _FakePage(LONG_TEXT)])

        result = ext.extract_document(
            blob_url="https://blob.test/a.pdf", content_type="application/pdf", filename="a.pdf"
        )

        mock_vision.assert_not_called()
        self.assertEqual(result.extraction_method, "pdf_text_layer")
        self.assertEqual(result.page_count, 2)
        self.assertIn(LONG_TEXT, result.text)

    @patch.object(ext, "call_vision_llm")
    @patch.object(ext, "fetch_blob", return_value=b"dummy-pdf-bytes")
    @patch.object(ext.pymupdf, "open")
    def test_scanned_pages_use_vision_per_page(self, mock_open, mock_fetch, mock_vision):
        mock_open.return_value = _FakeDocument([_FakePage(""), _FakePage("")])
        mock_vision.return_value = "Teks hasil vision."

        result = ext.extract_document(
            blob_url="https://blob.test/a.pdf", content_type="application/pdf", filename="a.pdf"
        )

        self.assertEqual(mock_vision.call_count, 2)
        self.assertEqual(result.extraction_method, "vision_llm")

    @patch.object(ext, "call_vision_llm")
    @patch.object(ext, "fetch_blob", return_value=b"dummy-pdf-bytes")
    @patch.object(ext.pymupdf, "open")
    def test_mixed_pages_report_mixed_method(self, mock_open, mock_fetch, mock_vision):
        mock_open.return_value = _FakeDocument([_FakePage(LONG_TEXT), _FakePage("")])
        mock_vision.return_value = "Teks hasil vision."

        result = ext.extract_document(
            blob_url="https://blob.test/a.pdf", content_type="application/pdf", filename="a.pdf"
        )

        self.assertEqual(result.extraction_method, "mixed")

    @patch.object(ext, "call_vision_llm", side_effect=ext.ExtractionError("failed", "gagal"))
    @patch.object(ext, "fetch_blob", return_value=b"dummy-pdf-bytes")
    @patch.object(ext.pymupdf, "open")
    def test_all_vision_calls_failing_is_a_hard_failure(self, mock_open, mock_fetch, mock_vision):
        """Kegagalan penuh tidak boleh diam-diam mengembalikan hasil kosong."""
        mock_open.return_value = _FakeDocument([_FakePage(""), _FakePage("")])

        with self.assertRaises(ext.ExtractionError) as ctx:
            ext.extract_document(
                blob_url="https://blob.test/a.pdf", content_type="application/pdf", filename="a.pdf"
            )
        self.assertEqual(ctx.exception.code, "failed")

    @patch.object(ext, "call_vision_llm")
    @patch.object(ext, "fetch_blob", return_value=b"dummy-pdf-bytes")
    @patch.object(ext.pymupdf, "open")
    def test_too_many_pages_rejected_before_iterating(self, mock_open, mock_fetch, mock_vision):
        mock_open.return_value = _FakeDocument([_FakePage(LONG_TEXT) for _ in range(ext.MAX_PAGES + 1)])

        with self.assertRaises(ext.ExtractionError) as ctx:
            ext.extract_document(
                blob_url="https://blob.test/a.pdf", content_type="application/pdf", filename="a.pdf"
            )
        self.assertEqual(ctx.exception.code, "too_many_pages")
        mock_vision.assert_not_called()


class UnsupportedAndOversizedTest(SimpleTestCase):
    @patch.object(ext, "fetch_blob")
    def test_unsupported_content_type_fails_fast(self, mock_fetch):
        with self.assertRaises(ext.ExtractionError) as ctx:
            ext.extract_document(
                blob_url="https://blob.test/a.txt", content_type="text/plain", filename="a.txt"
            )
        self.assertEqual(ctx.exception.code, "unsupported_type")
        mock_fetch.assert_not_called()

    @patch.object(ext, "fetch_blob", side_effect=ext.ExtractionError("too_large", "kelewat besar"))
    @patch.object(ext.pymupdf, "open")
    def test_oversized_file_never_reaches_pdf_parsing(self, mock_open, mock_fetch):
        with self.assertRaises(ext.ExtractionError) as ctx:
            ext.extract_document(
                blob_url="https://blob.test/a.pdf", content_type="application/pdf", filename="a.pdf"
            )
        self.assertEqual(ctx.exception.code, "too_large")
        mock_open.assert_not_called()


class ImageExtractionTest(SimpleTestCase):
    @patch.object(ext, "call_vision_llm", return_value="Teks dari gambar.")
    @patch.object(ext, "fetch_blob", return_value=b"dummy-image-bytes")
    def test_image_goes_straight_to_vision(self, mock_fetch, mock_vision):
        result = ext.extract_document(
            blob_url="https://blob.test/a.png", content_type="image/png", filename="a.png"
        )
        self.assertEqual(result.extraction_method, "vision_llm")
        self.assertEqual(result.page_count, 1)
        self.assertEqual(result.text, "Teks dari gambar.")

    @patch.object(ext, "call_vision_llm", side_effect=ext.ExtractionError("failed", "gagal"))
    @patch.object(ext, "fetch_blob", return_value=b"dummy-image-bytes")
    def test_image_vision_failure_propagates(self, mock_fetch, mock_vision):
        with self.assertRaises(ext.ExtractionError) as ctx:
            ext.extract_document(
                blob_url="https://blob.test/a.png", content_type="image/png", filename="a.png"
            )
        self.assertEqual(ctx.exception.code, "failed")


class VisionConfigTest(SimpleTestCase):
    @patch.dict(os.environ, {"GROQ_API_KEY": "", "GROQ_VISION_MODEL": ""})
    def test_missing_model_config_fails_without_crashing(self):
        with self.assertRaises(ext.ExtractionError) as ctx:
            ext.call_vision_llm(b"bytes", "image/png")
        self.assertEqual(ctx.exception.code, "failed")


class DocumentExtractViewTest(TestCase):
    PASSWORD = "rahasia123"

    def setUp(self):
        self.client = APIClient()
        self.teacher = register_profile(
            email="dosen@kampus.test", password=self.PASSWORD,
            display_name="Dosen Uji", role=Role.TEACHER,
        )
        self.student = register_profile(
            email="mhs@kampus.test", password=self.PASSWORD,
            display_name="Mahasiswa Uji", role=Role.STUDENT,
        )
        self.other_student = register_profile(
            email="lain@kampus.test", password=self.PASSWORD,
            display_name="Mahasiswa Lain", role=Role.STUDENT,
        )
        self.kelas = Class.objects.create(
            owner=self.teacher, name="Kelas Uji", subject="Uji",
            education_level=EducationLevel.S1, join_code="UJI-0001",
        )
        ClassMembership.objects.create(class_ref=self.kelas, student_profile=self.student)
        self.assignment = Assignment.objects.create(
            class_ref=self.kelas, title="Tugas Uji", expected_bloom_level=3,
        )

    def _auth_as(self, profile: Profile):
        token = create_access_token(profile)
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")

    def test_non_member_is_rejected(self):
        self._auth_as(self.other_student)
        response = self.client.post(
            f"/api/assignments/{self.assignment.id}/extract-document",
            {"blob_url": "https://blob.test/a.pdf", "content_type": "application/pdf", "filename": "a.pdf"},
            format="json",
        )
        self.assertEqual(response.status_code, 403)

    @patch.object(ext, "call_vision_llm")
    @patch.object(ext, "fetch_blob", return_value=b"dummy-pdf-bytes")
    @patch.object(ext.pymupdf, "open")
    def test_member_gets_extracted_text(self, mock_open, mock_fetch, mock_vision):
        mock_open.return_value = _FakeDocument([_FakePage(LONG_TEXT)])
        self._auth_as(self.student)

        response = self.client.post(
            f"/api/assignments/{self.assignment.id}/extract-document",
            {"blob_url": "https://blob.test/a.pdf", "content_type": "application/pdf", "filename": "a.pdf"},
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["extraction_method"], "pdf_text_layer")
        self.assertEqual(response.data["page_count"], 1)
        self.assertIn(LONG_TEXT, response.data["text"])
