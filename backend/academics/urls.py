from django.urls import path

from .views import (
    AssignmentListCreateView,
    ClassListCreateView,
    JoinClassView,
    ReportOverviewView,
    StudentAssignmentDetailView,
    StudentClassListView,
    StudentCognitiveProfileView,
    StudentOwnProgressView,
    SubmissionDetailView,
    SubmissionListView,
    SubmissionReanalyzeView,
    TeacherAssignmentListView,
    TeacherOverviewView,
    SubmissionVerificationView,
    VerificationQueueView,
)


urlpatterns = [
    path("reports/overview", ReportOverviewView.as_view()),
    path("classes", ClassListCreateView.as_view()),
    path("classes/<str:class_id>/assignments", AssignmentListCreateView.as_view()),
    path("assignments", TeacherAssignmentListView.as_view()),
    path("overview", TeacherOverviewView.as_view()),
    path("join", JoinClassView.as_view()),
    path("student/classes", StudentClassListView.as_view()),
    path("student/progress", StudentOwnProgressView.as_view()),
    path("students/<str:student_id>/profile", StudentCognitiveProfileView.as_view()),
    path("student/assignments/<str:assignment_id>", StudentAssignmentDetailView.as_view()),
    path("assignments/<str:assignment_id>/submissions", SubmissionListView.as_view()),
    path("submissions/<str:submission_id>", SubmissionDetailView.as_view()),
    path("submissions/<str:submission_id>/reanalyze", SubmissionReanalyzeView.as_view()),
    path("submissions/<str:submission_id>/verification", SubmissionVerificationView.as_view()),
    path("verifications", VerificationQueueView.as_view()),
]
