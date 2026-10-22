"""Tes unggah dokumen jawaban (OCR).

Keputusan yang dijaga:

1. Jenis berkas ditentukan dari isinya, bukan nama atau content-type klien.
2. Halaman gambar hanya dikirim ke Groq bila mahasiswa mengizinkan analisis
   di luar negeri; DOCX dan PDF berlapis teks dibaca di server tanpa izin itu.
3. Unggahan tidak membuat Submission dan tersimpan di MEDIA_ROOT.
4. Jawaban yang terbukti berasal dari dokumen melewati forensik proses (tanpa
   jejak mengetik, ia akan terbaca sebagai tempelan). Klaim palsu tidak
   melewatkannya.

Tidak ada tes yang menyentuh jaringan: Groq di-mock.
"""
from __future__ import annotations

import io
import tempfile
import zipfile
from datetime import timedelta
from pathlib import Path
from unittest.mock import patch

import pymupdf
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient

from apps.academics.models import Assignment, Class, ClassMembership, Submission
from apps.academics.services import documents
from apps.accounts.authentication import create_access_token
from apps.accounts.models import ConsentAction, EducationLevel, Profile, Role
from apps.accounts.privacy import ITEM_EXTERNAL_AI, REQUIRED_ITEMS, record_consent
from common.throttling import PerUserScopedThrottle

ANSWER = " ".join(
    [
        "Ketimpangan antarwilayah muncul karena investasi menumpuk di kota besar.",
        "Akibatnya daerah tertinggal kekurangan lapangan kerja dan layanan dasar.",
        "Menurut saya kebijakan transfer fiskal perlu dikaitkan dengan kinerja layanan.",
        "Namun syarat kinerja bisa merugikan daerah yang kapasitasnya paling lemah.",
        "Karena itu pendampingan teknis sebaiknya diberikan sebelum target ditagih.",
    ]
    * 3
)
OCR_TEXT = "Hasil bacaan model visual untuk halaman scan ini."


def make_docx(text: str) -> bytes:
    xml = (
        '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">'
        f"<w:body><w:p><w:r><w:t>{text}</w:t></w:r></w:p></w:body></w:document>"
    )
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w") as archive:
        archive.writestr("word/document.xml", xml)
    return buffer.getvalue()


def make_docx_with_heading(heading: str, body: str) -> bytes:
    xml = (
        '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>'
        f'<w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr><w:r><w:t>{heading}</w:t></w:r></w:p>'
        f"<w:p><w:r><w:t>{body}</w:t></w:r></w:p></w:body></w:document>"
    )
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w") as archive:
        archive.writestr("word/document.xml", xml)
    return buffer.getvalue()


def make_pdf(text: str | None) -> bytes:
    """PDF satu halaman; text=None menghasilkan halaman tanpa lapisan teks."""
    document = pymupdf.open()
    page = document.new_page()
    if text:
        page.insert_textbox(pymupdf.Rect(40, 40, 550, 800), text, fontsize=11)
    return document.tobytes()


def make_png() -> bytes:
    """Gambar murni (tanpa lapisan teks), seperti foto atau hasil scan."""
    page = pymupdf.open().new_page(width=300, height=200)
    page.insert_text((20, 100), "tulisan tangan", fontsize=18)
    return page.get_pixmap().tobytes("png")


class DocumentTestCase(TestCase):
    def setUp(self):
        media = tempfile.TemporaryDirectory()
        self.addCleanup(media.cleanup)
        self.media_root = Path(media.name)
        settings = override_settings(MEDIA_ROOT=media.name)
        settings.enable()
        self.addCleanup(settings.disable)
        env = patch.dict("os.environ", {"GROQ_API_KEY": "test-key", "WINSTON_API_KEY": ""})
        env.start()
        self.addCleanup(env.stop)

        self.teacher = Profile.objects.create(
            email="dosen@test.local", display_name="Dosen Uji", role=Role.TEACHER
        )
        self.student = Profile.objects.create(
            email="mhs@test.local", display_name="Mahasiswa Uji", role=Role.STUDENT
        )
        kelas = Class.objects.create(
            owner=self.teacher,
            name="Ekonomi Pembangunan B",
            subject="Ekonomi Pembangunan",
            education_level=EducationLevel.S1,
            program_studi="Ilmu Ekonomi",
            semester=3,
            join_code="EP-3B1XY",
        )
        ClassMembership.objects.create(class_ref=kelas, student_profile=self.student)
        record_consent(self.student.id, ConsentAction.GIVEN, REQUIRED_ITEMS[Role.STUDENT])
        self.assignment = Assignment.objects.create(
            class_ref=kelas,
            title="Ketimpangan antarwilayah",
            instructions="",
            deadline=timezone.now() + timedelta(days=7),
            expected_bloom_level=4,
            allow_file_upload=True,
        )

    def allow_external(self):
        record_consent(
            self.student.id,
            ConsentAction.UPDATED,
            (*REQUIRED_ITEMS[Role.STUDENT], ITEM_EXTERNAL_AI),
        )

    @staticmethod
    def client_for(profile: Profile) -> APIClient:
        client = APIClient()
        client.credentials(HTTP_AUTHORIZATION=f"Bearer {create_access_token(profile)}")
        return client

    def upload(self, data: bytes, name: str = "jawaban.bin", student: Profile | None = None):
        return self.client_for(student or self.student).post(
            f"/api/assignments/{self.assignment.id}/documents",
            {"file": SimpleUploadedFile(name, data)},
            format="multipart",
        )

    def submit(self, **extra):
        return self.client_for(self.student).post(
            f"/api/assignments/{self.assignment.id}/submissions",
            {"text_answer": ANSWER, **extra},
            format="json",
        )


