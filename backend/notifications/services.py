"""Operasi generik atas notifikasi, tanpa tahu apa pun soal kelas atau tugas.

Tiga cara mengirim, karena tiga kebutuhan yang berbeda:

- notify: satu notifikasi per penerima, misalnya "Tugas baru".
- notify_grouped: digabung selama belum dibaca, supaya dosen dengan empat puluh
  mahasiswa menerima "40 pengumpulan baru", bukan empat puluh baris.
- notify_once: dikirim sekali seumur hidup, untuk pengingat tenggat yang tidak
  boleh muncul lagi setelah dibaca.

Kegagalan menulis notifikasi tidak boleh menggagalkan aksi utamanya. Mahasiswa
yang mengumpulkan jawaban tidak peduli apakah lonceng dosennya berbunyi, jadi
seluruh pemanggil membungkus panggilan ini dengan safe().
"""
from __future__ import annotations

import logging
from collections.abc import Callable, Iterable
from datetime import datetime
from uuid import UUID

from django.db import IntegrityError, transaction
from django.utils import timezone

from .models import Notification

logger = logging.getLogger(__name__)

# Jumlah notifikasi yang dikirim ke lonceng. Yang lebih lama tetap tersimpan,
# tetapi daftar sepanjang itu tidak pernah dibaca siapa pun.
LIST_LIMIT = 30


def safe(action: Callable[[], object]) -> None:
    """Jalankan pengiriman notifikasi tanpa pernah menggagalkan pemanggilnya.

    Dibungkus savepoint sendiri. Tanpa itu, galat basis data di dalam
    transaksi pemanggil membuat seluruh transaksinya tidak bisa dipakai lagi,
    walaupun galatnya sudah ditangkap di sini.
    """
    try:
        with transaction.atomic():
            action()
    except Exception:  # noqa: BLE001 - notifikasi tidak boleh merobohkan aksi utama
        logger.exception("Notifikasi gagal dikirim")


def notify(
    recipient_ids: Iterable[UUID],
    *,
    kind: str,
    title: str,
    body: str = "",
    link: str = "",
    event_at: datetime | None = None,
) -> int:
    rows = [
        Notification(
            recipient_id=recipient_id,
            kind=kind,
            title=title[:200],
            body=body[:300],
            link=link[:300],
            event_at=event_at,
        )
        for recipient_id in set(recipient_ids)
    ]
    Notification.objects.bulk_create(rows)
    return len(rows)


def notify_grouped(
    recipient_id: UUID,
    *,
    kind: str,
    group_key: str,
    build: Callable[[int], tuple[str, str]],
    link: str = "",
) -> Notification:
    """Gabungkan dengan notifikasi berkunci sama yang belum dibaca.

    build menerima jumlah kejadian dan mengembalikan (judul, isi), sehingga
    kalimatnya selalu sesuai angkanya. Notifikasi yang digabung naik ke atas
    daftar dan kembali belum dibaca.
    """
    with transaction.atomic():
        existing = (
            Notification.objects.select_for_update()
            .filter(recipient_id=recipient_id, group_key=group_key, read_at__isnull=True)
            .order_by("-created_at")
            .first()
        )
        count = existing.count + 1 if existing else 1
        title, body = build(count)
        if existing:
            existing.count = count
            existing.title = title[:200]
            existing.body = body[:300]
            existing.link = link[:300]
            existing.created_at = timezone.now()
            existing.save(update_fields=["count", "title", "body", "link", "created_at"])
            return existing
        return Notification.objects.create(
            recipient_id=recipient_id,
            kind=kind,
            group_key=group_key,
            count=1,
            title=title[:200],
            body=body[:300],
            link=link[:300],
        )


def notify_once(
    recipient_id: UUID,
    *,
    kind: str,
    group_key: str,
    title: str,
    body: str = "",
    link: str = "",
    event_at: datetime | None = None,
) -> bool:
    """Kirim hanya bila penerima belum pernah menerima kunci ini, dibaca atau belum."""
    exists = Notification.objects.filter(
        recipient_id=recipient_id, group_key=group_key
    ).exists()
    if exists:
        return False
    try:
        # Savepoint sendiri, supaya pelanggaran unik tidak merusak transaksi
        # pemanggil yang masih akan membaca daftar notifikasi.
        with transaction.atomic():
            Notification.objects.create(
                recipient_id=recipient_id,
                kind=kind,
                group_key=group_key,
                title=title[:200],
                body=body[:300],
                link=link[:300],
                event_at=event_at,
            )
    except IntegrityError:
        # Permintaan lain baru saja membuatnya lebih dulu.
        return False
    return True


def recent_for(recipient_id: UUID) -> tuple[list[Notification], int]:
    """Notifikasi terbaru untuk lonceng, beserta jumlah yang belum dibaca."""
    mine = Notification.objects.filter(recipient_id=recipient_id)
    items = list(mine.order_by("-created_at")[:LIST_LIMIT])
    unread = mine.filter(read_at__isnull=True).count()
    return items, unread


def mark_read(recipient_id: UUID, ids: Iterable[UUID] | None = None) -> int:
    """Tandai dibaca. Tanpa ids berarti seluruhnya. Milik orang lain tidak tersentuh."""
    unread = Notification.objects.filter(recipient_id=recipient_id, read_at__isnull=True)
    if ids is not None:
        unread = unread.filter(id__in=list(ids))
    return unread.update(read_at=timezone.now())
