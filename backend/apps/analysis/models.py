"""Hasil analisis per submission dan cache skor detektor eksternal."""
from __future__ import annotations

import uuid

from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models
from django.db.models import Q
from django.utils import timezone

from apps.analysis.choices import AiBand, AnalysisSource, Confidence


class AnalysisResult(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    submission = models.OneToOneField(
        "academics.Submission",
        on_delete=models.CASCADE,
        related_name="analysis",
    )
    ai_score = models.SmallIntegerField(
        validators=[MinValueValidator(0), MaxValueValidator(100)],
    )
    # Sengaja didenormalisasi: ambang band berbeda per sumber (heuristik 42/70, Winston 35/70).
    ai_band = models.CharField(max_length=8, choices=AiBand.choices)
    bloom_level = models.SmallIntegerField(
        validators=[MinValueValidator(1), MaxValueValidator(6)],
    )
    confidence = models.CharField(
        max_length=8, choices=Confidence.choices, blank=True, default=""
    )
    # Terpisah dari keyakinan skor AI: teks bisa jelas di satu dimensi, ambigu di lainnya.
    bloom_confidence = models.CharField(
        max_length=8, choices=Confidence.choices, blank=True, default=""
    )
    # Maks 4 kalimat pengamatan berbahasa Indonesia.
    signals = models.JSONField(default=list, blank=True)
    # Kontribusi tiap sinyal ke skor AI, agar skor bisa ditinjau dosen.
    signal_breakdown = models.JSONField(default=list, blank=True)
    summary = models.TextField(blank=True, default="")
    recommendation = models.TextField(blank=True, default="")
    analysis_source = models.CharField(
        max_length=16,
        choices=AnalysisSource.choices,
        default=AnalysisSource.HEURISTIC,
    )
    # Pola pengerjaan, TIDAK menjumlah ke ai_score (PROCESS_WEIGHT = 0); kosong untuk jawaban dokumen.
    process_band = models.CharField(max_length=16, blank=True, default="")
    process_evidence = models.TextField(blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "analysis_results"
        constraints = [
            models.CheckConstraint(
                condition=Q(ai_score__gte=0, ai_score__lte=100),
                name="analysis_ai_score_range",
            ),
            models.CheckConstraint(
                condition=Q(bloom_level__gte=1, bloom_level__lte=6),
                name="analysis_bloom_level_range",
            ),
        ]


class DetectorScore(models.Model):
    """Cache skor detektor (ditagih per kata) agar teks sama tidak dibayar dua kali; kunci SHA-256 teks."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    text_hash = models.CharField(max_length=64)
    # Versi model ikut kunci: menaikkan winston.MODEL_VERSION otomatis membatalkan skor lama.
    provider = models.CharField(max_length=32)
    model_version = models.CharField(max_length=16)
    language = models.CharField(max_length=8)
    # SUDAH dibalik menjadi probabilitas AI 0..1 (jangan simpan "human score" mentah Winston).
    ai_probability = models.FloatField(
        validators=[MinValueValidator(0.0), MaxValueValidator(1.0)],
    )
    reliable = models.BooleanField()
    attack_kinds = models.JSONField(default=list, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "detector_scores"
        constraints = [
            models.UniqueConstraint(
                fields=["text_hash", "provider", "model_version", "language"],
                name="detector_score_unique_key",
            ),
            models.CheckConstraint(
                condition=Q(ai_probability__gte=0.0, ai_probability__lte=1.0),
                name="detector_probability_range",
            ),
        ]


class AnalysisTrigger(models.TextChoices):
    SUBMIT = "submit", "Pengumpulan"
    REVISE = "revise", "Revisi"
    REANALYZE = "reanalyze", "Analisis ulang dosen"


class AnalysisRun(models.Model):
    """Riwayat permanen setiap analisis (AnalysisResult ditimpa); payload = dict hasil lengkap."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    submission = models.ForeignKey(
        "academics.Submission", on_delete=models.CASCADE, related_name="analysis_runs"
    )
    trigger = models.CharField(max_length=16, choices=AnalysisTrigger.choices)
    requested_by = models.ForeignKey(
        "accounts.Profile", null=True, blank=True, on_delete=models.SET_NULL, related_name="+"
    )
    ai_score = models.SmallIntegerField()
    ai_band = models.CharField(max_length=8, choices=AiBand.choices)
    bloom_level = models.SmallIntegerField()
    analysis_source = models.CharField(max_length=16, choices=AnalysisSource.choices)
    payload = models.JSONField(default=dict)
    process_context = models.JSONField(default=dict, blank=True)
    text_sha256 = models.CharField(max_length=64)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "analysis_runs"
        indexes = [
            models.Index(fields=["submission", "-created_at"], name="analysis_run_sub_recent_idx"),
        ]


class JobStatus(models.TextChoices):
    QUEUED = "queued", "Antre"
    RUNNING = "running", "Berjalan"
    DONE = "done", "Selesai"
    FAILED = "failed", "Gagal"
    # Digantikan job lebih baru untuk submission yang sama (direvisi sebelum sempat dianalisis).
    SUPERSEDED = "superseded", "Digantikan"


class AnalysisJob(models.Model):
    """Antrean analisis di Postgres (tanpa Redis), diklaim worker dengan SELECT ... FOR UPDATE SKIP LOCKED."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    submission = models.ForeignKey(
        "academics.Submission", on_delete=models.CASCADE, related_name="analysis_jobs"
    )
    trigger = models.CharField(max_length=16, choices=AnalysisTrigger.choices)
    requested_by = models.ForeignKey(
        "accounts.Profile", null=True, blank=True, on_delete=models.SET_NULL, related_name="+"
    )
    status = models.CharField(max_length=16, choices=JobStatus.choices, default=JobStatus.QUEUED)
    # revision_count saat job dibuat: hasil job yang teksnya sudah direvisi lagi dibuang.
    revision_count = models.IntegerField(default=0)
    attempts = models.PositiveSmallIntegerField(default=0)
    run_after = models.DateTimeField(default=timezone.now)
    locked_at = models.DateTimeField(null=True, blank=True)
    error = models.CharField(max_length=300, blank=True, default="")
    created_at = models.DateTimeField(default=timezone.now)
    finished_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "analysis_jobs"
        indexes = [
            # Hanya baris yang masih perlu dikerjakan; tabel riwayat job tidak memperlambat klaim.
            models.Index(
                fields=["run_after"],
                condition=Q(status__in=["queued", "running"]),
                name="analysis_job_open_idx",
            ),
            models.Index(fields=["submission", "-created_at"], name="analysis_job_sub_idx"),
        ]
