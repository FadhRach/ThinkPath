"""Cek Paham: tes lisan singkat yang diminta dosen atas satu submission.

Dosen menulis satu soal, mahasiswa menjawab hanya dengan suara dalam waktu
pendek, lalu LLM memberi skor SARAN beserta kutipan bukti. Nilai tugas tetap
diputuskan dosen; skor di sini tidak pernah dialirkan ke skor E1, level Bloom,
atau nilai: skor yang keliru tidak boleh membenarkan dirinya sendiri lewat
keputusan yang ia picu sendiri.

Transkrip yang dinilai hanya berasal dari audio utuh di server. live_transcript
kiriman klien tidak tepercaya dan tidak pernah sampai ke penilai.
"""
from __future__ import annotations

import uuid

from django.db import models
from django.db.models import Q

from apps.academics.models import Submission
from apps.accounts.models import Profile

MIN_ANSWER_SECONDS = 15
MAX_ANSWER_SECONDS = 300


class RequestStatus(models.TextChoices):
    ACTIVE = "active", "Aktif"
    CANCELLED = "cancelled", "Dibatalkan"


class Language(models.TextChoices):
    ID = "id", "Indonesia"
    EN = "en", "Inggris"


class AttemptStatus(models.TextChoices):
    IN_PROGRESS = "in_progress", "Sedang dikerjakan"
    PROCESSING = "processing", "Diproses"
    SCORED = "scored", "Selesai dinilai"
    PROCESSING_FAILED = "processing_failed", "Pemrosesan gagal"
    INTERRUPTED = "interrupted", "Terputus"
    VOIDED = "voided", "Dibatalkan oleh dosen"


class UnderstandingBand(models.TextChoices):
    # Ambang bandnya BELUM DIKALIBRASI (lihat rubric.py).
    STRONG = "kuat", "Kuat"
    PARTIAL = "sebagian", "Sebagian"
    WEAK = "lemah", "Lemah"


class ReportReason(models.TextChoices):
    TRANSCRIPT_MISMATCH = "transcript_mismatch", "Transkrip tidak sesuai ucapan"
    MIC_FAILURE = "mic_failure", "Mikrofon bermasalah"
    OTHER = "other", "Lainnya"


class ReportStatus(models.TextChoices):
    OPEN = "open", "Terbuka"
    DISMISSED = "dismissed", "Ditolak"
    RETRY_GRANTED = "retry_granted", "Coba ulang diberikan"


