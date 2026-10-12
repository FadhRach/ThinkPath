"""Kelas: daftar/buat (dosen), gabung (mahasiswa), roster, dan pengumuman."""
from __future__ import annotations

from django.db.models import Count, Q
from rest_framework import status
from rest_framework.exceptions import NotFound, PermissionDenied
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.academics.models import Announcement, Class, ClassMembership, SubmissionStatus
from apps.academics.selectors import require_member_class, require_owned_class
from apps.academics.serializers import (
    AnnouncementSerializer,
    ClassCreateSerializer,
    ClassListSerializer,
    ClassPublicSerializer,
    JoinClassSerializer,
)
from apps.academics.services.join_codes import generate_unique_join_code
from apps.accounts.models import Role
from apps.accounts.permissions import IsStudent, IsTeacher
from apps.accounts.services import get_request_profile
from apps.notifications import events as notify_events
from apps.notifications.services import safe
from common.http import request_user_id


class ClassListCreateView(APIView):
    """GET daftar kelas dosen; POST buat kelas baru."""

    permission_classes = [IsTeacher]

    def get(self, request):
        classes = (
            Class.objects.filter(owner_id=request_user_id(request))
            .annotate(assignment_count=Count("assignments"))
            .order_by("-created_at")
        )
        return Response(ClassListSerializer(classes, many=True).data)

    def post(self, request):
        serializer = ClassCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        new_class = Class.objects.create(
            owner=get_request_profile(request),
            join_code=generate_unique_join_code(),
            **serializer.validated_data,
        )
        # Kelas baru pasti belum punya tugas; tidak perlu query kedua.
        new_class.assignment_count = 0
        return Response(ClassListSerializer(new_class).data, status=status.HTTP_201_CREATED)


class JoinClassView(APIView):
    """POST gabung kelas via join code (mahasiswa). Idempotent."""

    permission_classes = [IsStudent]

    def post(self, request):
        serializer = JoinClassSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        target_class = Class.objects.filter(
            join_code=serializer.validated_data["join_code"]
        ).first()
        if target_class is None:
            raise NotFound("Kode kelas tidak ditemukan.")

        student = get_request_profile(request)
        _, created = ClassMembership.objects.get_or_create(
            class_ref=target_class, student_profile=student
        )
        if created:
            safe(lambda: notify_events.student_joined(target_class, student))
        return Response({"class": ClassPublicSerializer(target_class).data, "created": created})


class ClassRosterView(APIView):
    """GET anggota kelas beserta jumlah pengumpulan dan penilaiannya."""

    permission_classes = [IsTeacher]

    def get(self, request, class_id: str):
        target = require_owned_class(request, class_id)
        in_class = Q(student_profile__submissions__assignment__class_ref=target)
        memberships = (
            target.memberships.select_related("student_profile")
            .annotate(
                submission_count=Count(
                    "student_profile__submissions",
                    filter=in_class
                    & Q(
                        student_profile__submissions__status__in=[
                            SubmissionStatus.SUBMITTED,
                            SubmissionStatus.REVIEWED,
                        ]
                    ),
                    distinct=True,
                ),
                reviewed_count=Count(
                    "student_profile__submissions",
                    filter=in_class
                    & Q(student_profile__submissions__status=SubmissionStatus.REVIEWED),
                    distinct=True,
                ),
            )
            .order_by("student_profile__display_name", "joined_at")
        )
        return Response(
            [
                {
                    "id": str(item.student_profile_id),
                    "display_name": item.student_profile.label,
                    "joined_at": item.joined_at,
                    "submission_count": item.submission_count,
                    "reviewed_count": item.reviewed_count,
                }
                for item in memberships
            ]
        )


class ClassAnnouncementView(APIView):
    """GET pengumuman (dosen pemilik atau anggota); POST terbitkan (dosen pemilik)."""

    def get(self, request, class_id: str):
        if request.user.role == Role.TEACHER:
            target = require_owned_class(request, class_id)
        else:
            target = require_member_class(request, class_id)
        items = (
            Announcement.objects.filter(class_ref=target)
            .select_related("class_ref__owner")
            .order_by("-created_at")
        )
        return Response(AnnouncementSerializer(items, many=True).data)

    def post(self, request, class_id: str):
        if request.user.role != Role.TEACHER:
            raise PermissionDenied()
        target = require_owned_class(request, class_id)
        serializer = AnnouncementSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        item = serializer.save(class_ref=target)
        safe(lambda: notify_events.announcement_created(item))
        return Response(AnnouncementSerializer(item).data, status=status.HTTP_201_CREATED)
