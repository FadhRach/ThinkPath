"""Kirim notifikasi: notify (per penerima), notify_grouped (digabung selama belum dibaca), notify_once.

Pemanggil membungkusnya dengan safe(): notifikasi gagal tidak boleh menggagalkan aksi utama.
"""
from __future__ import annotations

import logging
from collections.abc import Callable, Iterable
from datetime import datetime
from uuid import UUID

from django.db import IntegrityError, transaction
from django.utils import timezone

from apps.notifications.models import Notification

logger = logging.getLogger(__name__)

# Batas daftar lonceng; yang lebih lama tetap tersimpan.
LIST_LIMIT = 30


def safe(action: Callable[[], object]) -> None:
    """Jalankan pengiriman tanpa menggagalkan pemanggil; savepoint sendiri agar transaksi pemanggil tetap sehat."""
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
        if recipient_id  # kelas arsip tidak punya dosen penerima
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
    """Gabung dengan notifikasi berkunci sama yang belum dibaca; build(jumlah) -> (judul, isi)."""
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
        # Savepoint sendiri agar pelanggaran unik tidak merusak transaksi pemanggil.
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
