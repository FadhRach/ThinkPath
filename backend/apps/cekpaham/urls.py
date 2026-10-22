from django.urls import path

from apps.cekpaham import views

urlpatterns = [
    # dosen
    path("submissions/<str:submission_id>/cekpaham", views.SubmissionCekPahamView.as_view()),
    path("cekpaham", views.CekPahamQueueView.as_view()),
    path("cekpaham/reports/<str:report_id>/resolve", views.CekPahamReportResolveView.as_view()),
    path("cekpaham/<str:cekpaham_id>", views.CekPahamDetailView.as_view()),
    path("cekpaham/<str:cekpaham_id>/cancel", views.CekPahamCancelView.as_view()),
    path("cekpaham/<str:cekpaham_id>/attempts/<int:number>/audio", views.CekPahamAudioView.as_view()),
    path("cekpaham/<str:cekpaham_id>/attempts/<int:number>/reprocess", views.CekPahamReprocessView.as_view()),
    # mahasiswa
    path("student/cekpaham/<str:cekpaham_id>", views.StudentCekPahamDetailView.as_view()),
    path("student/cekpaham/<str:cekpaham_id>/start", views.StudentCekPahamStartView.as_view()),
    path("student/cekpaham/<str:cekpaham_id>/live", views.StudentCekPahamLiveView.as_view()),
    path("student/cekpaham/<str:cekpaham_id>/finalize", views.StudentCekPahamFinalizeView.as_view()),
    path("student/cekpaham/<str:cekpaham_id>/report", views.StudentCekPahamReportView.as_view()),
]
