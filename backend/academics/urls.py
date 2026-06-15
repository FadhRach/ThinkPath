from django.urls import path

from .views import (
    AssignmentListCreateView,
    ClassListCreateView,
    SubmissionDetailView,
    SubmissionListView,
)


urlpatterns = [
    path("classes", ClassListCreateView.as_view()),
    path("classes/<str:class_id>/assignments", AssignmentListCreateView.as_view()),
    path("assignments/<str:assignment_id>/submissions", SubmissionListView.as_view()),
    path("submissions/<str:submission_id>", SubmissionDetailView.as_view()),
]
