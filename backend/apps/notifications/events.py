"""Peristiwa akademik yang layak diketahui seseorang, dan kalimatnya.

Satu fungsi per peristiwa, dipanggil view SETELAH aksi utamanya tersimpan.
Kalimat untuk mahasiswa memakai "kamu" dan untuk dosen memakai "Anda",
mengikuti design system.

Batas yang dijaga: notifikasi ke mahasiswa tidak pernah menyebut skor AI,
indikasi AI, atau alasan Cek Paham diminta.
"""
from __future__ import annotations

from datetime import datetime, timedelta
from uuid import UUID

from django.utils import timezone

from apps.academics.models import (
    Announcement,
    Assignment,
    Class,
    ClassMembership,
    Material,
    Submission,
)
from apps.accounts.models import Profile
from apps.cekpaham.models import (
    AttemptStatus,
    CekPaham,
    CekPahamAttempt,
    CekPahamReport,
    ReportReason,
    ReportStatus,
    RequestStatus,
)
from apps.notifications.models import NotificationKind
from apps.notifications.services import notify, notify_grouped, notify_once

# Pengingat dikirim bila tenggat jatuh dalam rentang ini dan jawaban belum ada.
DEADLINE_REMINDER_WINDOW = timedelta(hours=24)


def _member_ids(class_id: UUID) -> list[UUID]:
    return list(
        ClassMembership.objects.filter(class_ref_id=class_id).values_list(
            "student_profile_id", flat=True
        )
    )


# --- Untuk mahasiswa --------------------------------------------------------


def assignment_created(assignment: Assignment) -> int:
    return notify(
        _member_ids(assignment.class_ref_id),
        kind=NotificationKind.ASSIGNMENT_NEW,
        title=f"Tugas baru: {assignment.title}",
        body=assignment.class_ref.name,
        link=f"/student/submit/{assignment.id}",
        event_at=assignment.deadline,
    )


def material_created(material: Material) -> int:
    return notify(
        _member_ids(material.class_ref_id),
        kind=NotificationKind.MATERIAL_NEW,
        title=f"Materi baru: {material.title}",
        body=" · ".join(part for part in (material.class_ref.name, material.topic) if part),
        # Langsung ke materinya di halaman kelas, bukan ke daftar semua kelas.
        link=f"/student/materi/{material.class_ref_id}#materi-{material.id}",
    )


def announcement_created(announcement: Announcement) -> int:
    target = announcement.class_ref
    return notify(
        _member_ids(target.id),
        kind=NotificationKind.ANNOUNCEMENT_NEW,
        title=f"Pengumuman: {announcement.title}",
        body=target.name,
        link=f"/student/kelas/{target.id}?tab=pengumuman#pengumuman-{announcement.id}",
    )


def submission_graded(submission: Submission) -> int:
    assignment = submission.assignment
    body = f"Nilai {submission.grade}"
    if submission.teacher_feedback.strip():
        body += ", beserta umpan balik dari dosen"
    return notify(
        [submission.student_profile_id],
        kind=NotificationKind.SUBMISSION_GRADED,
        title=f"Jawabanmu sudah dinilai: {assignment.title}",
        body=body,
        link=f"/student/submit/{assignment.id}",
    )


def cekpaham_created(cekpaham: CekPaham) -> int:
    """Kabar netral: tidak menyebut alasan, skor, atau dugaan apa pun."""
    submission = cekpaham.submission
    return notify(
        [submission.student_profile_id],
        kind=NotificationKind.CEKPAHAM_NEW,
        title=f"Cek Paham untuk tugas: {submission.assignment.title}",
        body=f"{submission.assignment.class_ref.name}. Dijawab dengan suara, {cekpaham.answer_seconds} detik.",
        link=f"/student/cekpaham/{cekpaham.id}",
        event_at=cekpaham.window_end,
    )


def cekpaham_report_resolved(report: CekPahamReport) -> int:
    cekpaham = report.attempt.cekpaham
    retry = report.status == ReportStatus.RETRY_GRANTED
    return notify(
        [cekpaham.submission.student_profile_id],
        kind=NotificationKind.CEKPAHAM_RESOLVED,
        title="Laporan Cek Paham-mu sudah ditanggapi",
        body=(
            "Dosen mengizinkanmu mengulang. Buka Cek Paham untuk memulai lagi."
            if retry
            else "Dosen sudah menanggapi laporanmu."
        ),
        link=f"/student/cekpaham/{cekpaham.id}",
    )


