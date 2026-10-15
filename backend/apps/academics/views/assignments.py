"""Tugas: daftar/buat per kelas, daftar lintas kelas, detail/edit (dosen)."""
from __future__ import annotations

from django.db import transaction
from rest_framework import status
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.academics.models import Assignment
from apps.academics.selectors import (
    assignment_annotations,
    assignment_summary,
    require_owned_assignment,
    require_owned_class,
)
from apps.academics.serializers import (
    AssignmentCreateSerializer,
    AssignmentListSerializer,
    TeacherAssignmentRowSerializer,
)
from apps.accounts.permissions import IsTeacher
from apps.notifications import events as notify_events
from apps.notifications.services import safe
from common.http import request_user_id


class AssignmentListCreateView(APIView):
    """GET tugas di satu kelas; POST buat tugas baru (dosen pemilik kelas)."""

    permission_classes = [IsTeacher]

    def get(self, request, class_id: str):
        target_class = require_owned_class(request, class_id)
        assignments = (
            Assignment.objects.filter(class_ref=target_class)
            .select_related("class_ref")
            .annotate(**assignment_annotations())
            .order_by("-created_at")
        )
        return Response(AssignmentListSerializer(assignments, many=True).data)

    def post(self, request, class_id: str):
        target_class = require_owned_class(request, class_id)
        serializer = AssignmentCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        new_assignment = Assignment.objects.create(
            class_ref=target_class, **serializer.validated_data
        )
        safe(lambda: notify_events.assignment_created(new_assignment))
        # Tugas baru pasti belum punya submission; tidak perlu refetch.
        new_assignment.submission_count = 0
        new_assignment.high_band_count = 0
        new_assignment.needs_review_count = 0
        return Response(
            AssignmentListSerializer(new_assignment).data, status=status.HTTP_201_CREATED
        )


class TeacherAssignmentListView(APIView):
    """GET seluruh tugas milik dosen lintas kelas (satu panggilan, bukan per kelas)."""

    permission_classes = [IsTeacher]

    def get(self, request):
        assignments = (
            Assignment.objects.filter(class_ref__owner_id=request_user_id(request))
            .select_related("class_ref")
            .annotate(**assignment_annotations())
            .order_by("-deadline")
        )
        return Response(TeacherAssignmentRowSerializer(assignments, many=True).data)


class AssignmentDetailView(APIView):
    """GET detail tugas; PATCH edit (target Bloom terkunci setelah ada pengumpulan)."""

    permission_classes = [IsTeacher]

    def get(self, request, assignment_id: str):
        item = require_owned_assignment(request, assignment_id)
        return Response(AssignmentListSerializer(assignment_summary(item.id)).data)

    def patch(self, request, assignment_id: str):
        item = require_owned_assignment(request, assignment_id)
        with transaction.atomic():
            item = Assignment.objects.select_for_update().get(pk=item.id)
            serializer = AssignmentCreateSerializer(item, data=request.data, partial=True)
            serializer.is_valid(raise_exception=True)
            target = serializer.validated_data.get(
                "expected_bloom_level", item.expected_bloom_level
            )
            if target != item.expected_bloom_level and item.submissions.exists():
                raise ValidationError(
                    {"expected_bloom_level": "Target Bloom tidak dapat diubah setelah ada pengumpulan."}
                )
            serializer.save()
        return Response(AssignmentListSerializer(assignment_summary(item.id)).data)
