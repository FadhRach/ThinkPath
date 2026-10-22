from django.urls import include, path

from common.views import HealthView


urlpatterns = [
    path("health", HealthView.as_view()),
    path("api/", include("apps.accounts.urls")),
    path("api/", include("apps.academics.urls")),
    path("api/", include("apps.notifications.urls")),
    path("api/", include("apps.cekpaham.urls")),
]
