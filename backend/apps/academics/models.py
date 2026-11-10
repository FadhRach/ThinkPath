"""Model akademik: kelas, tugas, materi, pengumuman, submission.

Hasil analisis (AnalysisResult, DetectorScore) ada di apps.analysis.models.
ERD dan kamus data: diagram/08-erd-basis-data.md.

Sengaja TIDAK ada kolom idle_time di Submission: maknanya ambigu (F-07).
"""
from __future__ import annotations

import uuid

from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models
from django.db.models import Q

from apps.accounts.models import EducationLevel, Profile


class EventType(models.TextChoices):
    STARTED = "started", "Started"
    REVISION = "revision", "Revision"
    # Tidak pernah ditulis; tetap ada karena tipe frontend (lib/types.ts) masih mengenalnya.
    PASTE = "paste", "Paste"
    SUBMITTED = "submitted", "Submitted"
    # Cuplikan jumlah kata berkala selama mengerjakan (kurva pertumbuhan kata).
    PROGRESS = "progress", "Progress"


class AnalysisState(models.TextChoices):
    """Keadaan analisis sebuah pengumpulan, dibaca daftar dosen tanpa join ke antrean."""

    PENDING = "pending", "Antre"
    RUNNING = "running", "Dianalisis"
    DONE = "done", "Selesai"
    FAILED = "failed", "Gagal"


class SubmissionStatus(models.TextChoices):
    DRAFT = "draft", "Draft"
    SUBMITTED = "submitted", "Submitted"
    REVIEWED = "reviewed", "Reviewed"


