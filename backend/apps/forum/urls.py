from django.urls import path

from apps.forum import views

urlpatterns = [
    path("classes/<str:class_id>/forum", views.ClassForumView.as_view()),
    path("student/forum/recent", views.StudentForumFeedView.as_view()),
    path("forum/posts/<str:post_id>", views.ForumPostView.as_view()),
    path("forum/posts/<str:post_id>/replies", views.ForumReplyCreateView.as_view()),
    path("forum/replies/<str:reply_id>", views.ForumReplyView.as_view()),
]
