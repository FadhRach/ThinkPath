"""Forum kelas: pengumuman (hanya dosen pemilik, memicu notifikasi) dan diskusi, keduanya bisa dibalas.

Penulis SET_NULL saat akun dihapus; tulisan mahasiswa dihapus eksplisit di apps.accounts.deletion.
"""
from __future__ import annotations

import uuid

from django.db import models
from django.utils import timezone

from apps.academics.models import Class
from apps.accounts.models import Profile


class PostKind(models.TextChoices):
    ANNOUNCEMENT = "announcement", "Pengumuman"
    DISCUSSION = "discussion", "Diskusi"


class ForumPost(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    class_ref = models.ForeignKey(
        Class, on_delete=models.CASCADE, related_name="forum_posts", db_column="class_id"
    )
    author = models.ForeignKey(
        Profile, null=True, blank=True, on_delete=models.SET_NULL, related_name="forum_posts"
    )
    kind = models.CharField(max_length=16, choices=PostKind.choices, default=PostKind.DISCUSSION)
    title = models.CharField(max_length=160)
    body = models.TextField()
    created_at = models.DateTimeField(default=timezone.now)
    # Naik setiap ada balasan, supaya diskusi yang sedang hidup ada di atas.
    last_activity_at = models.DateTimeField(default=timezone.now)

    class Meta:
        db_table = "forum_posts"
        indexes = [
            models.Index(fields=["class_ref", "-last_activity_at"], name="forum_post_class_recent_idx"),
        ]

    def __str__(self) -> str:
        return self.title


class ForumReply(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    post = models.ForeignKey(ForumPost, on_delete=models.CASCADE, related_name="replies")
    author = models.ForeignKey(
        Profile, null=True, blank=True, on_delete=models.SET_NULL, related_name="forum_replies"
    )
    body = models.TextField()
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        db_table = "forum_replies"
        indexes = [models.Index(fields=["post", "created_at"], name="forum_reply_post_idx")]