class UploadTest(DocumentTestCase):
    def test_docx_is_read_on_server_and_saved_with_its_text(self):
        response = self.upload(make_docx(ANSWER))

        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data["method"], "text")
        self.assertIn("Ketimpangan antarwilayah", response.data["text"])
        folder = self.media_root / "documents" / str(self.student.id)
        stored = {path.suffix for path in folder.iterdir()}
        self.assertEqual(stored, {".docx", ".txt"})
        self.assertEqual(
            (folder / f"{response.data['document_id']}.txt").read_text(encoding="utf-8"),
            response.data["text"],
        )
        self.assertFalse(Submission.objects.exists())

    def test_headings_get_no_forced_period_but_body_does(self):
        data = make_docx_with_heading("1. Pendahuluan", "Paragraf isi tanpa titik di akhir")

        response = self.upload(data)

        self.assertEqual(
            response.data["text"], "1. Pendahuluan\n\nParagraf isi tanpa titik di akhir."
        )

    def test_pdf_drops_repeated_footers_and_joins_split_sentences(self):
        pdf = pymupdf.open()
        for number, body in ((1, "Kalimat pertama berakhir di sini. Tanggung jawab sosial"), (2, "Isi halaman kedua yang cukup panjang untuk dibaca.")):
            page = pdf.new_page()
            page.insert_textbox(pymupdf.Rect(40, 40, 550, 80), body, fontsize=11)
            page.insert_textbox(pymupdf.Rect(40, 120, 550, 160), "perusahaan swasta ikut mendanai program" if number == 1 else "Penutup halaman kedua selesai.", fontsize=11)
            page.insert_textbox(pymupdf.Rect(40, 800, 550, 830), f"Lembar Jawaban Halaman {number} dari 2", fontsize=9)

        text = self.upload(pdf.tobytes()).data["text"]

        self.assertNotIn("Lembar Jawaban", text)
        self.assertIn("Tanggung jawab sosial perusahaan swasta", text)  # blok terpotong disambung
        self.assertIn("Isi halaman kedua", text)

    def test_pdf_text_layer_needs_no_external_service(self):
        with patch.object(documents.groq_vision, "transcribe") as transcribe:
            response = self.upload(make_pdf(ANSWER))

        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data["method"], "text")
        transcribe.assert_not_called()

    def test_image_is_read_by_the_vision_model_when_allowed(self):
        self.allow_external()
        with patch.object(documents.groq_vision, "transcribe", return_value=OCR_TEXT) as transcribe:
            response = self.upload(make_png())

        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data["method"], "ocr")
        self.assertEqual(response.data["text"], OCR_TEXT)
        self.assertEqual(transcribe.call_args.args[1], "image/jpeg")

    def test_scanned_pdf_mixes_text_and_ocr_pages(self):
        self.allow_external()
        pdf = pymupdf.open(stream=make_pdf(ANSWER), filetype="pdf")
        pdf.insert_pdf(pymupdf.open(stream=make_pdf(None), filetype="pdf"))
        with patch.object(documents.groq_vision, "transcribe", return_value=OCR_TEXT):
            response = self.upload(pdf.tobytes())

        self.assertEqual(response.data["method"], "mixed")
        self.assertEqual(response.data["page_count"], 2)
        self.assertTrue(response.data["text"].endswith(OCR_TEXT))

    def test_failed_ocr_page_is_reported_not_hidden(self):
        self.allow_external()
        pdf = pymupdf.open(stream=make_pdf(ANSWER), filetype="pdf")
        pdf.insert_pdf(pymupdf.open(stream=make_pdf(None), filetype="pdf"))
        with patch.object(documents.groq_vision, "transcribe", side_effect=ValueError("kosong")):
            with self.assertLogs(documents.logger, level="WARNING"):
                response = self.upload(pdf.tobytes())

        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data["method"], "text")
        self.assertIn("Halaman 2 gagal dibaca", response.data["warnings"][0])

    def test_images_are_not_sent_abroad_without_consent(self):
        # Catatan tanpa butir luar negeri (pengaman; UI tidak lagi membuatnya).
        record_consent(
            self.student.id,
            ConsentAction.GIVEN,
            [item for item in REQUIRED_ITEMS[Role.STUDENT] if item != ITEM_EXTERNAL_AI],
        )
        with patch.object(documents.groq_vision, "transcribe") as transcribe:
            response = self.upload(make_png())

        self.assertEqual(response.status_code, 400)
        self.assertIn("Kebijakan Privasi", str(response.data))
        transcribe.assert_not_called()

    def test_file_type_comes_from_content_not_name(self):
        for name, data in (
            ("laporan.pdf", b"MZ\x90\x00 bukan pdf"),
            ("laporan.docx", b"PK\x03\x04 zip tanpa dokumen"),
            ("kosong.png", b""),
        ):
            with self.subTest(name=name):
                self.assertEqual(self.upload(data, name).status_code, 400)

    def test_file_over_10_mb_is_rejected(self):
        response = self.upload(b"%PDF-" + b"0" * documents.MAX_FILE_BYTES)

        self.assertEqual(response.status_code, 400)
        self.assertIn("10 MB", str(response.data))

    def test_upload_is_refused_when_the_lecturer_requires_typing(self):
        Assignment.objects.filter(pk=self.assignment.pk).update(allow_file_upload=False)

        response = self.upload(make_docx(ANSWER))

        self.assertEqual(response.status_code, 403)
        self.assertIn("Ketik jawabanmu", str(response.data))
        self.assertFalse(Submission.objects.exists())

    def test_upload_is_closed_after_the_deadline(self):
        Assignment.objects.filter(pk=self.assignment.pk).update(
            deadline=timezone.now() - timedelta(minutes=1)
        )
        self.assertEqual(self.upload(make_docx(ANSWER)).status_code, 400)

    def test_only_class_members_who_are_students_can_upload(self):
        outsider = Profile.objects.create(
            email="lain@test.local", display_name="Lain", role=Role.STUDENT
        )
        record_consent(outsider.id, ConsentAction.GIVEN, REQUIRED_ITEMS[Role.STUDENT])
        self.assertEqual(self.upload(make_docx(ANSWER), student=outsider).status_code, 403)
        self.assertEqual(self.upload(make_docx(ANSWER), student=self.teacher).status_code, 403)

    def test_uploads_are_rate_limited_per_student(self):
        limit = {"document_import": "2/hour"}
        with patch.dict(PerUserScopedThrottle.THROTTLE_RATES, limit):
            codes = [self.upload(make_docx(ANSWER)).status_code for _ in range(3)]
            other = Profile.objects.create(
                email="lain@test.local", display_name="Lain", role=Role.STUDENT
            )
            ClassMembership.objects.create(class_ref=self.assignment.class_ref, student_profile=other)
            record_consent(other.id, ConsentAction.GIVEN, REQUIRED_ITEMS[Role.STUDENT])
            neighbour = self.upload(make_docx(ANSWER), student=other).status_code

        self.assertEqual(codes, [201, 201, 429])
        self.assertEqual(neighbour, 201)  # batas per mahasiswa, bukan per IP

    def test_upload_without_privacy_consent_is_refused(self):
        record_consent(self.student.id, ConsentAction.WITHDRAWN, ())
        self.assertEqual(self.upload(make_docx(ANSWER)).status_code, 403)


