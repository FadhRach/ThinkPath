"""View lintas app."""
from __future__ import annotations

from django.db import DatabaseError, connection
from rest_framework import status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView


class HealthView(APIView):
    """Cek hidup untuk healthcheck Docker dan monitor uptime.

    Ikut memeriksa basis data: API yang hidup tanpa DB tetap tidak berguna,
    dan Docker perlu tahu supaya status container-nya `unhealthy`.
    """

    authentication_classes: list = []
    permission_classes = [AllowAny]
    throttle_classes: list = []

    def get(self, request):
        try:
            with connection.cursor() as cursor:
                cursor.execute("SELECT 1")
        except DatabaseError:
            return Response(
                {"status": "error", "database": "unreachable"},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )
        return Response({"status": "ok"})
