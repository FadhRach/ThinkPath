"""Hapus akun: baris DB dan berkas MEDIA_ROOT (dokumen, audio Cek Paham); sisa disapu purge_stale_data.

Kelas dosen yang menghapus akun TIDAK dihapus: Class.owner -> NULL, jadi arsip baca-saja.
Impor lintas app di dalam fungsi: accounts lapisan terbawah.
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
    """Tulisan forum mahasiswa ikut dihapus; tulisan dosen dipertahankan (penulis dikosongkan) sebagai arsip kelas."""
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
