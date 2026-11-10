"""Notifikasi dalam aplikasi, disimpan per penerima agar status "sudah dibaca" bisa dilacak."""
from __future__ import annotations

import uuid

from django.db import models
from django.utils import timezone

from apps.accounts.models import Profile


class NotificationKind(models.TextChoices):
    # Untuk mahasiswa
    ASSIGNMENT_NEW = "assignment_new", "Tugas baru"
    MATERIAL_NEW = "material_new", "Materi baru"
    ANNOUNCEMENT_NEW = "announcement_new", "Pengumuman kelas"
    SUBMISSION_GRADED = "submission_graded", "Jawaban dinilai"
    DEADLINE_SOON = "deadline_soon", "Tenggat dekat"
    CEKPAHAM_NEW = "cekpaham_new", "Cek Paham"
    CEKPAHAM_RESOLVED = "cekpaham_resolved", "Laporan Cek Paham ditanggapi"
    FORUM_POST_NEW = "forum_post_new", "Topik forum baru"
    FORUM_REPLY_NEW = "forum_reply_new", "Balasan forum"
    # Untuk dosen
    SUBMISSIONS_NEW = "submissions_new", "Pengumpulan baru"
    STUDENTS_JOINED = "students_joined", "Mahasiswa bergabung"
    CEKPAHAM_RESULT = "cekpaham_result", "Hasil Cek Paham"


class Notification(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    recipient = models.ForeignKey(
        Profile,
        on_delete=models.CASCADE,
        related_name="notifications",
    )
    kind = models.CharField(max_length=32, choices=NotificationKind.choices)
    title = models.CharField(max_length=200)
    body = models.CharField(max_length=300, blank=True, default="")
    # Rute frontend yang dibuka ketika notifikasi diklik.
    link = models.CharField(max_length=300, blank=True, default="")
    # Disimpan sebagai waktu, bukan di kalimat: backend UTC, jam diformat frontend di zona pembaca.
    event_at = models.DateTimeField(null=True, blank=True)
    # Kunci penggabung (notify_grouped) dan pengingat sekali kirim (notify_once).
    group_key = models.CharField(max_length=120, blank=True, default="")
    count = models.PositiveIntegerField(default=1)
    created_at = models.DateTimeField(default=timezone.now)
    read_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "notifications"
        indexes = [
            models.Index(fields=["recipient", "-created_at"], name="notif_recipient_recent_idx"),
            models.Index(fields=["recipient", "group_key"], name="notif_recipient_group_idx"),
            # Index parsial hanya baris belum dibaca: hitungan lonceng tetap murah.
            models.Index(
                fields=["recipient"],
                condition=models.Q(read_at__isnull=True),
                name="notif_unread_idx",
            ),
        ]
        constraints = [
            # Satu pengingat tenggat per mahasiswa per tugas; cek di notify_once saja kalah balapan antar permintaan.
            models.UniqueConstraint(
                fields=["recipient", "group_key"],
                condition=models.Q(kind="deadline_soon"),
                name="notif_deadline_once",
            ),
        ]

    def __str__(self) -> str:
        return self.title
