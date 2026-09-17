from rest_framework import status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from .authentication import create_access_token
from .serializers import (
    LoginSerializer,
    ProfilePatchSerializer,
    ProfileSerializer,
    RegisterSerializer,
)
from .services import (
    authenticate_credentials,
    get_request_profile,
    register_profile,
)


class HealthView(APIView):
    """Endpoint cek hidup untuk keep-alive HF Spaces."""

    authentication_classes: list = []
    permission_classes = [AllowAny]

    def get(self, request):
        return Response({"status": "ok"})


ROLE_NAME = {"teacher": "dosen", "student": "mahasiswa"}
ROLE_OPTION = {"teacher": "Dosen", "student": "Mahasiswa"}


def role_mismatch_message(account_role: str) -> str:
    return (
        f"Akun ini terdaftar sebagai {ROLE_NAME[account_role]}. "
        f"Pilih peran {ROLE_OPTION[account_role]} untuk masuk."
    )


def _auth_response(profile) -> dict:
    return {
        "token": create_access_token(profile),
        "profile": ProfileSerializer(profile).data,
    }


class RegisterView(APIView):
    """POST daftar akun baru (dosen atau mahasiswa), langsung mengembalikan token."""

    authentication_classes: list = []
    permission_classes = [AllowAny]
    throttle_scope = "auth_register"

    def post(self, request):
        serializer = RegisterSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        profile = register_profile(**serializer.validated_data)
        return Response(_auth_response(profile), status=status.HTTP_201_CREATED)


class LoginView(APIView):
    """POST login email + password, mengembalikan token dan profil."""

    authentication_classes: list = []
    permission_classes = [AllowAny]
    throttle_scope = "auth_login"

    def post(self, request):
        serializer = LoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        profile = authenticate_credentials(data["email"], data["password"])
        if profile is None:
            return Response(
                {"detail": "Email atau kata sandi salah."},
                status=status.HTTP_401_UNAUTHORIZED,
            )
        # Diperiksa SETELAH kata sandi terbukti benar. Kalau urutannya dibalik,
        # siapa pun bisa menebak peran sebuah email tanpa tahu kata sandinya.
        requested_role = data.get("role")
        if requested_role and requested_role != profile.role:
            return Response(
                {"detail": role_mismatch_message(profile.role)},
                status=status.HTTP_403_FORBIDDEN,
            )
        return Response(_auth_response(profile))


class MeView(APIView):
    """GET profil dari token aktif, PATCH update field yang diizinkan."""

    def get(self, request):
        profile = get_request_profile(request)
        return Response(ProfileSerializer(profile).data)

    def patch(self, request):
        profile = get_request_profile(request)
        serializer = ProfilePatchSerializer(profile, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        updated = serializer.save()
        return Response(ProfileSerializer(updated).data, status=status.HTTP_200_OK)
