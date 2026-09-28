from django.urls import path

from .views import ConsentView, ConsentWithdrawView, LoginView, MeView, RegisterView


urlpatterns = [
    path("auth/register", RegisterView.as_view()),
    path("auth/login", LoginView.as_view()),
    path("me", MeView.as_view()),
    path("me/consent", ConsentView.as_view()),
    path("me/consent/withdraw", ConsentWithdrawView.as_view()),
]
