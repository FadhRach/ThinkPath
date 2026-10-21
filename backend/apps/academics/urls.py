from django.urls import path

from apps.academics import views


urlpatterns = [
    path("reports/overview", views.ReportOverviewView.as_view()),
    path("classes", views.ClassListCreateView.as_view()),
    path("classes/<str:class_id>/assignments", views.AssignmentListCreateView.as_view()),
    path("classes/<str:class_id>/materials", views.ClassMaterialListCreateView.as_view()),
    path("classes/<str:class_id>/students", views.ClassRosterView.as_view()),
    path("classes/<str:class_id>/announcements", views.ClassAnnouncementView.as_view()),
    path("materials/<str:material_id>", views.MaterialDetailView.as_view()),
    path("assignments", views.TeacherAssignmentListView.as_view()),
    path("assignments/<str:assignment_id>", views.AssignmentDetailView.as_view()),
    path("submissions", views.TeacherSubmissionQueueView.as_view()),
    path("overview", views.TeacherOverviewView.as_view()),
    path("join", views.JoinClassView.as_view()),
    path("student/classes", views.StudentClassListView.as_view()),
    path("student/progress", views.StudentOwnProgressView.as_view()),
    path("student/materials", views.StudentMaterialListView.as_view()),
    path("student/schedule", views.StudentScheduleView.as_view()),
    path("students/<str:student_id>/profile", views.StudentCognitiveProfileView.as_view()),
    path("student/assignments/<str:assignment_id>", views.StudentAssignmentDetailView.as_view()),
    path("assignments/<str:assignment_id>/submissions", views.SubmissionListView.as_view()),
    path("assignments/<str:assignment_id>/documents", views.DocumentImportView.as_view()),
    path("assignments/<str:assignment_id>/documents/<str:document_id>", views.DocumentFileView.as_view()),
    path("submissions/<str:submission_id>", views.SubmissionDetailView.as_view()),
    path("submissions/<str:submission_id>/document", views.SubmissionDocumentView.as_view()),
    path("submissions/<str:submission_id>/reanalyze", views.SubmissionReanalyzeView.as_view()),
    path("submissions/<str:submission_id>/verification", views.SubmissionVerificationView.as_view()),
    path("verifications", views.VerificationQueueView.as_view()),
]
