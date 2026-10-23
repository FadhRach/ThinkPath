"""Model profil pengguna ThinkPath.

Identitas dikelola sendiri oleh backend (email + password ter-hash).
Password selalu di-set lewat set_password, tidak pernah disimpan mentah.
"""
from __future__ import annotations

import uuid

from django.contrib.auth.hashers import check_password, make_password
from django.db import models
from django.db.models.functions import Lower
from django.utils import timezone


class Role(models.TextChoices):
    TEACHER = "teacher", "Teacher"
    STUDENT = "student", "Student"


class EducationLevel(models.TextChoices):
    """Jenjang studi mahasiswa.

    Sebelumnya berisi SD, SMP, dan SMA-SMK. Fokus produk dipindahkan ke
    mahasiswa, sehingga populasi yang dianalisis seragam dan kalibrasi model
    tidak perlu berbeda per jenjang sekolah.

    Nama kelas dipertahankan agar impor di academics dan serializers tidak
    berubah. Hanya pilihannya yang diganti.
    """

    D3 = "D3", "D3"
    S1 = "S1", "S1"
    S2 = "S2", "S2"
    S3 = "S3", "S3"


def normalize_email(email: str) -> str:
    return (email or "").strip().lower()


class Profile(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    # Selalu disimpan lowercase (lihat save); unik tanpa peduli huruf besar.
    email = models.EmailField()
    # Selalu berisi hash (set_password); default kosong hanya untuk migrasi.
    password = models.CharField(max_length=128, default="")
    display_name = models.CharField(max_length=120, blank=True, default="")
    # Tanpa default: peran harus dipilih eksplisit saat mendaftar.
    role = models.CharField(max_length=16, choices=Role.choices)
    # Jenjang yang diisi pengguna di halaman Pengaturan. Analisis memakai
    # jenjang milik kelas (Class.education_level), bukan kolom ini.
    education_level = models.CharField(
        max_length=16,
        choices=EducationLevel.choices,
        blank=True,
        default="",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "profiles"
        constraints = [
            models.UniqueConstraint(Lower("email"), name="profile_email_ci_unique"),
        ]

    def save(self, *args, **kwargs):
        self.email = normalize_email(self.email)
        super().save(*args, **kwargs)

    def set_password(self, raw_password: str) -> None:
        self.password = make_password(raw_password)

    def check_password(self, raw_password: str) -> bool:
        return check_password(raw_password, self.password)

    @property
    def label(self) -> str:
        """Nama untuk ditampilkan; email menjadi cadangan bila nama kosong."""
        return self.display_name or self.email

    def __str__(self) -> str:
        return self.label


class ConsentAction(models.TextChoices):
    GIVEN = "given", "Diberikan"
    # Hanya ada di riwayat lama, saat pilihan opsional masih bisa diubah.
    UPDATED = "updated", "Diperbarui"
    WITHDRAWN = "withdrawn", "Ditarik"


class ConsentRecord(models.Model):
    """Bukti persetujuan pemrosesan data pribadi, satu baris per peristiwa.

    UU No. 27 Tahun 2022 mewajibkan persetujuan tertulis atau terekam
    (Pasal 22 ayat (1)) dan mewajibkan pengendali menunjukkan buktinya
    (Pasal 24). Karena itu baris di sini tidak pernah diubah atau ditimpa:
    memberi, mengubah pilihan, dan menarik persetujuan masing-masing menjadi
    baris baru, sehingga riwayatnya utuh dan bisa ditunjukkan kepada pemiliknya.
    Keadaan yang berlaku adalah baris terbaru; lihat apps.accounts.privacy.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    profile = models.ForeignKey(
        Profile,
        on_delete=models.CASCADE,
        related_name="consents",
    )
    action = models.CharField(max_length=16, choices=ConsentAction.choices)
    # Versi kebijakan yang dibaca saat keputusan diambil. Persetujuan untuk
    # versi lama tidak berlaku lagi setelah kebijakannya berubah.
    policy_version = models.CharField(max_length=20)
    # Kunci butir yang disetujui, lihat apps.accounts.privacy. Kosong saat ditarik.
    items = models.JSONField(default=list, blank=True)
    # Asal persetujuan (register, reaccept, withdraw, seed): bukti bagaimana
    # persetujuan diperoleh. Tidak menyimpan IP; lihat kebijakan privasi.
    source = models.CharField(max_length=16, blank=True, default="")
    # Bukan auto_now_add: apps.accounts.privacy.record_consent menjamin waktunya selalu
    # naik per pengguna, karena keadaan yang berlaku dibaca dari baris terbaru.
    created_at = models.DateTimeField(default=timezone.now, editable=False)

    class Meta:
        db_table = "consent_records"
        indexes = [
            models.Index(fields=["profile", "-created_at"], name="consent_profile_recent_idx"),
        ]


class AuthSession(models.Model):
    """Satu sesi login. Token memuat `sid` ini; mencabut baris = mencabut token.

    Sebelumnya logout hanya menghapus cookie, dan token yang dicuri tetap sah
    sampai kedaluwarsa (7 hari). Kini setiap permintaan memeriksa sesinya
    (satu query by primary key, di-cache sebentar di memori proses).
    Tidak menyimpan IP atau user-agent: kebijakan privasi menjanjikan IP tidak
    disimpan di basis data.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    profile = models.ForeignKey(Profile, on_delete=models.CASCADE, related_name="sessions")
    created_at = models.DateTimeField(default=timezone.now)
    expires_at = models.DateTimeField()
    revoked_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "auth_sessions"
        indexes = [models.Index(fields=["profile"], name="auth_session_profile_idx")]


class PasswordResetToken(models.Model):
    """Tautan atur-ulang sandi sekali pakai. Yang disimpan hanya hash tokennya,
    jadi isi tabel ini tidak cukup untuk mengambil alih akun."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    profile = models.ForeignKey(Profile, on_delete=models.CASCADE, related_name="reset_tokens")
    token_hash = models.CharField(max_length=64, unique=True)
    created_at = models.DateTimeField(default=timezone.now)
    expires_at = models.DateTimeField()
    used_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "password_reset_tokens"
        indexes = [models.Index(fields=["profile", "-created_at"], name="pwreset_profile_recent_idx")]


class AccountDeletion(models.Model):
    """Bukti bahwa sebuah akun sudah dihapus, tanpa data pribadi apa pun.

    Hak penghapusan (UU PDP) menuntut data benar-benar hilang, termasuk bukti
    persetujuan di ConsentRecord yang ikut terhapus bersama akun. Yang tersisa
    hanya catatan anonim ini: id acak (bukan id profil), peran, kapan, dan
    berapa berkas yang dihapus, cukup untuk menunjukkan bahwa permintaan
    penghapusan dilayani tanpa menyimpan siapa orangnya.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    role = models.CharField(max_length=16, choices=Role.choices)
    policy_version = models.CharField(max_length=20, blank=True, default="")
    files_removed = models.PositiveIntegerField(default=0)
    rows_removed = models.PositiveIntegerField(default=0)
    deleted_at = models.DateTimeField(default=timezone.now)

    class Meta:
        db_table = "account_deletions"
