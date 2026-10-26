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
    "algo": [
        ("asistensi", PostKind.ANNOUNCEMENT, None, "Jadwal asistensi praktikum",
         "Asistensi praktikum dibuka setiap Rabu pukul 15.00 sampai 17.00 di Lab 612. Bawa laptop dan kode "
         "yang error, kita bedah bersama.", 6,
         [(2, "Pak, kalau kodenya error di bagian input apakah boleh dibawa juga?", 5),
          (None, "Boleh. Justru error seperti itu yang paling sering muncul di ujian.", 5)]),
        ("recursion", PostKind.DISCUSSION, 9, "RecursionError di faktorial",
         "Faktorial rekursif saya error saat n = 5000. Apakah itu salah kode atau memang batasnya?", 3,
         [(1, "Itu batas kedalaman rekursi Python, bawaannya sekitar 1000. Versi iteratif tidak kena batas itu.", 3),
          (None, "Betul. Ini bahan bagus untuk bagian perbandingan di tugas rekursi.", 2)]),
        ("uts", PostKind.ANNOUNCEMENT, None, "Kisi-kisi UTS",
         "UTS mencakup sesi 1 sampai 7: flowchart, percabangan, perulangan, fungsi, list, dan string. "
         "Soal berupa tracing kode dan menulis fungsi pendek.", 20, []),
    ],
    "os": [
        ("strace", PostKind.DISCUSSION, 4, "strace tidak ada di WSL",
         "Saat menjalankan strace di WSL muncul command not found. Ada yang tahu cara memasangnya?", 30,
         [(13, "Jalankan sudo apt install strace dulu, setelah itu bisa dipakai.", 30)]),
        ("lab", PostKind.ANNOUNCEMENT, None, "Format laporan praktikum",
         "Laporan praktikum boleh diketik langsung atau diunggah sebagai PDF. Sertakan tabel hasil simulasi "
         "dan analisis singkat, bukan hanya tangkapan layar.", 2,
         [(17, "Pak, untuk tabel pergerakan head boleh tulisan tangan lalu difoto?", 1),
          (None, "Boleh, asal terbaca jelas. Sistem akan membaca teksnya otomatis.", 1)]),
    ],
    "ai": [
        ("colab", PostKind.DISCUSSION, 11, "Colab tidak bisa dibuka dosen?",
         "Kalau membagikan notebook Colab, aksesnya harus diatur ke siapa saja yang punya tautan, ya?", 24,
         [(None, "Ya, atur ke Anyone with the link dengan akses Viewer.", 24)]),
        ("bias", PostKind.DISCUSSION, 3, "Contoh bias data untuk esai etika",
         "Saya mencari contoh bias data yang terjadi di Indonesia untuk tugas sesi 12. Ada saran bacaan?", 1,
         [(15, "Coba cari kasus penilaian kredit daring, banyak dibahas di berita.", 0)]),
        ("kuis", PostKind.ANNOUNCEMENT, None, "Kuis singkat decision tree",
         "Minggu depan ada kuis 15 menit tentang entropi dan information gain. Bawa kalkulator.", 4, []),
    ],
    "biz": [
        ("kelompok", PostKind.ANNOUNCEMENT, None, "Pembagian kelompok usaha",
         "Kelompok usaha sudah dibagi, masing-masing empat orang. Ide usaha dipakai sampai pitch deck di sesi 12, "
         "jadi pilih masalah yang benar-benar kalian pahami.", 60,
         [(5, "Pak, apakah satu kelompok boleh ganti ide setelah sesi 3?", 59),
          (None, "Boleh sampai sesi 4, setelah itu fokus mengembangkan.", 59)]),
        ("survei", PostKind.DISCUSSION, 12, "Butuh responden survei katering",
         "Kelompok kami butuh 30 responden mahasiswa kos untuk validasi MVP. Boleh minta tolong isi formulirnya?", 8,
         [(7, "Sudah saya isi. Pertanyaan soal harga sebaiknya diberi pilihan rentang.", 8)]),
        ("pitch", PostKind.ANNOUNCEMENT, None, "Presentasi pitch deck",
         "Presentasi pitch deck dilakukan di sesi 12, lima menit per kelompok ditambah tanya jawab tiga menit.", 1, []),
    ],
}


def _id(*parts: str) -> uuid.UUID:
    return uuid.uuid5(_NAMESPACE, ":".join(parts))


def seed_forum_demo(classes: dict, students) -> int:
    """Pengumuman dan diskusi tiap kelas; dosen penulis = pemilik kelas."""
    now = timezone.now()
    count = 0
    for class_label, posts in _POSTS.items():
        klass = classes[class_label]
        teacher = klass.owner
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
