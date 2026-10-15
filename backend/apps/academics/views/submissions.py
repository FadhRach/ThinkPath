"""Submission: kumpul/revisi (mahasiswa), antrean, detail, nilai, analisis ulang,
dan verifikasi verbal (dosen)."""
from __future__ import annotations

from django.utils import timezone
from rest_framework import status
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.academics.models import (
    Submission,
    SubmissionStatus,
    VerbalVerification,
    VerificationStatus,
)
from apps.academics.selectors import (
    require_member_assignment,
    require_owned_assignment,
    require_owned_submission,
)
from apps.academics.serializers import (
    AnalysisFullSerializer,
    SubmissionCreateSerializer,
    SubmissionDetailSerializer,
    SubmissionGradeSerializer,
    SubmissionListSerializer,
    SubmissionQueueSerializer,
    VerificationQueueSerializer,
    VerificationSerializer,
    VerificationWriteSerializer,
)
from apps.academics.services.submissions import (
    reanalyze,
    reject_if_past_deadline,
    require_student_consent,
    submit_answer,
)
from apps.accounts.permissions import IsStudent, IsTeacher
from apps.accounts.services import get_request_profile
from apps.notifications import events as notify_events
from apps.notifications.services import safe
from common.http import request_user_id

VISIBLE_STATUSES = [SubmissionStatus.SUBMITTED, SubmissionStatus.REVIEWED]


class SubmissionListView(APIView):
    """GET daftar submission satu tugas (dosen). POST kumpul/revisi (mahasiswa)."""

    def get_permissions(self):
        if self.request.method == "POST":
            return [IsStudent()]
        return [IsTeacher()]

    def get(self, request, assignment_id: str):
        assignment = require_owned_assignment(request, assignment_id)
        submissions = (
            Submission.objects.filter(assignment=assignment)
            .select_related("student_profile", "analysis")
            .order_by("-submitted_at")
        )
        return Response(SubmissionListSerializer(submissions, many=True).data)

    def post(self, request, assignment_id: str):
        assignment = require_member_assignment(request, assignment_id)
        reject_if_past_deadline(assignment)
        student = get_request_profile(request)
        allow_external = require_student_consent(
            student.id,
            "Setujui Kebijakan Privasi versi terbaru sebelum mengumpulkan jawaban. "
            "Buka menu Pengaturan atau muat ulang halaman.",
        )
        serializer = SubmissionCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        submission, revised = submit_answer(
            assignment, student, serializer.validated_data, allow_external=allow_external
        )
        safe(lambda: notify_events.submission_received(submission, revised=revised))
        detail = "Revisi jawaban berhasil disimpan." if revised else "Jawaban berhasil dikumpulkan."
        return Response(
            {"id": str(submission.id), "detail": detail}, status=status.HTTP_201_CREATED
        )


class TeacherSubmissionQueueView(APIView):
    """GET pengumpulan lintas kelas milik dosen; filter ?status=all|submitted|reviewed."""

    permission_classes = [IsTeacher]

    def get(self, request):
        selected = request.query_params.get("status", "all")
        if selected not in ["all", *VISIBLE_STATUSES]:
            raise ValidationError({"status": "Status tidak dikenal."})
        rows = Submission.objects.filter(
            assignment__class_ref__owner_id=request_user_id(request),
            status__in=VISIBLE_STATUSES if selected == "all" else [selected],
        )
        rows = rows.select_related(
            "student_profile", "assignment__class_ref", "analysis"
        ).order_by("-submitted_at", "-created_at")
        return Response(SubmissionQueueSerializer(rows, many=True).data)


class SubmissionDetailView(APIView):
    """GET detail submission; PATCH nilai + umpan balik dosen."""

    permission_classes = [IsTeacher]

    def get(self, request, submission_id: str):
        submission = require_owned_submission(request, submission_id)
        return Response(SubmissionDetailSerializer(submission).data)

    def patch(self, request, submission_id: str):
        submission = require_owned_submission(request, submission_id)
        serializer = SubmissionGradeSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        before = (submission.status, submission.grade, submission.teacher_feedback)
        submission.grade = serializer.validated_data["grade"]
        submission.teacher_feedback = serializer.validated_data["teacher_feedback"]
        submission.status = SubmissionStatus.REVIEWED
        submission.save(update_fields=["grade", "teacher_feedback", "status"])
        # Menyimpan ulang nilai yang sama tidak perlu mengabari mahasiswa lagi.
        if before != (submission.status, submission.grade, submission.teacher_feedback):
            safe(lambda: notify_events.submission_graded(submission))
        return Response(SubmissionDetailSerializer(submission).data)


class SubmissionReanalyzeView(APIView):
    """POST analisis ulang satu submission (dosen pemilik)."""

    permission_classes = [IsTeacher]

    def post(self, request, submission_id: str):
        submission = require_owned_submission(request, submission_id)
        result = reanalyze(submission)
        return Response({"analysis": AnalysisFullSerializer(result).data})


class SubmissionVerificationView(APIView):
    """PUT jadwalkan/catat hasil verifikasi verbal; DELETE hapus.

    Satu endpoint untuk jadwal dan hasil karena keduanya menulis baris yang
    sama. Aturan urutannya ada di VerificationWriteSerializer.
    """

    permission_classes = [IsTeacher]

    def put(self, request, submission_id: str):
        submission = require_owned_submission(request, submission_id)
        serializer = VerificationWriteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        previous = getattr(submission, "verification", None)
        previous_status = previous.status if previous else None
        previous_at = previous.scheduled_at if previous else None

        completed = data["status"] == VerificationStatus.COMPLETED
        verification, _ = VerbalVerification.objects.update_or_create(
            submission=submission,
            defaults={
                "status": data["status"],
                "scheduled_at": data.get("scheduled_at"),
                "outcome": data.get("outcome") or "",
                "notes": data.get("notes", ""),
                "completed_at": timezone.now() if completed else None,
            },
        )
        safe(
            lambda: notify_events.session_changed(
                verification,
                submission=submission,
                previous_status=previous_status,
                previous_at=previous_at,
            )
        )
        return Response(VerificationSerializer(verification).data)

    def delete(self, request, submission_id: str):
        submission = require_owned_submission(request, submission_id)
        previous = getattr(submission, "verification", None)
        VerbalVerification.objects.filter(submission=submission).delete()
        if previous is not None:
            safe(
                lambda: notify_events.session_changed(
                    None,
                    submission=submission,
                    previous_status=previous.status,
                    previous_at=previous.scheduled_at,
                )
            )
        return Response(status=status.HTTP_204_NO_CONTENT)


class VerificationQueueView(APIView):
    """GET antrean verifikasi lintas kelas: terjadwal dulu, lalu riwayat."""

    permission_classes = [IsTeacher]

    def get(self, request):
        queue = (
            VerbalVerification.objects.filter(
                submission__assignment__class_ref__owner_id=request_user_id(request)
            )
            .select_related(
                "submission__student_profile",
                "submission__assignment__class_ref",
                "submission__analysis",
            )
            .order_by("status", "scheduled_at")
        )
        return Response(VerificationQueueSerializer(queue, many=True).data)
