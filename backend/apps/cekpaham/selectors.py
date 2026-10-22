"""Query baca untuk Cek Paham.

Seperti academics.selectors: kepemilikan dicek di memori setelah satu query,
dan objek milik orang lain dibalas 404 (bukan 403) agar keberadaannya tidak
bocor. Selector sendiri dipakai karena require_member_assignment membalas 403.
"""
from __future__ import annotations

from datetime import datetime
from uuid import UUID

from django.db.models import Exists, OuterRef, Q, QuerySet
from django.utils import timezone
from rest_framework.exceptions import NotFound

from apps.cekpaham.models import (
    AttemptStatus,
    CekPaham,
    CekPahamAttempt,
    CekPahamReport,
    ReportStatus,
    RequestStatus,
)
from common.http import parse_uuid_or_404, request_user_id

PHASES = ("upcoming", "open", "closed")


def phase_of(cekpaham: CekPaham, now: datetime | None = None) -> str:
    """Fase turunan dari waktu; tidak disimpan supaya tidak pernah basi."""
    if cekpaham.status == RequestStatus.CANCELLED:
        return "cancelled"
    now = now or timezone.now()
    if now < cekpaham.window_start:
        return "upcoming"
    return "open" if now <= cekpaham.window_end else "closed"


def _base() -> QuerySet[CekPaham]:
    return CekPaham.objects.select_related(
        "submission__assignment__class_ref", "submission__student_profile"
    )


def require_owned_cekpaham(request, cekpaham_id: str) -> CekPaham:
    """Cek Paham pada kelas milik dosen pemanggil."""
    cekpaham = _base().filter(pk=parse_uuid_or_404(cekpaham_id)).first()
    if cekpaham is None or cekpaham.submission.assignment.class_ref.owner_id != request_user_id(request):
        raise NotFound()
    return cekpaham


def require_own_cekpaham_student(request, cekpaham_id: str) -> CekPaham:
    """Cek Paham atas jawaban milik mahasiswa pemanggil."""
    cekpaham = _base().filter(
        pk=parse_uuid_or_404(cekpaham_id), submission__student_profile_id=request_user_id(request)
    ).first()
    if cekpaham is None:
        raise NotFound()
    return cekpaham


def require_report_for_teacher(request, report_id: str) -> CekPahamReport:
    report = (
        CekPahamReport.objects.select_related(
            "attempt__cekpaham__submission__assignment__class_ref",
            "attempt__cekpaham__submission__student_profile",
        )
        .filter(pk=parse_uuid_or_404(report_id))
        .first()
    )
    owner_id = report.attempt.cekpaham.submission.assignment.class_ref.owner_id if report else None
    if report is None or owner_id != request_user_id(request):
        raise NotFound()
    return report


def live_attempt(cekpaham: CekPaham) -> CekPahamAttempt | None:
    """Attempt yang masih berlaku (belum di-void dosen), atau None.

    Dibaca lewat `.all()` supaya hasil prefetch terpakai dan antrean tidak
    menjalankan satu query per baris. Tanpa prefetch, ini satu query biasa.
    """
    live = [a for a in cekpaham.attempts.all() if a.status != AttemptStatus.VOIDED]
    return max(live, key=lambda a: a.number) if live else None


def require_attempt(cekpaham: CekPaham, number: int) -> CekPahamAttempt:
    attempt = cekpaham.attempts.filter(number=number).first()
    if attempt is None:
        raise NotFound()
    return attempt


def teacher_queue(
    owner_id: UUID,
    *,
    status: str | None = None,
    phase: str | None = None,
    has_open_report: bool | None = None,
) -> QuerySet[CekPaham]:
    queryset = (
        _base()
        .filter(submission__assignment__class_ref__owner_id=owner_id)
        .prefetch_related("attempts")
        .order_by("-created_at")
    )
    if status in RequestStatus.values:
        queryset = queryset.filter(status=status)
    now = timezone.now()
    active = Q(status=RequestStatus.ACTIVE)
    by_phase = {
        "upcoming": active & Q(window_start__gt=now),
        "open": active & Q(window_start__lte=now, window_end__gte=now),
        "closed": active & Q(window_end__lt=now),
    }
    if phase in by_phase:
        queryset = queryset.filter(by_phase[phase])
    if has_open_report is not None:
        open_report = CekPahamReport.objects.filter(
            attempt__cekpaham=OuterRef("pk"), status=ReportStatus.OPEN
        )
        queryset = queryset.filter(Exists(open_report) if has_open_report else ~Exists(open_report))
    return queryset
