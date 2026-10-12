"""Materi kelas: daftar/bagikan, ubah, hapus (dosen pemilik)."""
from __future__ import annotations

from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.academics.models import Material
from apps.academics.selectors import require_owned_class, require_owned_material
from apps.academics.serializers import MaterialSerializer, MaterialWriteSerializer
from apps.accounts.permissions import IsTeacher
from apps.notifications import events as notify_events
from apps.notifications.services import safe


class ClassMaterialListCreateView(APIView):
    """GET materi satu kelas; POST bagikan materi baru."""

    permission_classes = [IsTeacher]

    def get(self, request, class_id: str):
        target_class = require_owned_class(request, class_id)
        materials = (
            Material.objects.filter(class_ref=target_class)
            .select_related("class_ref")
            .order_by("-created_at")
        )
        return Response(MaterialSerializer(materials, many=True).data)

    def post(self, request, class_id: str):
        target_class = require_owned_class(request, class_id)
        serializer = MaterialWriteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        material = Material.objects.create(class_ref=target_class, **serializer.validated_data)
        safe(lambda: notify_events.material_created(material))
        return Response(MaterialSerializer(material).data, status=status.HTTP_201_CREATED)


class MaterialDetailView(APIView):
    """PATCH ubah materi; DELETE hapus materi."""

    permission_classes = [IsTeacher]

    def patch(self, request, material_id: str):
        material = require_owned_material(request, material_id)
        serializer = MaterialWriteSerializer(material, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        # Tanpa notifikasi ulang: yang diubah biasanya topik atau salah ketik.
        return Response(MaterialSerializer(material).data)

    def delete(self, request, material_id: str):
        require_owned_material(request, material_id).delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
