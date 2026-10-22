import shutil
import tempfile
from datetime import timedelta
from unittest.mock import patch

from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient

from apps.academics.models import Assignment, Class, ClassMembership, Submission
from apps.accounts.authentication import create_access_token
from apps.accounts.models import ConsentAction, EducationLevel, Profile, Role
from apps.accounts.privacy import (
    ITEM_EXTERNAL_AI,
    ITEM_VOICE_CEKPAHAM,
    REQUIRED_ITEMS,
    record_consent,
)
from apps.cekpaham.judge import JudgeResult
from apps.cekpaham.models import CekPaham
from apps.cekpaham.providers.groq_stt import Transcription

TRANSCRIPT = "Saya memilih rekursi karena struktur pohon itu sendiri berulang di setiap simpulnya."
QUESTION = "Pada jawabanmu kamu memilih rekursi. Mengapa bukan stack?"


def good_transcription(text=TRANSCRIPT, duration=12.0):
    segment = {
        "start": 1.2, "end": duration, "text": text,
        "avg_logprob": -0.1, "no_speech_prob": 0.0, "compression_ratio": 1.2,
    }
    return Transcription(text=text, duration_s=duration, kept=[segment])


def good_verdict(score=75):
    levels = {n: {"level": 2, "evidence": ["rekursi"], "reason": "baik"} for n in
              ("accuracy", "consistency", "depth", "ownership")}
    return JudgeResult(
        score=score, band="kuat", dimensions=levels, flags=[], summary="Paham.",
        runs=[{"order": "normal", "score": score}], model="model-uji",
    )


def audio_file(size=2000, content_type="audio/webm"):
    return SimpleUploadedFile("jawaban.webm", b"\x1aE\xdf\xa3" + b"x" * size, content_type=content_type)


@patch.dict("os.environ", {"GROQ_API_KEY": "kunci-uji"})
class CekPahamAPITestCase(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.teacher = Profile.objects.create(email="dosen@test.local", display_name="Dosen", role=Role.TEACHER)
        cls.other_teacher = Profile.objects.create(email="dosen2@test.local", display_name="Dosen Lain", role=Role.TEACHER)
        cls.student = Profile.objects.create(email="mhs@test.local", display_name="Mahasiswa", role=Role.STUDENT)
        cls.other_student = Profile.objects.create(email="mhs2@test.local", display_name="Mahasiswa Lain", role=Role.STUDENT)
        kelas = Class.objects.create(
            owner=cls.teacher, name="Kelas A", subject="Algoritma",
            education_level=EducationLevel.S1, join_code="CP-0001",
        )
        for profile in (cls.student, cls.other_student):
            ClassMembership.objects.create(class_ref=kelas, student_profile=profile)
        assignment = Assignment.objects.create(
            class_ref=kelas, title="Tugas 3", instructions="Jelaskan penelusuran pohon.", expected_bloom_level=4
        )
        now = timezone.now()
        cls.submission = Submission.objects.create(
            assignment=assignment, student_profile=cls.student, text_answer="Saya memakai rekursi in-order.",
            started_at=now - timedelta(minutes=30), submitted_at=now, duration_seconds=1800,
        )
        for profile in (cls.student, cls.other_student):
            cls.grant_consent(profile)

    @staticmethod
    def grant_consent(profile, voice=True, external=True):
        items = list(REQUIRED_ITEMS[Role.STUDENT])
        if voice:
            items.append(ITEM_VOICE_CEKPAHAM)
        if external:
            items.append(ITEM_EXTERNAL_AI)
        record_consent(profile.id, ConsentAction.GIVEN, items)

    def setUp(self):
        media = tempfile.mkdtemp()
        self.addCleanup(shutil.rmtree, media, ignore_errors=True)
        override = override_settings(MEDIA_ROOT=media)
        override.enable()
        self.addCleanup(override.disable)

    def client_for(self, profile=None):
        client = APIClient()
        if profile is not None:
            client.credentials(HTTP_AUTHORIZATION=f"Bearer {create_access_token(profile)}")
        return client

    def make_request(self, **overrides) -> CekPaham:
        now = timezone.now()
        fields = dict(
            submission=self.submission, created_by=self.teacher, question_text=QUESTION, language="id",
            answer_seconds=45, window_start=now - timedelta(hours=1), window_end=now + timedelta(hours=2),
            keyterms=["rekursi"],
        )
        return CekPaham.objects.create(**{**fields, **overrides})

    def url(self, cekpaham, suffix=""):
        return f"/api/student/cekpaham/{cekpaham.id}{suffix}"

    def start(self, cekpaham, profile=None):
        return self.client_for(profile or self.student).post(self.url(cekpaham, "/start"))

    def finalize(self, cekpaham, profile=None, **extra):
        data = {"audio": audio_file(), **extra}
        return self.client_for(profile or self.student).post(self.url(cekpaham, "/finalize"), data, format="multipart")

    def run_session(self, cekpaham=None, transcription=None, verdict=None):
        """Mulai lalu finalisasi dengan STT dan penilai di-mock. Mengembalikan (cekpaham, respons)."""
        cekpaham = cekpaham or self.make_request()
        self.assertEqual(self.start(cekpaham).status_code, 201)
        with patch("apps.cekpaham.services.attempts.groq_stt.transcribe", return_value=transcription or good_transcription()), \
             patch("apps.cekpaham.services.attempts.judge.judge", return_value=verdict or good_verdict()):
            return cekpaham, self.finalize(cekpaham)
