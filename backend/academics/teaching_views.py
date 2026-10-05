"""Data untuk pengelolaan kelas, tugas, dan antrean penilaian dosen."""
from django.db import transaction
from django.db.models import Count, Q
from rest_framework import serializers, status
from rest_framework.exceptions import NotFound, PermissionDenied, ValidationError
from rest_framework.response import Response
from rest_framework.views import APIView

from core.permissions import IsTeacher
from notifications.models import NotificationKind
from notifications.services import notify, safe

from .models import Announcement, Assignment, Class, Submission, SubmissionStatus
from .serializers import AssignmentCreateSerializer, AssignmentListSerializer, SubmissionListSerializer
from .views import _assignment_annotations, _owner_uuid, _parse_uuid_or_404, _require_owned_assignment, _require_owned_class


class AnnouncementSerializer(serializers.ModelSerializer):
    class_id = serializers.UUIDField(source="class_ref_id", read_only=True)
    author_name = serializers.CharField(source="class_ref.owner.label", read_only=True)
    title = serializers.CharField(max_length=160)
    body = serializers.CharField(max_length=4000)

    class Meta:
        model = Announcement
        fields = ["id", "class_id", "author_name", "title", "body", "created_at"]
        read_only_fields = ["id", "created_at"]


class ClassAnnouncementView(APIView):
    def get(self, request, class_id):
        if request.user.role == "teacher":
            target = _require_owned_class(request, class_id)
        else:
            target = Class.objects.filter(
                pk=_parse_uuid_or_404(class_id),
                memberships__student_profile_id=_owner_uuid(request),
            ).first()
            if target is None:
                raise NotFound()
        items = Announcement.objects.filter(class_ref=target).select_related("class_ref__owner").order_by("-created_at")
        return Response(AnnouncementSerializer(items, many=True).data)

    def post(self, request, class_id):
        if request.user.role != "teacher":
            raise PermissionDenied()
        target = _require_owned_class(request, class_id)
        serializer = AnnouncementSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        item = serializer.save(class_ref=target)
        safe(lambda: notify(
            list(target.memberships.values_list("student_profile_id", flat=True)),
            kind=NotificationKind.ANNOUNCEMENT_NEW,
            title=f"Pengumuman: {item.title}",
            body=target.name,
            link=f"/student/kelas/{target.id}?tab=pengumuman#pengumuman-{item.id}",
        ))
        return Response(AnnouncementSerializer(item).data, status=status.HTTP_201_CREATED)


class ClassRosterView(APIView):
    permission_classes = [IsTeacher]

    def get(self, request, class_id):
        target = _require_owned_class(request, class_id)
        memberships = target.memberships.select_related("student_profile").annotate(
            submission_count=Count("student_profile__submissions", filter=Q(
                student_profile__submissions__assignment__class_ref=target,
                student_profile__submissions__status__in=[SubmissionStatus.SUBMITTED, SubmissionStatus.REVIEWED],
            ), distinct=True),
            reviewed_count=Count("student_profile__submissions", filter=Q(
                student_profile__submissions__assignment__class_ref=target,
                student_profile__submissions__status=SubmissionStatus.REVIEWED,
            ), distinct=True),
        ).order_by("student_profile__display_name", "joined_at")
        return Response([
            {"id": str(item.student_profile_id), "display_name": item.student_profile.label,
             "joined_at": item.joined_at, "submission_count": item.submission_count,
             "reviewed_count": item.reviewed_count}
            for item in memberships
        ])


class AssignmentDetailView(APIView):
    permission_classes = [IsTeacher]

    @staticmethod
    def _summary(assignment):
        return Assignment.objects.filter(pk=assignment.id).select_related("class_ref").annotate(**_assignment_annotations()).get()

    def get(self, request, assignment_id):
        item = _require_owned_assignment(request, assignment_id)
        return Response(AssignmentListSerializer(self._summary(item)).data)

    def patch(self, request, assignment_id):
        item = _require_owned_assignment(request, assignment_id)
        with transaction.atomic():
            item = Assignment.objects.select_for_update().get(pk=item.id)
            serializer = AssignmentCreateSerializer(item, data=request.data, partial=True)
            serializer.is_valid(raise_exception=True)
            target = serializer.validated_data.get("expected_bloom_level", item.expected_bloom_level)
            if target != item.expected_bloom_level and item.submissions.exists():
                raise ValidationError({"expected_bloom_level": "Target Bloom tidak dapat diubah setelah ada pengumpulan."})
            serializer.save()
        return Response(AssignmentListSerializer(self._summary(item)).data)


class SubmissionQueueSerializer(SubmissionListSerializer):
    assignment_title = serializers.CharField(source="assignment.title", read_only=True)
    class_id = serializers.UUIDField(source="assignment.class_ref_id", read_only=True)
    class_name = serializers.CharField(source="assignment.class_ref.name", read_only=True)

    class Meta(SubmissionListSerializer.Meta):
        fields = SubmissionListSerializer.Meta.fields + ["assignment_title", "class_id", "class_name"]


class TeacherSubmissionQueueView(APIView):
    permission_classes = [IsTeacher]

    def get(self, request):
        selected = request.query_params.get("status", "all")
        if selected not in ["all", SubmissionStatus.SUBMITTED, SubmissionStatus.REVIEWED]:
            raise ValidationError({"status": "Status tidak dikenal."})
        rows = Submission.objects.filter(
            assignment__class_ref__owner_id=_owner_uuid(request),
            status__in=[SubmissionStatus.SUBMITTED, SubmissionStatus.REVIEWED],
        )
        if selected != "all":
            rows = rows.filter(status=selected)
        rows = rows.select_related("student_profile", "assignment__class_ref", "analysis").order_by("-submitted_at", "-created_at")
        return Response(SubmissionQueueSerializer(rows, many=True).data)
