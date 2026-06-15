"""Endpoint CRUD untuk kelas, tugas, dan submission.

Permission ditegakkan via helpers di core.permissions agar logika kepemilikan
tidak terduplikasi. List endpoints difilter ke pemilik (`user.sub`).
"""
from __future__ import annotations

from uuid import UUID

from django.db.models import Count, Q
from rest_framework import status
from rest_framework.exceptions import NotFound
from rest_framework.response import Response
from rest_framework.views import APIView

from core.permissions import IsAssignmentOwner, IsClassOwner, IsSubmissionOwner
from core.services import get_or_create_profile

from .join_codes import generate_unique_join_code
from .models import AiBand, Assignment, Class, Submission, SubmissionStatus
from .serializers import (
    AssignmentCreateSerializer,
    AssignmentListSerializer,
    ClassCreateSerializer,
    ClassListSerializer,
    SubmissionDetailSerializer,
    SubmissionListSerializer,
)


def _owner_uuid(request) -> UUID:
    return UUID(request.user.sub)


class ClassListCreateView(APIView):
    """GET daftar kelas user; POST buat kelas baru."""

    def get(self, request):
        classes = (
            Class.objects.filter(owner_id=_owner_uuid(request))
            .annotate(assignment_count=Count("assignments"))
            .order_by("-created_at")
        )
        return Response(ClassListSerializer(classes, many=True).data)

    def post(self, request):
        # Pastikan profil pemilik ada di tabel kita (sinkronisasi ringan).
        owner_profile = get_or_create_profile(request.user)
        serializer = ClassCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        new_class = Class.objects.create(
            owner=owner_profile,
            join_code=generate_unique_join_code(),
            **serializer.validated_data,
        )
        annotated = (
            Class.objects.filter(pk=new_class.pk)
            .annotate(assignment_count=Count("assignments"))
            .first()
        )
        return Response(
            ClassListSerializer(annotated).data,
            status=status.HTTP_201_CREATED,
        )


class AssignmentListCreateView(APIView):
    """GET assignment di kelas; POST buat assignment baru.

    Permission `IsClassOwner` memastikan request.user pemilik kelas.
    """

    permission_classes = [IsClassOwner]

    def _get_class_or_404(self, class_id: str) -> Class:
        try:
            class_uuid = UUID(class_id)
        except (ValueError, TypeError) as exc:
            raise NotFound() from exc
        try:
            return Class.objects.get(pk=class_uuid)
        except Class.DoesNotExist as exc:
            raise NotFound() from exc

    def get(self, request, class_id: str):
        target_class = self._get_class_or_404(class_id)
        assignments = (
            Assignment.objects.filter(class_ref=target_class)
            .annotate(
                submission_count=Count("submissions", distinct=True),
                high_band_count=Count(
                    "submissions",
                    filter=Q(submissions__analysis__ai_band=AiBand.HIGH),
                    distinct=True,
                ),
                needs_review_count=Count(
                    "submissions",
                    filter=Q(submissions__status=SubmissionStatus.SUBMITTED),
                    distinct=True,
                ),
            )
            .order_by("-created_at")
        )
        return Response(AssignmentListSerializer(assignments, many=True).data)

    def post(self, request, class_id: str):
        target_class = self._get_class_or_404(class_id)
        serializer = AssignmentCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        new_assignment = Assignment.objects.create(
            class_ref=target_class,
            **serializer.validated_data,
        )
        annotated = (
            Assignment.objects.filter(pk=new_assignment.pk)
            .annotate(
                submission_count=Count("submissions", distinct=True),
                high_band_count=Count(
                    "submissions",
                    filter=Q(submissions__analysis__ai_band=AiBand.HIGH),
                    distinct=True,
                ),
                needs_review_count=Count(
                    "submissions",
                    filter=Q(submissions__status=SubmissionStatus.SUBMITTED),
                    distinct=True,
                ),
            )
            .first()
        )
        return Response(
            AssignmentListSerializer(annotated).data,
            status=status.HTTP_201_CREATED,
        )


class SubmissionListView(APIView):
    """GET daftar submission untuk assignment.

    POST disediakan sebagai stub forward-compat. Tahap 1 hanya seed yang menulis.
    """

    permission_classes = [IsAssignmentOwner]

    def get(self, request, assignment_id: str):
        try:
            assignment_uuid = UUID(assignment_id)
        except (ValueError, TypeError) as exc:
            raise NotFound() from exc
        submissions = (
            Submission.objects.filter(assignment_id=assignment_uuid)
            .select_related("student_profile", "analysis")
            .order_by("-submitted_at")
        )
        return Response(SubmissionListSerializer(submissions, many=True).data)

    def post(self, request, assignment_id: str):
        # Tahap 1: belum ada UI siswa. Endpoint sengaja dilarang untuk teacher.
        return Response(
            {"detail": "Endpoint submit belum tersedia untuk peran ini di tahap 1."},
            status=status.HTTP_403_FORBIDDEN,
        )


class SubmissionDetailView(APIView):
    """GET detail submission lengkap (untuk halaman laporan integritas)."""

    permission_classes = [IsSubmissionOwner]

    def get(self, request, submission_id: str):
        try:
            submission_uuid = UUID(submission_id)
        except (ValueError, TypeError) as exc:
            raise NotFound() from exc
        submission = (
            Submission.objects.select_related(
                "assignment", "student_profile", "analysis"
            )
            .prefetch_related("reasoning_events")
            .filter(pk=submission_uuid)
            .first()
        )
        if submission is None:
            raise NotFound()
        return Response(SubmissionDetailSerializer(submission).data)
