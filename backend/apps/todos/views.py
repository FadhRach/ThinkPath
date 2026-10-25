"""To-do pribadi mahasiswa. Setiap query disaring ke pemanggil; milik orang lain 404."""
from __future__ import annotations

from django.utils import timezone
from rest_framework import status
from rest_framework.exceptions import NotFound, ValidationError
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.permissions import IsStudent
from apps.todos.models import StudentTodo
from apps.todos.serializers import TodoSerializer
from common.http import parse_uuid_or_404, request_user_id
from common.throttling import PerUserScopedThrottle

# Cukup untuk daftar kerja nyata; mencegah satu akun menimbun baris.
MAX_OPEN_TODOS = 100
LIST_LIMIT = 200


class TodoListCreateView(APIView):
    permission_classes = [IsStudent]
    throttle_classes = [PerUserScopedThrottle]
    throttle_scope = "todo_write"

    def get_throttles(self):
        return super().get_throttles() if self.request.method == "POST" else []

    def get(self, request):
        items = StudentTodo.objects.filter(owner_id=request_user_id(request)).order_by(
            "done", "due_on", "-created_at"
        )[:LIST_LIMIT]
        return Response(TodoSerializer(items, many=True).data)

    def post(self, request):
        owner_id = request_user_id(request)
        if StudentTodo.objects.filter(owner_id=owner_id, done=False).count() >= MAX_OPEN_TODOS:
            raise ValidationError(f"Maksimal {MAX_OPEN_TODOS} butir yang belum selesai. Selesaikan atau hapus dulu.")
        serializer = TodoSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        item = serializer.save(owner_id=owner_id)
        return Response(TodoSerializer(item).data, status=status.HTTP_201_CREATED)


class TodoDetailView(APIView):
    permission_classes = [IsStudent]

    def _item(self, request, todo_id: str) -> StudentTodo:
        item = StudentTodo.objects.filter(
            pk=parse_uuid_or_404(todo_id), owner_id=request_user_id(request)
        ).first()
        if item is None:
            raise NotFound()
        return item

    def patch(self, request, todo_id: str):
        item = self._item(request, todo_id)
        serializer = TodoSerializer(item, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        was_done = item.done
        item = serializer.save()
        if item.done != was_done:
            item.done_at = timezone.now() if item.done else None
            item.save(update_fields=["done_at"])
        return Response(TodoSerializer(item).data)

    def delete(self, request, todo_id: str):
        self._item(request, todo_id).delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
