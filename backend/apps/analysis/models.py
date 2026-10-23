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
    # Disimpan walau bisa diturunkan dari ai_score: ambang band berbeda per
    # sumber (heuristik vs detektor), jadi menghitung ulang dari angka saja
    # bisa memberi band yang berbeda dari yang dilihat dosen saat itu.
    ai_band = models.CharField(max_length=8, choices=AiBand.choices)
    bloom_level = models.SmallIntegerField(
        validators=[MinValueValidator(1), MaxValueValidator(6)],
    )
    confidence = models.CharField(
        max_length=8, choices=Confidence.choices, blank=True, default=""
    )
    # Keyakinan taksiran Bloom, terpisah dari keyakinan skor AI: teks bisa
    # jelas di satu dimensi dan ambigu di dimensi lain.
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
    # Pola pengerjaan, bukti tersendiri yang TIDAK menjumlah ke ai_score
    # (lihat PROCESS_WEIGHT di engines/ai_score.py). Kosong untuk jawaban yang
    # diimpor dari dokumen dan untuk baris lama.
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
    """Skor detektor eksternal yang sudah dibayar, supaya tidak dibayar dua kali.

    Detektor menagih per kata. Tanpa tabel ini setiap "Analisis Ulang" pada
    teks yang sama membayar penuh lagi. Cache di basis data (bukan locmem)
    karena harus bertahan lintas worker dan restart.

    Hanya SHA-256 teks yang disimpan, bukan teksnya: jawaban sudah ada di
    submissions.text_answer dan tidak perlu digandakan.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    text_hash = models.CharField(max_length=64)
    # provider, model_version, dan language ikut menjadi kunci: menaikkan
    # MODEL_VERSION di providers/winston.py otomatis membatalkan skor lama.
    provider = models.CharField(max_length=32)
    model_version = models.CharField(max_length=16)
    language = models.CharField(max_length=8)
    # SUDAH dibalik menjadi probabilitas AI 0..1. Menyimpan "human score"
    # mentah Winston di sini membuat semua baris terbaca terbalik tanpa gejala.
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
    """Satu analisis, disimpan permanen. Tidak pernah diubah atau ditimpa.

    AnalysisResult adalah keadaan terkini dan ditimpa tiap analisis ulang, jadi
    skor yang pernah dilihat dosen hilang tanpa jejak. Baris di sini menjaga
    riwayatnya: apa hasilnya, kapan, karena apa, dan atas permintaan siapa.
    payload memuat dict hasil lengkap; kolom lain hanya untuk disaring cepat.
    process_context menyimpan masukan proses (durasi, jumlah cuplikan, kata
    sisipan) supaya bobot sinyal proses kelak bisa dikalibrasi terhadap label
    dosen tanpa menjalankan ulang apa pun.
    """

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
    # Digantikan job yang lebih baru untuk submission yang sama (mis. direvisi
    # lagi sebelum sempat dianalisis); hasilnya tidak berguna lagi.
    SUPERSEDED = "superseded", "Digantikan"


class AnalysisJob(models.Model):
    """Antrean analisis, disimpan di Postgres (tanpa broker).

    VPS 1 GB tidak punya ruang untuk Redis/Celery; satu proses worker kecil
    yang mengklaim baris dengan SELECT ... FOR UPDATE SKIP LOCKED cukup untuk
    beban kelas. Pengumpulan jawaban hanya menyimpan baris ini, sehingga
    request mahasiswa selesai dalam milidetik walau Winston dan Groq lambat.
    """

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