def _cekpaham_reminders(student_id: UUID, now: datetime) -> int:
    """Cek Paham yang jendelanya tutup dalam 24 jam dan belum dikerjakan."""
    due = (
        CekPaham.objects.filter(
            submission__student_profile_id=student_id,
            status=RequestStatus.ACTIVE,
            window_start__lte=now,
            window_end__gt=now,
            window_end__lte=now + DEADLINE_REMINDER_WINDOW,
        )
        .exclude(attempts__status__in=[s for s in AttemptStatus.values if s != AttemptStatus.VOIDED])
        .select_related("submission__assignment")
    )
    return sum(
        notify_once(
            student_id,
            kind=NotificationKind.CEKPAHAM_NEW,
            group_key=f"cekpaham:{cekpaham.id}",
            title=f"Cek Paham segera ditutup: {cekpaham.submission.assignment.title}",
            body="Waktu pengerjaannya kurang dari 24 jam lagi.",
            link=f"/student/cekpaham/{cekpaham.id}",
            event_at=cekpaham.window_end,
        )
        for cekpaham in due
    )


def ensure_deadline_reminders(student_id: UUID, now: datetime | None = None) -> int:
    """Buat pengingat untuk tenggat dalam 24 jam yang jawabannya belum ada.

    Dipanggil saat mahasiswa membuka lonceng, bukan oleh penjadwal. Backend
    tidak punya cron, dan pengingat baru berguna ketika mahasiswa memang
    sedang membuka aplikasi. Setiap tugas hanya diingatkan sekali.
    """
    now = now or timezone.now()
    due = (
        Assignment.objects.filter(
            class_ref__memberships__student_profile_id=student_id,
            deadline__gt=now,
            deadline__lte=now + DEADLINE_REMINDER_WINDOW,
        )
        .exclude(submissions__student_profile_id=student_id)
        .select_related("class_ref")
        .distinct()
    )
    sent = 0
    for assignment in due:
        sent += notify_once(
            student_id,
            kind=NotificationKind.DEADLINE_SOON,
            group_key=f"deadline:{assignment.id}",
            title=f"Tenggat kurang dari 24 jam: {assignment.title}",
            body=f"{assignment.class_ref.name}. Jawabanmu belum dikumpulkan.",
            link=f"/student/submit/{assignment.id}",
            event_at=assignment.deadline,
        )
    return sent + _cekpaham_reminders(student_id, now)


# --- Untuk dosen ------------------------------------------------------------


def submission_received(submission: Submission, *, revised: bool) -> None:
    assignment = submission.assignment
    klass = assignment.class_ref
    student = submission.student_profile.label
    action = "merevisi jawaban" if revised else "mengumpulkan jawaban"

    def build(count: int) -> tuple[str, str]:
        title = (
            f"{count} pengumpulan baru: {assignment.title}"
            if count > 1
            else f"Pengumpulan baru: {assignment.title}"
        )
        return title, f"{klass.name}. Terakhir, {student} {action}."

    notify_grouped(
        klass.owner_id,
        kind=NotificationKind.SUBMISSIONS_NEW,
        group_key=f"submissions:{assignment.id}",
        build=build,
        link=f"/dashboard/classes/{klass.id}?assignment={assignment.id}",
    )


def student_joined(klass: Class, student: Profile) -> None:
    def build(count: int) -> tuple[str, str]:
        title = (
            f"{count} mahasiswa bergabung ke {klass.name}"
            if count > 1
            else f"Mahasiswa baru di {klass.name}"
        )
        return title, f"Terakhir, {student.label} bergabung lewat kode kelas."

    notify_grouped(
        klass.owner_id,
        kind=NotificationKind.STUDENTS_JOINED,
        group_key=f"joined:{klass.id}",
        build=build,
        link=f"/dashboard/classes/{klass.id}",
    )


def cekpaham_finished(attempt: CekPahamAttempt) -> None:
    """Dosen diberi tahu sesi selesai, gagal diproses, atau terputus."""
    cekpaham = attempt.cekpaham
    submission = cekpaham.submission
    student = submission.student_profile.label
    titles = {
        AttemptStatus.SCORED: f"Hasil Cek Paham siap: {student}",
        AttemptStatus.PROCESSING_FAILED: f"Cek Paham {student} perlu diproses ulang",
        AttemptStatus.INTERRUPTED: f"Sesi Cek Paham {student} terputus",
    }
    title = titles.get(attempt.status)
    if title:
        notify(
            [submission.assignment.class_ref.owner_id],
            kind=NotificationKind.CEKPAHAM_RESULT,
            title=title,
            body=submission.assignment.title,
            link=f"/dashboard/cekpaham/{cekpaham.id}",
        )


def cekpaham_reported(report: CekPahamReport) -> None:
    cekpaham = report.attempt.cekpaham
    submission = cekpaham.submission
    notify(
        [submission.assignment.class_ref.owner_id],
        kind=NotificationKind.CEKPAHAM_RESULT,
        title=f"Laporan Cek Paham dari {submission.student_profile.label}",
        body=ReportReason(report.reason).label,
        link=f"/dashboard/cekpaham/{cekpaham.id}",
    )