class Class(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    # NULL bila dosen menghapus akunnya: kelas jadi arsip baca-saja (is_archived).
    owner = models.ForeignKey(
        Profile,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="classes",
    )
    owner_left_at = models.DateTimeField(null=True, blank=True)
    name = models.CharField(max_length=120)
    subject = models.CharField(max_length=80)
    # Di kelas, bukan profil: mahasiswa bisa mengambil kelas lintas jenjang/prodi.
    education_level = models.CharField(
        max_length=16,
        choices=EducationLevel.choices,
    )
    # Opsional: ada kelas lintas prodi dan mata kuliah umum.
    program_studi = models.CharField(max_length=120, blank=True, default="")
    # Semester penyelenggaraan kelas (permanen), bukan semester mahasiswa (berubah tiap enam bulan).
    semester = models.SmallIntegerField(
        null=True,
        blank=True,
        validators=[MinValueValidator(1), MaxValueValidator(14)],
    )
    join_code = models.CharField(max_length=8, unique=True)
    created_at = models.DateTimeField(auto_now_add=True)

    @property
    def is_archived(self) -> bool:
        return self.owner_id is None

    class Meta:
        db_table = "classes"
        indexes = [
            models.Index(fields=["owner", "-created_at"], name="classes_owner_recent_idx"),
        ]
        constraints = [
            models.CheckConstraint(
                condition=Q(semester__isnull=True) | Q(semester__gte=1, semester__lte=14),
                name="class_semester_range",
            ),
        ]

    def __str__(self) -> str:
        return self.name


class ClassMembership(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    class_ref = models.ForeignKey(
        Class,
        on_delete=models.CASCADE,
        related_name="memberships",
        db_column="class_id",
    )
    student_profile = models.ForeignKey(
        Profile,
        on_delete=models.CASCADE,
        related_name="class_memberships",
    )
    joined_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "class_memberships"
        constraints = [
            models.UniqueConstraint(
                fields=["class_ref", "student_profile"],
                name="membership_unique_per_class",
            ),
        ]


class Assignment(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    class_ref = models.ForeignKey(
        Class,
        on_delete=models.CASCADE,
        related_name="assignments",
        db_column="class_id",
    )
    title = models.CharField(max_length=160)
    instructions = models.TextField(blank=True, default="")
    # Instruksi berformat (editor TipTap; gambar, tautan, tabel, rumus) yang sudah dibersihkan server.
    # `instructions` selalu teks polos turunannya, dipakai daftar, notifikasi, dan analisis.
    instructions_rich = models.JSONField(null=True, blank=True, default=None)
    deadline = models.DateTimeField(null=True, blank=True)
    expected_bloom_level = models.SmallIntegerField(
        validators=[MinValueValidator(1), MaxValueValidator(6)],
    )
    # Boleh diisi dari berkas (PDF/DOCX/gambar); jawaban begitu tanpa jejak mengetik.
    allow_file_upload = models.BooleanField(default=False)
    # education_level sengaja tidak ada: dibaca dari class_ref (serializer tetap memaparkannya).
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "assignments"
        indexes = [
            models.Index(fields=["class_ref", "-created_at"], name="assign_class_recent_idx"),
        ]
        constraints = [
            models.CheckConstraint(
                condition=Q(expected_bloom_level__gte=1, expected_bloom_level__lte=6),
                name="assignment_bloom_level_range",
            ),
        ]

    def __str__(self) -> str:
        return self.title


class Material(models.Model):
    """Materi dosen untuk satu kelas: judul, ringkasan, tautan (sengaja tautan, bukan unggahan berkas)."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    class_ref = models.ForeignKey(
        Class,
        on_delete=models.CASCADE,
        related_name="materials",
        db_column="class_id",
    )
    # Teks bebas pengelompokan ("Pertemuan 3: ..."); kosong = materi umum.
    topic = models.CharField(max_length=80, blank=True, default="")
    title = models.CharField(max_length=160)
    description = models.TextField(blank=True, default="")
    # Serializer hanya menerima http/https (javascript: berbahaya saat dirender).
    url = models.URLField(max_length=500, blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "materials"
        indexes = [
            models.Index(fields=["class_ref", "-created_at"], name="material_class_recent_idx"),
        ]

    def __str__(self) -> str:
        return self.title


class Submission(models.Model):
    """Jawaban satu mahasiswa untuk satu tugas; satu baris per (tugas, mahasiswa), revisi = update."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    assignment = models.ForeignKey(
        Assignment,
        on_delete=models.CASCADE,
        related_name="submissions",
    )
    student_profile = models.ForeignKey(
        Profile,
        on_delete=models.CASCADE,
        related_name="submissions",
    )
    text_answer = models.TextField(blank=True, default="")
    # Dokumen TipTap yang sudah dibersihkan; null untuk jawaban teks polos.
    rich_answer = models.JSONField(null=True, blank=True, default=None)
    # Dokumen sumber jawaban (MEDIA_ROOT/documents/...); bila ada, forensik proses dilewati.
    source_document = models.UUIDField(null=True, blank=True, default=None)
    started_at = models.DateTimeField()
    submitted_at = models.DateTimeField(null=True, blank=True)
    duration_seconds = models.IntegerField(
        null=True,
        blank=True,
        validators=[MinValueValidator(0)],
    )
    revision_count = models.IntegerField(
        default=0,
        validators=[MinValueValidator(0)],
    )
    status = models.CharField(
        max_length=16,
        choices=SubmissionStatus.choices,
        default=SubmissionStatus.SUBMITTED,
    )
    grade = models.SmallIntegerField(
        null=True,
        blank=True,
        validators=[MinValueValidator(0), MaxValueValidator(100)],
    )
    teacher_feedback = models.TextField(blank=True, default="")
    # Bawaan "done" untuk baris lama dan seed; jalur pengumpulan mengisinya "pending".
    analysis_state = models.CharField(
        max_length=8, choices=AnalysisState.choices, default=AnalysisState.DONE
    )
    created_at = models.DateTimeField(auto_now_add=True)

    @property
    def is_imported(self) -> bool:
        return self.source_document is not None

    class Meta:
        db_table = "submissions"
        indexes = [
            models.Index(fields=["assignment", "-submitted_at"], name="sub_assign_recent_idx"),
            models.Index(fields=["student_profile", "-submitted_at"], name="sub_student_recent_idx"),
            models.Index(fields=["assignment", "status"], name="sub_assign_status_idx"),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=["assignment", "student_profile"],
                name="submission_unique_per_student",
            ),
            models.CheckConstraint(
                condition=Q(grade__isnull=True) | Q(grade__gte=0, grade__lte=100),
                name="submission_grade_range",
            ),
            models.CheckConstraint(
                condition=Q(revision_count__gte=0),
                name="submission_revision_count_positive",
            ),
            models.CheckConstraint(
                condition=Q(duration_seconds__isnull=True) | Q(duration_seconds__gte=0),
                name="submission_duration_positive",
            ),
        ]


class ReasoningEvent(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    submission = models.ForeignKey(
        Submission,
        on_delete=models.CASCADE,
        related_name="reasoning_events",
    )
    event_type = models.CharField(max_length=16, choices=EventType.choices)
    payload = models.JSONField(default=dict, blank=True)
    occurred_at = models.DateTimeField()

    class Meta:
        db_table = "reasoning_events"
        indexes = [
            models.Index(fields=["submission", "occurred_at"], name="reason_sub_time_idx"),
        ]


class SubmissionDraft(models.Model):
    """Draf sebelum dikumpulkan: sumber kebenaran bukti proses (jam dan jumlah kata dicatat server).

    Dibuat pada simpan pertama yang berisi teks, dihapus dalam transaksi pengumpulan.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    assignment = models.ForeignKey(
        Assignment, on_delete=models.CASCADE, related_name="drafts"
    )
    student_profile = models.ForeignKey(
        Profile, on_delete=models.CASCADE, related_name="drafts"
    )
    text_answer = models.TextField(blank=True, default="")
    rich_answer = models.JSONField(null=True, blank=True, default=None)
    # Dokumen unggahan yang menjadi sumber teks draf (opsional).
    document_id = models.UUIDField(null=True, blank=True, default=None)
    started_at = models.DateTimeField()
    # [{"t": detik sejak started_at, "w": jumlah kata}], maks 240, dicatat server tiap >= 30 detik.
    samples = models.JSONField(default=list, blank=True)
    last_saved_at = models.DateTimeField(auto_now=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "submission_drafts"
        constraints = [
            models.UniqueConstraint(
                fields=["assignment", "student_profile"],
                name="draft_unique_per_student",
            ),
        ]
