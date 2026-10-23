from apps.academics.views.assignments import (
    AssignmentDetailView,
    AssignmentListCreateView,
    TeacherAssignmentListView,
)
from apps.academics.views.classes import (
    ClassAnnouncementView,
    ClassListCreateView,
    ClassRosterView,
    JoinClassView,
)
from apps.academics.views.documents import (
    DocumentFileView,
    DocumentImportView,
    SubmissionDocumentView,
)
from apps.academics.views.drafts import DraftView
from apps.academics.views.insights import (
    ReportOverviewView,
    StudentCognitiveProfileView,
    StudentOwnProgressView,
    TeacherOverviewView,
)
from apps.academics.views.materials import ClassMaterialListCreateView, MaterialDetailView
from apps.academics.views.student import (
    StudentAssignmentDetailView,
    StudentClassListView,
    StudentMaterialListView,
    StudentScheduleView,
)
from apps.academics.views.submissions import (
    SubmissionDetailView,
    SubmissionListView,
    SubmissionReanalyzeView,
    TeacherSubmissionQueueView,
)

__all__ = [
    "AssignmentDetailView",
    "AssignmentListCreateView",
    "ClassAnnouncementView",
    "ClassListCreateView",
    "ClassMaterialListCreateView",
    "ClassRosterView",
    "DocumentFileView",
    "DraftView",
    "DocumentImportView",
    "JoinClassView",
    "MaterialDetailView",
    "ReportOverviewView",
    "StudentAssignmentDetailView",
    "StudentClassListView",
    "StudentCognitiveProfileView",
    "StudentMaterialListView",
    "StudentOwnProgressView",
    "StudentScheduleView",
    "SubmissionDetailView",
    "SubmissionDocumentView",
    "SubmissionListView",
    "SubmissionReanalyzeView",
    "TeacherAssignmentListView",
    "TeacherOverviewView",
    "TeacherSubmissionQueueView",
]