class ImportedSubmissionTest(DocumentTestCase):
    @staticmethod
    def breakdown_keys(submission: Submission) -> set[str]:
        return {row["key"] for row in submission.analysis.signal_breakdown}

    def test_text_from_the_document_skips_process_forensics(self):
        document_id = self.upload(make_docx(ANSWER)).data["document_id"]

        created = self.submit(document_id=document_id)

        submission = Submission.objects.get(pk=created.data["id"])
        self.assertTrue(submission.is_imported)
        self.assertNotIn("process_forensics", self.breakdown_keys(submission))
        detail = self.client_for(self.teacher).get(f"/api/submissions/{submission.id}")
        self.assertTrue(detail.data["is_imported"])

    def test_document_id_is_ignored_when_the_lecturer_requires_typing(self):
        document_id = self.upload(make_docx(ANSWER)).data["document_id"]
        Assignment.objects.filter(pk=self.assignment.pk).update(allow_file_upload=False)

        created = self.submit(document_id=document_id)

        submission = Submission.objects.get(pk=created.data["id"])
        self.assertFalse(submission.is_imported)
        self.assertIn("process_forensics", self.breakdown_keys(submission))

    def test_lecturer_can_open_the_original_file(self):
        data = make_docx(ANSWER)
        document_id = self.upload(data).data["document_id"]
        submission_id = self.submit(document_id=document_id).data["id"]

        response = self.client_for(self.teacher).get(f"/api/submissions/{submission_id}/document")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(b"".join(response.streaming_content), data)
        self.assertIn("wordprocessingml", response["Content-Type"])
        self.assertEqual(response["X-Content-Type-Options"], "nosniff")

    def test_original_file_is_private_to_the_lecturer_and_the_author(self):
        document_id = self.upload(make_docx(ANSWER)).data["document_id"]
        submission_id = self.submit(document_id=document_id).data["id"]
        stranger = Profile.objects.create(
            email="dosen2@test.local", display_name="Dosen Lain", role=Role.TEACHER
        )
        classmate = Profile.objects.create(
            email="mhs2@test.local", display_name="Mahasiswa Dua", role=Role.STUDENT
        )
        url = f"/api/submissions/{submission_id}/document"

        self.assertEqual(self.client_for(self.student).get(url).status_code, 200)
        self.assertEqual(self.client_for(stranger).get(url).status_code, 404)
        self.assertEqual(self.client_for(classmate).get(url).status_code, 404)

    def test_student_can_preview_the_upload_before_submitting_but_only_their_own(self):
        data = make_docx(ANSWER)
        document_id = self.upload(data).data["document_id"]
        classmate = Profile.objects.create(
            email="mhs2@test.local", display_name="Mahasiswa Dua", role=Role.STUDENT
        )
        ClassMembership.objects.create(
            class_ref=self.assignment.class_ref, student_profile=classmate
        )
        url = f"/api/assignments/{self.assignment.id}/documents/{document_id}"

        mine = self.client_for(self.student).get(url)

        self.assertEqual(mine.status_code, 200)
        self.assertEqual(b"".join(mine.streaming_content), data)
        self.assertEqual(self.client_for(classmate).get(url).status_code, 404)
        self.assertEqual(self.client_for(self.teacher).get(url).status_code, 403)

    def test_typed_answer_has_no_original_file(self):
        submission_id = self.submit().data["id"]

        response = self.client_for(self.teacher).get(f"/api/submissions/{submission_id}/document")

        self.assertEqual(response.status_code, 404)

    def test_light_edits_still_count_as_imported(self):
        document_id = self.upload(make_docx(ANSWER)).data["document_id"]

        created = self.submit(
            document_id=document_id, text_answer=ANSWER + " Saya menambahkan penutup sendiri."
        )

        self.assertTrue(Submission.objects.get(pk=created.data["id"]).is_imported)

    def test_unrelated_text_cannot_borrow_a_document_id(self):
        document_id = self.upload(make_docx(ANSWER)).data["document_id"]
        other = " ".join(["Kalimat lain sama sekali yang tidak ada di dokumen unggahan."] * 8)

        created = self.submit(document_id=document_id, text_answer=other)

        submission = Submission.objects.get(pk=created.data["id"])
        self.assertFalse(submission.is_imported)
        self.assertIn("process_forensics", self.breakdown_keys(submission))

    def test_another_students_document_is_not_accepted(self):
        other_student = Profile.objects.create(
            email="mhs2@test.local", display_name="Mahasiswa Dua", role=Role.STUDENT
        )
        ClassMembership.objects.create(
            class_ref=self.assignment.class_ref, student_profile=other_student
        )
        record_consent(other_student.id, ConsentAction.GIVEN, REQUIRED_ITEMS[Role.STUDENT])
        document_id = self.upload(make_docx(ANSWER), student=other_student).data["document_id"]

        created = self.submit(document_id=document_id)

        self.assertFalse(Submission.objects.get(pk=created.data["id"]).is_imported)

    def test_rewriting_an_imported_answer_returns_to_process_forensics(self):
        document_id = self.upload(make_docx(ANSWER)).data["document_id"]
        created = self.submit(document_id=document_id)
        rewritten = " ".join(["Jawaban baru yang ditulis ulang total tanpa dokumen asal."] * 8)

        self.submit(text_answer=rewritten)

        submission = Submission.objects.get(pk=created.data["id"])
        self.assertFalse(submission.is_imported)
        submission.analysis.refresh_from_db()
        self.assertIn("process_forensics", self.breakdown_keys(submission))
        self.assertEqual(submission.revision_count, 1)

    def test_revision_keeps_the_document_while_text_still_comes_from_it(self):
        document_id = self.upload(make_docx(ANSWER)).data["document_id"]
        created = self.submit(document_id=document_id)

        self.submit(text_answer=ANSWER + " Satu kalimat tambahan saat revisi.")

        self.assertTrue(Submission.objects.get(pk=created.data["id"]).is_imported)
