"""Endpoint lonceng notifikasi. Berlaku untuk kedua peran."""
from __future__ import annotations

from uuid import UUID

from rest_framework import serializers
from rest_framework.response import Response
from rest_framework.views import APIView

from .events import ensure_deadline_reminders
from .models import Notification
from .services import mark_read, recent_for, safe


class NotificationSerializer(serializers.ModelSerializer):
    read = serializers.SerializerMethodField()

    class Meta:
        model = Notification
        fields = [
            "id",
            "kind",
            "title",
            "body",
            "link",
            "event_at",
            "count",
            "created_at",
            "read",
        ]

    def get_read(self, obj: Notification) -> bool:
        return obj.read_at is not None


class MarkReadSerializer(serializers.Serializer):
    # Tanpa ids berarti tandai semuanya.
    ids = serializers.ListField(
        child=serializers.UUIDField(), required=False, max_length=100
    )


def _recipient(request) -> UUID:
    return UUID(request.user.sub)


class NotificationListView(APIView):
    """GET notifikasi terbaru milik pemanggil beserta jumlah yang belum dibaca."""

    def get(self, request):
        recipient_id = _recipient(request)
        if getattr(request.user, "role", None) == "student":
            safe(lambda: ensure_deadline_reminders(recipient_id))
        items, unread = recent_for(recipient_id)
        return Response(
            {
                "unread_count": unread,
                "items": NotificationSerializer(items, many=True).data,
            }
        )


class NotificationReadView(APIView):
    """POST tandai dibaca: sebagian lewat ids, atau seluruhnya bila ids kosong."""

    def post(self, request):
        serializer = MarkReadSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        recipient_id = _recipient(request)
        mark_read(recipient_id, serializer.validated_data.get("ids"))
        _, unread = recent_for(recipient_id)
        return Response({"unread_count": unread})