class CekPaham(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    submission = models.ForeignKey(
        Submission, on_delete=models.CASCADE, related_name="cekpaham_requests"
    )
    # Kosong bila dosennya menghapus akun: hasilnya tetap bagian arsip kelas.
    created_by = models.ForeignKey(
        Profile, null=True, blank=True, on_delete=models.SET_NULL, related_name="cekpaham_created"
    )
    # Panjang soal (10-1000) dan jendela >= answer_seconds + 60 dtk divalidasi
    # di service; CHECK aritmetika datetime tidak portabel ke SQLite tes.
    question_text = models.TextField()
    language = models.CharField(max_length=2, choices=Language.choices)
    answer_seconds = models.PositiveSmallIntegerField()
    window_start = models.DateTimeField()
    window_end = models.DateTimeField()
    status = models.CharField(
        max_length=12, choices=RequestStatus.choices, default=RequestStatus.ACTIVE
    )
    # Istilah kunci (maks 30) untuk prompt ASR dan penilai.
    keyterms = models.JSONField(default=list, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    cancelled_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "cekpaham_requests"
        indexes = [
            models.Index(fields=["created_by", "-created_at"], name="cekpaham_owner_idx"),
        ]
        constraints = [
            models.CheckConstraint(
                condition=Q(window_end__gt=models.F("window_start")),
                name="cekpaham_window_order",
            ),
            models.CheckConstraint(
                condition=Q(
                    answer_seconds__gte=MIN_ANSWER_SECONDS,
                    answer_seconds__lte=MAX_ANSWER_SECONDS,
                ),
                name="cekpaham_answer_seconds_range",
            ),
            # Satu permintaan aktif per submission; yang dibatalkan boleh banyak.
            models.UniqueConstraint(
                fields=["submission"],
                condition=Q(status=RequestStatus.ACTIVE),
                name="cekpaham_one_active_per_submission",
            ),
        ]


class CekPahamAttempt(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    cekpaham = models.ForeignKey(CekPaham, on_delete=models.CASCADE, related_name="attempts")
    number = models.PositiveSmallIntegerField()
    status = models.CharField(
        max_length=20, choices=AttemptStatus.choices, default=AttemptStatus.IN_PROGRESS
    )
    started_at = models.DateTimeField()
    # Batas dari server; jam klien tidak dipercaya.
    deadline_at = models.DateTimeField()
    finalized_at = models.DateTimeField(null=True, blank=True)

    # Audio jawaban, relatif ke MEDIA_ROOT; hanya dilayani lewat endpoint ber-auth.
    audio_path = models.CharField(max_length=255, blank=True, default="")
    audio_mime = models.CharField(max_length=40, blank=True, default="")
    audio_bytes = models.PositiveIntegerField(default=0)
    audio_duration_s = models.FloatField(null=True, blank=True)

    # Tak tepercaya: hanya untuk dibandingkan, tidak pernah dinilai.
    live_transcript = models.TextField(blank=True, default="")
    final_transcript = models.TextField(blank=True, default="")
    transcript_source = models.CharField(max_length=16, blank=True, default="")
    asr_provider = models.CharField(max_length=16, blank=True, default="")
    asr_model = models.CharField(max_length=40, blank=True, default="")
    # Segmen, avg_logprob, no_speech_prob, dan segmen yang dibuang filter.
    asr_quality = models.JSONField(default=dict, blank=True)
    first_speech_offset_s = models.FloatField(null=True, blank=True)
    # Konteks saja (pindah tab, ganti mic, galat mic); tidak pernah diskor.
    client_events = models.JSONField(default=dict, blank=True)

    # Saran penilai. ai_score kosong bila bukti kurang (bukan 0).
    ai_score = models.PositiveSmallIntegerField(null=True, blank=True)
    ai_band = models.CharField(
        max_length=10, choices=UnderstandingBand.choices, blank=True, default=""
    )
    ai_dimensions = models.JSONField(default=dict, blank=True)
    ai_flags = models.JSONField(default=list, blank=True)
    ai_summary = models.TextField(blank=True, default="")
    judge_model = models.CharField(max_length=60, blank=True, default="")
    rubric_version = models.CharField(max_length=8, blank=True, default="")
    prompt_version = models.CharField(max_length=8, blank=True, default="")
    judge_runs = models.JSONField(default=list, blank=True)
    error_code = models.CharField(max_length=40, blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "cekpaham_attempts"
        constraints = [
            models.UniqueConstraint(fields=["cekpaham", "number"], name="cekpaham_attempt_number"),
            # Attempt baru baru boleh dibuat setelah yang lama di-void dosen.
            models.UniqueConstraint(
                fields=["cekpaham"],
                condition=~Q(status=AttemptStatus.VOIDED),
                name="cekpaham_one_live_attempt",
            ),
            models.CheckConstraint(
                condition=Q(ai_score__isnull=True) | Q(ai_score__lte=100),
                name="cekpaham_attempt_score_range",
            ),
        ]


class CekPahamReport(models.Model):
    """Laporan mahasiswa (transkrip salah, mic gagal); dosen memutuskan."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    attempt = models.ForeignKey(CekPahamAttempt, on_delete=models.CASCADE, related_name="reports")
    reason = models.CharField(max_length=24, choices=ReportReason.choices)
    note = models.TextField(blank=True, default="")
    status = models.CharField(
        max_length=14, choices=ReportStatus.choices, default=ReportStatus.OPEN
    )
    resolved_by = models.ForeignKey(
        Profile, null=True, blank=True, on_delete=models.SET_NULL, related_name="+"
    )
    resolved_at = models.DateTimeField(null=True, blank=True)
    response_note = models.TextField(blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "cekpaham_reports"
        indexes = [
            models.Index(fields=["status", "-created_at"], name="cekpaham_report_status_idx"),
        ]
        constraints = [
            # Laporan terbuka belum punya waktu penyelesaian, dan sebaliknya.
            models.CheckConstraint(
                condition=Q(status=ReportStatus.OPEN, resolved_at__isnull=True)
                | (~Q(status=ReportStatus.OPEN) & Q(resolved_at__isnull=False)),
                name="cekpaham_report_resolved_matches_status",
            ),
        ]
