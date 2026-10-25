"""Serializer app academics, dipecah per domain; impor dari sini cukup: `from apps.academics.serializers import X`."""

from apps.academics.serializers.assignments import (
    AssignmentListSerializer,
    TeacherAssignmentRowSerializer,
    AssignmentDetailSerializer,
    AssignmentCreateSerializer,
    StudentAssignmentSerializer,
    StudentAssignmentDetailSerializer,
)
from apps.academics.serializers.classes import (
    ClassListSerializer,
    ClassCreateSerializer,
    JoinClassSerializer,
    ClassPublicSerializer,
)
from apps.academics.serializers.materials import (
    MaterialSerializer,
    MaterialWriteSerializer,
)
from apps.academics.serializers.submissions import (
    StudentSubmissionStatusSerializer,
    StudentSubmissionStatusListSerializer,
    SubmissionGradeSerializer,
    SubmissionListSerializer,
    SubmissionQueueSerializer,
    ProgressSampleSerializer,
    DraftSaveSerializer,
    SubmissionCreateSerializer,
    ReasoningEventSerializer,
    AnalysisFullSerializer,
    AssignmentMiniSerializer,
    AnalysisRunSerializer,
    SubmissionDetailSerializer,
)

__all__ = [
    "AnalysisFullSerializer",
    "AnalysisRunSerializer",
    "AssignmentCreateSerializer",
    "AssignmentDetailSerializer",
    "AssignmentListSerializer",
    "AssignmentMiniSerializer",
    "ClassCreateSerializer",
    "ClassListSerializer",
    "ClassPublicSerializer",
    "DraftSaveSerializer",
    "JoinClassSerializer",
    "MaterialSerializer",
    "MaterialWriteSerializer",
    "ProgressSampleSerializer",
    "ReasoningEventSerializer",
    "StudentAssignmentDetailSerializer",
    "StudentAssignmentSerializer",
    "StudentSubmissionStatusListSerializer",
    "StudentSubmissionStatusSerializer",
    "SubmissionCreateSerializer",
    "SubmissionDetailSerializer",
    "SubmissionGradeSerializer",
    "SubmissionListSerializer",
    "SubmissionQueueSerializer",
    "TeacherAssignmentRowSerializer",
]
