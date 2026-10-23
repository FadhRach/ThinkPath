from django.urls import path

from apps.accounts.views import (
    ConsentView,
    ConsentWithdrawView,
    DeletionImpactView,
    LoginView,
    LogoutView,
    MeView,
    PasswordChangeView,
    PasswordResetConfirmView,
    PasswordResetRequestView,
    RegisterView,
    UploadTicketView,
)


urlpatterns = [
    path("auth/register", RegisterView.as_view()),
    path("auth/login", LoginView.as_view()),
    path("auth/logout", LogoutView.as_view()),
    path("auth/upload-ticket", UploadTicketView.as_view()),
    path("auth/password-reset", PasswordResetRequestView.as_view()),
    path("auth/password-reset/confirm", PasswordResetConfirmView.as_view()),
    path("me/password", PasswordChangeView.as_view()),
    path("me/deletion-impact", DeletionImpactView.as_view()),
    path("me", MeView.as_view()),
    path("me/consent", ConsentView.as_view()),
    path("me/consent/withdraw", ConsentWithdrawView.as_view()),
]
