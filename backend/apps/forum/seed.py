"""Data demo forum: pengumuman, diskusi, dan balasan. Idempoten (id tetap)."""
from __future__ import annotations

import uuid
from datetime import timedelta

from django.utils import timezone

from apps.forum.models import ForumPost, ForumReply, PostKind

_NAMESPACE = uuid.UUID("c0ffee00-0000-4000-8000-00000000f0f0")

# kelas -> daftar (kunci, jenis, indeks penulis mahasiswa atau None untuk dosen, judul, isi, hari lalu, balasan)
# balasan: (indeks penulis mahasiswa atau None untuk dosen, isi, hari lalu)
_POSTS = {
    "metpen-a": [
        (
            "konsultasi",
            PostKind.ANNOUNCEMENT,
            None,
            "Jadwal konsultasi proposal",
            "Konsultasi proposal dibuka Selasa dan Kamis pukul 13.00 sampai 15.00 di ruang dosen. "
            "Bawa rumusan masalah dan kerangka kajian pustaka yang sudah kalian susun.",
            2,
            [(0, "Baik, Bu. Untuk pertemuan pertama cukup membawa rumusan masalah saja?", 1),
             (None, "Cukup. Kerangka kajian pustaka boleh menyusul di pertemuan kedua.", 1)],
        ),
        (
            "moderator",
            PostKind.DISCUSSION,
            1,
            "Beda variabel moderator dan mediator?",
            "Saya masih bingung membedakan keduanya untuk desain penelitian. Apakah ada contoh sederhana?",
            4,
            [(None, "Moderator mengubah kekuatan hubungan, mediator menjelaskan mekanismenya. "
                    "Contoh: motivasi memperkuat pengaruh jam belajar (moderator), sedangkan jam belajar "
                    "memengaruhi nilai lewat pemahaman materi (mediator).", 3)],
        ),
        (
            "sitasi",
            PostKind.DISCUSSION,
            2,
            "Format sitasi untuk kajian pustaka",
            "Apakah kita memakai APA 7 atau boleh format lain asal konsisten?",
            1,
            [(0, "Di silabus tertulis APA 7, Mas.", 0)],
        ),
    ],
    "ekbang-b": [
        (
            "uts",
            PostKind.ANNOUNCEMENT,
            None,
            "UTS dimajukan ke minggu depan",
            "UTS Ekonomi Pembangunan B dimajukan ke Jumat minggu depan. Materinya sampai pertemuan 7. "
            "Silakan bertanya di forum ini bila ada bagian yang belum jelas.",
            3,
            [],
        ),
        (
            "pdrb",
            PostKind.DISCUSSION,
            0,
            "Data PDRB dari mana?",
            "Untuk tugas ketimpangan antarwilayah, sumber data PDRB provinsi yang disarankan dari mana?",
            2,
            [(None, "Gunakan publikasi BPS terbaru dan cantumkan tahun datanya di catatan kaki.", 2)],
        ),
    ],
}


def _id(*parts: str) -> uuid.UUID:
    return uuid.uuid5(_NAMESPACE, ":".join(parts))


def seed_forum_demo(teacher, students, classes: dict) -> int:
    now = timezone.now()
    count = 0
    for class_label, posts in _POSTS.items():
        klass = classes[class_label]
        for key, kind, author_index, title, body, days_ago, replies in posts:
            author = teacher if author_index is None else students[author_index]
            created = now - timedelta(days=days_ago, hours=2)
            post, _ = ForumPost.objects.update_or_create(
                id=_id("post", class_label, key),
                defaults={
                    "class_ref": klass,
                    "author": author,
                    "kind": kind,
                    "title": title,
                    "body": body,
                    "created_at": created,
                    "last_activity_at": created,
                },
            )
            last = created
            for index, (reply_author_index, text, reply_days_ago) in enumerate(replies):
                replied_at = max(created + timedelta(hours=1), now - timedelta(days=reply_days_ago, hours=1))
                ForumReply.objects.update_or_create(
                    id=_id("reply", class_label, key, str(index)),
                    defaults={
                        "post": post,
                        "author": teacher if reply_author_index is None else students[reply_author_index],
                        "body": text,
                        "created_at": replied_at,
                    },
                )
                last = max(last, replied_at)
            ForumPost.objects.filter(pk=post.pk).update(last_activity_at=last)
            count += 1
    return count
