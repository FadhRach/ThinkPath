"""Model akademik: Class, Assignment, Submission, ReasoningEvent, AnalysisResult.

Skema mengikuti docs/DATABASE.md. Catatan F-07 (penting): TIDAK ada field
idle_time/idle_seconds di Submission - sengaja dihilangkan karena ambigu.
"""
from __future__ import annotations

import uuid

from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models

from core.models import EducationLevel, Profile


class AiBand(models.TextChoices):
    LOW = "low", "Low"
    MID = "mid", "Mid"
    HIGH = "high", "High"


class Confidence(models.TextChoices):
    LOW = "low", "Low"
    MEDIUM = "medium", "Medium"
    HIGH = "high", "High"


class AnalysisSource(models.TextChoices):
    """Mesin yang menghasilkan SKOR AI pada satu baris AnalysisResult.

    Wajib disimpan. Tanpa ini, hasil heuristik dangkal dan hasil LLM tersimpan
    identik di database, sehingga grafik tren dan laporan agregat tidak bisa
    membedakan mana yang layak dipercaya.

    Perhatikan cakupannya: field ini menerangkan asal SKOR AI, bukan asal
    seluruh baris. Sejak detektor eksternal dipakai, skor AI dan level Bloom
    bisa datang dari mesin yang berbeda pada satu submission yang sama -
    detektor memberi skor AI sementara level Bloom tetap dari LLM atau dari
    heuristik. Cakupan sempit ini disengaja dan cocok dengan tempatnya di layar
    dosen, tepat di sebelah cincin skor AI. Keyakinan taksiran Bloom punya
    fieldnya sendiri di bloom_confidence.

    DETECTOR sengaja tidak menyebut nama penyedia. Penyedia sudah terbukti bisa
    gugur: integrasi pertama memakai Sapling dan dibatalkan setelah ketahuan
    English-only. Kalau nilainya "sapling" atau "winston", tiap pergantian
    penyedia menuntut migrasi dan perubahan frontend, dan baris lama jadi
    membingungkan. Nama penyedia beserta versi modelnya tercatat per baris di
    dalam signal_breakdown, jadi jejak auditnya tetap ada tanpa mengubah skema.
    """

    LLM = "llm", "LLM"
    HEURISTIC = "heuristic", "Heuristic"
    SEED = "seed", "Seed demo"
    DETECTOR = "detector", "External detector"


class EventType(models.TextChoices):
    STARTED = "started", "Started"
    REVISION = "revision", "Revision"
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

    def __str__(self) -> str:
        return self.title


class Submission(models.Model):
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


class AnalysisResult(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    submission = models.OneToOneField(
        Submission,
        on_delete=models.CASCADE,
        related_name="analysis",
    )
    ai_score = models.SmallIntegerField(
        validators=[MinValueValidator(0), MaxValueValidator(100)],
    )
    ai_band = models.CharField(max_length=8, choices=AiBand.choices)
    bloom_level = models.SmallIntegerField(
        validators=[MinValueValidator(1), MaxValueValidator(6)],
    )
    confidence = models.CharField(
        max_length=8,
        choices=Confidence.choices,
        blank=True,
        default="",
    )
    # Keyakinan terhadap taksiran Bloom, terpisah dari keyakinan skor AI.
    # Dua taksiran yang dihitung terpisah tidak boleh berbagi satu angka
    # keyakinan, karena teks bisa jelas di satu dimensi dan ambigu di dimensi
    # lain.
    bloom_confidence = models.CharField(
        max_length=8,
        choices=Confidence.choices,
        blank=True,
        default="",
    )
    # Daftar string bahasa Indonesia (maks 4) yang mendeskripsikan sinyal.
    signals = models.JSONField(default=list, blank=True)
    # Rincian kontribusi tiap sinyal ke skor AI. Inilah yang membuat skor bisa
    # ditinjau dosen alih alih diterima begitu saja.
    signal_breakdown = models.JSONField(default=list, blank=True)
    summary = models.TextField(blank=True, default="")
    recommendation = models.TextField(blank=True, default="")
    analysis_source = models.CharField(
        max_length=16,
        choices=AnalysisSource.choices,
        default=AnalysisSource.HEURISTIC,
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "analysis_results"


class DetectorScore(models.Model):
    """Skor detektor eksternal yang pernah dibayar, disimpan agar tidak dibayar dua kali.

    Detektor menagih per kata, bukan per permintaan. Tanpa tabel ini, setiap
    penekanan tombol "Analisis Ulang" pada jawaban yang teksnya tidak berubah
    membayar penuh lagi untuk teks yang sama. Dosen menekan tombol itu justru
    ketika ia ragu pada angkanya, yaitu saat skor itu paling penting, sehingga
    pemborosannya terjadi tepat di kasus yang paling sering.

    Ini cache basis data, bukan cache Django. `locmem` tidak dibagi antar worker
    gunicorn dan hilang setiap restart, jadi ia tidak menyelesaikan apa pun yang
    sedang diselesaikan di sini.

    Teks jawabannya sendiri TIDAK ikut disimpan, hanya SHA-256 nya. Jawabannya
    sudah ada di Submission.text_answer, dan menyalinnya ke tabel kedua hanya
    menggandakan data pribadi mahasiswa tanpa menambah apa pun.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    text_hash = models.CharField(max_length=64)
    # Tiga kolom di bawah ikut menjadi kunci, bukan sekadar catatan.
    #
    # detector.py sengaja memaku MODEL_VERSION supaya skor yang tersimpan hari
    # ini masih bisa dijelaskan enam bulan lagi. Kalau versinya dinaikkan, skor
    # lama tidak boleh dipakai ulang karena ia berasal dari model yang berbeda.
    # Dengan versi ikut di dalam kunci, menaikkannya otomatis membatalkan
    # seluruh cache lama tanpa ada yang perlu ingat menghapusnya. Alasan yang
    # sama berlaku untuk provider dan language.
    provider = models.CharField(max_length=32)
    model_version = models.CharField(max_length=16)
    language = models.CharField(max_length=8)
    # SUDAH dibalik menjadi probabilitas AI 0..1, konvensi yang sama dengan
    # cache kalibrasi di ai_experiment. Menyimpan "human score" mentah di kolom
    # ini akan membuat seluruh baris lama terbaca terbalik tanpa satu pun gejala:
    # angkanya tetap masuk akal, hanya menuduh orang yang salah.
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
        ]
