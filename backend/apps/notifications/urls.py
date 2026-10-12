from django.urls import path

from apps.notifications.views import NotificationListView, NotificationReadView


urlpatterns = [
    path("notifications", NotificationListView.as_view()),
    path("notifications/read", NotificationReadView.as_view()),
]
