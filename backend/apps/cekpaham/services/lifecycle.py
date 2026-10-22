"""Membuat, membatalkan, dan menyelesaikan laporan Cek Paham."""
from __future__ import annotations

from datetime import datetime, timedelta

from django.db import IntegrityError, transaction
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from apps.academics.models import Submission
from apps.accounts.models import Profile
from apps.cekpaham.keyterms import extract_keyterms
from apps.cekpaham.models import (
    AttemptStatus,
    CekPaham,
    CekPahamAttempt,
    CekPahamReport,
    ReportStatus,
    RequestStatus,
)
from apps.cekpaham.services.attempts import expire_stale

MAX_REPORTS_PER_ATTEMPT = 3
# Syarat jendela: cukup untuk satu sesi ditambah waktu membaca petunjuk.
WINDOW_MARGIN_SECONDS = 60
RETRY_WINDOW_EXTENSION = timedelta(hours=24)
REPORTABLE = (
    AttemptStatus.SCORED,
    AttemptStatus.PROCESSING,
    AttemptStatus.PROCESSING_FAILED,
    AttemptStatus.INTERRUPTED,
)


def validate_window(start: datetime, end: datetime, answer_seconds: int) -> None:
    if end - start < timedelta(seconds=answer_seconds + WINDOW_MARGIN_SECONDS):
        raise ValidationError(
            {"window_end": f"Rentang waktu minimal {answer_seconds + WINDOW_MARGIN_SECONDS} detik "
                           "(waktu menjawab ditambah 1 menit)."}
        )


def create_request(teacher: Profile, submission: Submission, data: dict) -> CekPaham:
    validate_window(data["window_start"], data["window_end"], data["answer_seconds"])
    if data["window_end"] <= timezone.now():
        raise ValidationError({"window_end": "Batas akhir harus di masa depan."})
    try:
        with transaction.atomic():
            return CekPaham.objects.create(
                submission=submission,
                created_by=teacher,
                keyterms=extract_keyterms(
                    data["question_text"], submission.assignment.instructions, submission.text_answer
                ),
                **data,
            )
    except IntegrityError as exc:
        raise ValidationError(
            "Sudah ada Cek Paham aktif untuk jawaban ini. Batalkan yang lama bila ingin membuat baru."
        ) from exc


def cancel_request(cekpaham: CekPaham) -> CekPaham:
    if cekpaham.status == RequestStatus.CANCELLED:
        return cekpaham
    cekpaham.status = RequestStatus.CANCELLED
    cekpaham.cancelled_at = timezone.now()
    cekpaham.save(update_fields=["status", "cancelled_at"])
    return cekpaham


def report_attempt(cekpaham: CekPaham, reason: str, note: str) -> CekPahamReport:
    expire_stale(cekpaham)
    with transaction.atomic():
        attempt = (
            CekPahamAttempt.objects.select_for_update()
            .filter(cekpaham=cekpaham)
            .exclude(status=AttemptStatus.VOIDED)
            .first()
        )
        if attempt is None or attempt.status not in REPORTABLE:
            raise ValidationError("Belum ada hasil Cek Paham yang bisa dilaporkan.")
        if attempt.reports.count() >= MAX_REPORTS_PER_ATTEMPT:
            raise ValidationError("Batas laporan untuk sesi ini sudah tercapai.")
        return CekPahamReport.objects.create(attempt=attempt, reason=reason, note=note)


def resolve_report(
    teacher: Profile,
    report: CekPahamReport,
    resolution: str,
    response_note: str,
    extend_window_to: datetime | None,
) -> CekPahamReport:
    now = timezone.now()
    with transaction.atomic():
        report = CekPahamReport.objects.select_for_update().get(pk=report.pk)
        if report.status != ReportStatus.OPEN:
            raise ValidationError("Laporan ini sudah diselesaikan.")
        attempt = CekPahamAttempt.objects.select_for_update().select_related("cekpaham").get(pk=report.attempt_id)
        decided = {"resolved_by": teacher, "resolved_at": now, "response_note": response_note}

        if resolution == "dismissed":
            report.status = ReportStatus.DISMISSED
        else:
            cekpaham = attempt.cekpaham
            if cekpaham.status != RequestStatus.ACTIVE:
                raise ValidationError("Cek Paham ini sudah dibatalkan; coba ulang tidak bisa diberikan.")
            if attempt.status == AttemptStatus.VOIDED:
                raise ValidationError("Coba ulang untuk sesi ini sudah diberikan.")
            earliest_end = now + timedelta(seconds=cekpaham.answer_seconds + WINDOW_MARGIN_SECONDS)
            if extend_window_to is not None and extend_window_to < earliest_end:
                raise ValidationError(
                    {"extend_window_to": "Batas baru terlalu dekat untuk satu sesi lagi."}
                )
            # Mahasiswa baru tahu lewat notifikasi, jadi sisa jendela minimal sehari.
            new_end = extend_window_to or (
                now + RETRY_WINDOW_EXTENSION if cekpaham.window_end < now + RETRY_WINDOW_EXTENSION else None
            )
            if new_end and new_end > cekpaham.window_end:
                cekpaham.window_end = new_end
                cekpaham.save(update_fields=["window_end"])
            attempt.status = AttemptStatus.VOIDED
            attempt.save(update_fields=["status"])
            report.status = ReportStatus.RETRY_GRANTED
            # Laporan lain atas sesi yang sama ikut terjawab oleh keputusan ini.
            attempt.reports.filter(status=ReportStatus.OPEN).exclude(pk=report.pk).update(
                status=ReportStatus.RETRY_GRANTED, **decided
            )
        for field, value in decided.items():
            setattr(report, field, value)
        report.save()
    return report
