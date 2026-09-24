"""Peristiwa akademik yang layak diketahui seseorang, dan kalimatnya.

Satu fungsi per peristiwa, dipanggil view SETELAH aksi utamanya tersimpan.
Kalimat untuk mahasiswa memakai "kamu" dan untuk dosen memakai "Anda",
mengikuti design system.

Batas yang dijaga: notifikasi ke mahasiswa tidak pernah menyebut skor AI,
indikasi AI, atau alasan sesi diskusi dijadwalkan. Undangan sesi dibingkai
sebagai kesempatan menjelaskan jawaban, sama seperti di layar dosen.
"""
from __future__ import annotations

from datetime import datetime, timedelta
from uuid import UUID

from django.utils import timezone

from academics.models import (
    Assignment,
    Class,
    ClassMembership,
    Material,
    Submission,
    VerbalVerification,
    VerificationStatus,
)
from core.models import Profile

from .models import NotificationKind
from .services import notify, notify_grouped, notify_once

# Pengingat dikirim bila tenggat jatuh dalam rentang ini dan jawaban belum ada.
DEADLINE_REMINDER_WINDOW = timedelta(hours=24)

SESSION_INVITE_BODY = "Dosen ingin mendengar penjelasanmu tentang jawaban ini."


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


def session_changed(
    verification: VerbalVerification | None,
    *,
    submission: Submission,
    previous_status: str | None,
    previous_at: datetime | None,
) -> int:
    """Kabari mahasiswa soal undangan, perubahan jadwal, atau pembatalan sesi.

    verification None berarti sesinya dihapus. Sesi yang selesai tidak
    dikabarkan: kesimpulannya catatan dosen, bukan untuk mahasiswa.
    """
    student = [submission.student_profile_id]
    assignment_title = submission.assignment.title
    was_scheduled = previous_status == VerificationStatus.SCHEDULED

    if verification is None or verification.status == VerificationStatus.CANCELLED:
        if not was_scheduled:
            return 0
        return notify(
            student,
            kind=NotificationKind.SESSION_CANCELLED,
            title="Sesi diskusi jawaban dibatalkan",
            body=assignment_title,
            link="/student/jadwal",
        )

    if verification.status != VerificationStatus.SCHEDULED:
        return 0
    if was_scheduled and previous_at == verification.scheduled_at:
        return 0
    return notify(
        student,
        kind=NotificationKind.SESSION_SCHEDULED,
        title=(
            "Jadwal sesi diskusi jawaban diubah"
            if was_scheduled
            else "Undangan sesi diskusi jawaban"
        ),
        body=f"{assignment_title}. {SESSION_INVITE_BODY}",
        link="/student/jadwal",
        event_at=verification.scheduled_at,
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
    return sent


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
