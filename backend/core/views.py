from rest_framework import status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from .serializers import ProfilePatchSerializer, ProfileSerializer
from .services import get_or_create_profile


class HealthView(APIView):
    """Endpoint cek hidup untuk keep-alive HF Spaces."""

    authentication_classes: list = []
    permission_classes = [AllowAny]

    def get(self, request):
        return Response({"status": "ok"})


class MeView(APIView):
    """GET = upsert profil dari klaim JWT, PATCH = update field yang diizinkan."""

    def get(self, request):
        profile = get_or_create_profile(request.user)
        return Response(ProfileSerializer(profile).data)

    def patch(self, request):
        profile = get_or_create_profile(request.user)
        serializer = ProfilePatchSerializer(profile, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        updated = serializer.save()
        return Response(ProfileSerializer(updated).data, status=status.HTTP_200_OK)
