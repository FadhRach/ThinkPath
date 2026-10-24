"""Penghapusan akun: baris basis data DAN berkas di disk, sampai tuntas.

`ON DELETE CASCADE` hanya menghapus baris. Dokumen unggahan
(`documents/<mahasiswa>/...`) dan audio Cek Paham (`cekpaham/<mahasiswa>/...`)
ada di MEDIA_ROOT dan tidak ikut terhapus oleh basis data, jadi daftar
jalurnya dikumpulkan SEBELUM baris dihapus, lalu berkasnya dihapus setelah
transaksi selesai. Berkas yang gagal terhapus tidak tertaut ke baris mana pun,
dan `manage.py purge_stale_data` menyapunya.

Dosen yang menghapus akun TIDAK menghapus kelasnya. Kelas, tugas, materi,
forum (termasuk pengumuman), dan jawaban mahasiswa tetap tersimpan sebagai arsip (`Class.owner`
menjadi kosong, `owner_left_at` terisi) dan mahasiswa melihat peringatannya.
Data itu milik mahasiswa juga, dan menghapusnya diam-diam merusak riwayat
mereka. Hitungannya tersedia lebih dulu lewat `deletion_impact`.

Impor model lintas aplikasi sengaja di dalam fungsi: accounts adalah lapisan
paling bawah dan tidak boleh bergantung pada academics saat dimuat.
"""
from __future__ import annotations

import logging

from django.core.files.storage import default_storage
from django.db import transaction
from django.utils import timezone

from apps.accounts.models import AccountDeletion, Profile, Role
from apps.accounts.privacy import latest_record

logger = logging.getLogger(__name__)

CONFIRM_PHRASE = "HAPUS"


def _list_files(folder: str) -> list[str]:
    try:
        _, names = default_storage.listdir(folder)
    except FileNotFoundError:
        return []
    return [f"{folder}/{name}" for name in names]


def collect_media_paths(profile: Profile) -> set[str]:
    """Berkas pribadi pemilik akun. Berkas mahasiswa di kelas dosen tidak ikut:
    kelas itu tetap ada sebagai arsip (lihat docstring modul)."""
    return {
        *_list_files(f"documents/{profile.id}"),
        *_list_files(f"cekpaham/{profile.id}"),
    }


def deletion_impact(profile: Profile) -> dict:
    """Apa yang ikut hilang, untuk layar konfirmasi."""
    from apps.academics.models import Class, ClassMembership, Submission

    if profile.role == Role.TEACHER:
        classes = Class.objects.filter(owner=profile)
        return {
            "role": profile.role,
            "classes": classes.count(),
            "students": ClassMembership.objects.filter(class_ref__in=classes).values("student_profile").distinct().count(),
            "submissions": Submission.objects.filter(assignment__class_ref__in=classes).count(),
            "files": len(collect_media_paths(profile)),
            # Kelas dan jawaban ini TIDAK dihapus; layar konfirmasi menjelaskannya.
            "classes_kept_as_archive": True,
        }
    return {
        "role": profile.role,
        "classes": ClassMembership.objects.filter(student_profile=profile).count(),
        "submissions": Submission.objects.filter(student_profile=profile).count(),
        "files": len(collect_media_paths(profile)),
    }


def _purge_forum_content(profile: Profile) -> None:
    """Tulisan forum mahasiswa adalah data pribadinya dan ikut dihapus.

    Tulisan dosen justru dipertahankan (penulis dikosongkan): itu bagian dari arsip kelas.
    """
    from apps.forum.models import ForumPost, ForumReply

    ForumReply.objects.filter(author=profile).delete()
    ForumPost.objects.filter(author=profile).delete()


def delete_account(profile: Profile) -> dict:
    """Hapus akun beserta semua turunannya. Mengembalikan ringkasan yang dihapus."""
    from apps.academics.models import Class

    paths = collect_media_paths(profile)
    consent = latest_record(profile.id)
    with transaction.atomic():
        # Tandai sebelum owner dikosongkan oleh SET_NULL.
        Class.objects.filter(owner=profile).update(owner_left_at=timezone.now())
        if profile.role == Role.STUDENT:
            _purge_forum_content(profile)
        total_rows, _ = profile.delete()
        AccountDeletion.objects.create(
            role=profile.role,
            policy_version=consent.policy_version if consent else "",
            files_removed=len(paths),
            rows_removed=total_rows,
        )
    failed = 0
    for path in paths:
        try:
            default_storage.delete(path)
        except OSError:
            failed += 1
            logger.exception("Berkas %s gagal dihapus; akan disapu purge_stale_data", path)
    return {"rows": total_rows, "files": len(paths) - failed, "files_failed": failed}
