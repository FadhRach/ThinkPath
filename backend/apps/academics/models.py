"""Model akademik: kelas, tugas, materi, pengumuman, submission, verifikasi.

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
    # Tidak pernah ditulis: menempel kutipan wajar dalam menulis akademik.
    # Tetap ada karena tipe frontend (lib/types.ts) masih mengenalnya.
    PASTE = "paste", "Paste"
    SUBMITTED = "submitted", "Submitted"
    # Cuplikan jumlah kata berkala selama mahasiswa mengerjakan. Inilah satu
    # satunya masukan proses yang tidak bisa dikalahkan hanya dengan menunggu:
    # menempel lalu diam meninggalkan garis datar yang tidak mungkin tertukar
    # dengan menulis sungguhan.
    PROGRESS = "progress", "Progress"


class SubmissionStatus(models.TextChoices):
    DRAFT = "draft", "Draft"
    SUBMITTED = "submitted", "Submitted"
    REVIEWED = "reviewed", "Reviewed"


class VerificationStatus(models.TextChoices):
    SCHEDULED = "scheduled", "Dijadwalkan"
    COMPLETED = "completed", "Selesai"
    CANCELLED = "cancelled", "Dibatalkan"


class VerificationOutcome(models.TextChoices):
    """Kesimpulan dosen setelah berbicara langsung dengan mahasiswa.

    Pilihannya sengaja TIDAK memuat "terbukti menyontek". Sistem ini tidak
    pernah menyimpulkan kecurangan, dan seorang dosen pun tidak menyimpulkannya
    dari satu percakapan. Yang bisa dinilai adalah apakah mahasiswa mampu
    menjelaskan kembali karyanya, dan itu sudah cukup untuk ditindaklanjuti
    secara pedagogis tanpa menuduh siapa pun.
    """

    CAN_EXPLAIN = "can_explain", "Dapat menjelaskan"
    PARTIAL = "partial", "Sebagian dapat dijelaskan"
    CANNOT_EXPLAIN = "cannot_explain", "Belum dapat menjelaskan"
    INCONCLUSIVE = "inconclusive", "Belum dapat disimpulkan"


class Class(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    owner = models.ForeignKey(
        Profile,
        on_delete=models.CASCADE,
        related_name="classes",
    )
    name = models.CharField(max_length=120)
    subject = models.CharField(max_length=80)
    # Jenjang studi. Melekat di kelas, bukan di profil, karena satu mahasiswa
    # bisa mengambil kelas lintas jenjang dan lintas prodi.
    education_level = models.CharField(
        max_length=16,
        choices=EducationLevel.choices,
    )
    # Program studi penyelenggara. Opsional karena ada kelas lintas prodi dan
    # mata kuliah umum yang tidak dimiliki satu prodi mana pun.
    program_studi = models.CharField(max_length=120, blank=True, default="")
    # Semester penyelenggaraan, bukan semester mahasiswa.
    #
    # Ini keputusan yang disengaja. Semester seorang mahasiswa berubah tiap
    # enam bulan, sehingga kalau disimpan di Profile datanya basi terus dan
    # harus diperbarui manual. Sebuah kelas sebaliknya permanen berstatus
    # "semester 3", jadi di sinilah tempatnya.
    semester = models.SmallIntegerField(
        null=True,
        blank=True,
        validators=[MinValueValidator(1), MaxValueValidator(14)],
    )
    join_code = models.CharField(max_length=8, unique=True)
    created_at = models.DateTimeField(auto_now_add=True)

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
    deadline = models.DateTimeField(null=True, blank=True)
    expected_bloom_level = models.SmallIntegerField(
        validators=[MinValueValidator(1), MaxValueValidator(6)],
    )
    # education_level sengaja TIDAK ada di sini. Sebelumnya kolom ini
    # menduplikasi jenjang milik kelas, sehingga sebuah tugas bisa tersimpan
    # dengan jenjang yang berbeda dari kelas tempatnya berada. Jenjang sekarang
    # dibaca dari class_ref, dan serializer tetap memaparkannya agar kontrak
    # API tidak berubah.
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
    """Materi yang dibagikan dosen ke satu kelas: judul, ringkasan, dan tautan.

    Sengaja tautan, bukan unggahan berkas. Dosen umumnya sudah menyimpan slide
    dan video di Google Drive atau YouTube; yang dibutuhkan kelas adalah satu
    tempat untuk menemukannya. Unggahan berkas menuntut penyimpanan, backup,
    dan kuota disk VPS tersendiri, jadi belum dibangun.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    class_ref = models.ForeignKey(
        Class,
        on_delete=models.CASCADE,
        related_name="materials",
        db_column="class_id",
    )
    # Topik atau pertemuan tempat materi dikelompokkan, misalnya "Pertemuan 3:
    # Desain kualitatif". Teks bebas seperti topik di Google Classroom; kosong
    # berarti materi umum seperti silabus. Tidak dibuat tabel tersendiri karena
    # gunanya hanya mengelompokkan, dan formulir dosen sudah menyarankan topik
    # yang pernah ia pakai supaya penulisannya seragam.
    topic = models.CharField(max_length=80, blank=True, default="")
    title = models.CharField(max_length=160)
    description = models.TextField(blank=True, default="")
    # Hanya http dan https yang diterima serializer. Skema lain seperti
    # javascript: akan menjadi tautan berbahaya begitu dirender di layar.
    url = models.URLField(max_length=500, blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "materials"
        indexes = [
            models.Index(fields=["class_ref", "-created_at"], name="material_class_recent_idx"),
        ]

    def __str__(self) -> str:
        return self.title


class Announcement(models.Model):
    """Pengumuman dosen untuk anggota satu kelas."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    class_ref = models.ForeignKey(
        Class, on_delete=models.CASCADE, related_name="announcements", db_column="class_id"
    )
    title = models.CharField(max_length=160)
    body = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "announcements"
        indexes = [models.Index(fields=["class_ref", "-created_at"], name="announcement_class_recent_idx")]


class Submission(models.Model):
    """Jawaban satu mahasiswa untuk satu tugas.

    Satu baris per (tugas, mahasiswa): pengumpulan ulang memperbarui baris yang
    sama (revision_count += 1), dan constraint unik menjaga itu walau dua
    permintaan tiba bersamaan.
    """

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
    created_at = models.DateTimeField(auto_now_add=True)

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


class VerbalVerification(models.Model):
    """Sesi tanya jawab langsung antara dosen dan mahasiswa.

    Inilah tempat manusia mengambil keputusan, dan itu memang seharusnya
    begitu. Rekomendasi sistem berhenti pada "disarankan diskusi 10-15 menit";
    tanpa model ini, saran itu tidak pernah bisa ditindaklanjuti dan lingkaran
    "bukti bukan vonis" tidak pernah tertutup.

    Hasil verifikasi sengaja TIDAK dialirkan balik ke skor AI. Kalau skor
    dinaikkan atau diturunkan berdasarkan hasil percakapan, skor yang keliru
    akan membenarkan dirinya sendiri: dosen curiga karena skornya tinggi, lalu
    hasil percakapan dipakai menguatkan skor itu.

    Yang boleh dilakukan kelak: memakai kumpulan outcome ini sebagai data
    berlabel manusia untuk mengkalibrasi ulang bobot E1 lewat ai_experiment.
    Itu berbeda, karena kalibrasi menguji ambangnya secara menyeluruh, bukan
    menyesuaikan satu skor terhadap satu percakapan.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    submission = models.OneToOneField(
        Submission,
        on_delete=models.CASCADE,
        related_name="verification",
    )
    status = models.CharField(
        max_length=16,
        choices=VerificationStatus.choices,
        default=VerificationStatus.SCHEDULED,
    )
    scheduled_at = models.DateTimeField(null=True, blank=True)
    # Diisi hanya setelah sesi berlangsung. Kosong selama masih dijadwalkan.
    outcome = models.CharField(
        max_length=20,
        choices=VerificationOutcome.choices,
        blank=True,
        default="",
    )
    notes = models.TextField(blank=True, default="")
    completed_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "verbal_verifications"
        indexes = [
            models.Index(fields=["status", "scheduled_at"], name="verif_status_time_idx"),
        ]
        constraints = [
            # Kesimpulan hanya ada setelah sesi selesai, dan sesi selesai
            # wajib punya kesimpulan. Sama dengan VerificationWriteSerializer.
            models.CheckConstraint(
                condition=(
                    Q(status=VerificationStatus.COMPLETED) & ~Q(outcome="")
                ) | (~Q(status=VerificationStatus.COMPLETED) & Q(outcome="")),
                name="verification_outcome_matches_status",
            ),
        ]
