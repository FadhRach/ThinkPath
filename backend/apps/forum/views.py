"""Forum kelas: daftar/terbitkan topik, baca satu topik, balas, dan hapus."""
from __future__ import annotations

from django.db import transaction
from django.db.models import Count
from django.utils import timezone
from rest_framework import status
from rest_framework.exceptions import NotFound, PermissionDenied
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.academics.models import Class
from apps.academics.selectors import require_member_class, require_owned_class
from apps.academics.services.submissions import reject_if_archived
from apps.accounts.models import Role
from apps.accounts.permissions import IsStudent
from apps.forum import notifications as forum_events
from apps.forum.models import ForumPost, ForumReply, PostKind
from apps.forum.serializers import (
    PostCreateSerializer,
    PostDetailSerializer,
    PostSerializer,
    ReplyCreateSerializer,
    ReplySerializer,
)
from apps.notifications.services import safe
from common.http import parse_uuid_or_404, request_user_id
from common.throttling import PerUserScopedThrottle

# Daftar topik per kelas dibatasi; yang lebih lama tetap tersimpan.
LIST_LIMIT = 100


def _forum_class(request, class_id: str) -> Class:
    """Kelas forum: dosen pemilik atau mahasiswa anggota. Selain itu 404."""
    if request.user.role == Role.TEACHER:
        return require_owned_class(request, class_id)
    return require_member_class(request, class_id)


def _post_for(request, post_id: str) -> ForumPost:
    post = (
        ForumPost.objects.select_related("class_ref", "author")
        .filter(pk=parse_uuid_or_404(post_id))
        .first()
    )
    if post is None:
        raise NotFound()
    _forum_class(request, str(post.class_ref_id))  # 404 bila bukan anggota/pemilik
    return post


def _context(request) -> dict:
    return {"viewer_id": request_user_id(request)}


class ClassForumView(APIView):
    """GET topik kelas (pengumuman di atas); POST buka topik baru."""

    throttle_classes = [PerUserScopedThrottle]
    throttle_scope = "forum_write"

    def get_throttles(self):
        # Hanya penulisan yang dibatasi; membaca daftar tetap leluasa.
        return super().get_throttles() if self.request.method == "POST" else []

    def get(self, request, class_id: str):
        target = _forum_class(request, class_id)
        posts = list(
            ForumPost.objects.filter(class_ref=target)
            .select_related("author", "class_ref")
            .annotate(reply_count=Count("replies"))
            .order_by("-last_activity_at")[:LIST_LIMIT]
        )
        # Pengumuman disematkan di atas; di dalam kelompoknya urutan aktivitas terbaru dipertahankan.
        posts.sort(key=lambda post: post.kind != PostKind.ANNOUNCEMENT)
        return Response(PostSerializer(posts, many=True, context=_context(request)).data)

    def post(self, request, class_id: str):
        target = _forum_class(request, class_id)
        reject_if_archived(target)
        serializer = PostCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        is_teacher = request.user.role == Role.TEACHER
        if data["kind"] == PostKind.ANNOUNCEMENT and not is_teacher:
            raise PermissionDenied("Hanya dosen yang bisa menerbitkan pengumuman.")
        post = ForumPost.objects.create(
            class_ref=target,
            author_id=request_user_id(request),
            kind=data["kind"],
            title=data["title"],
            body=data["body"],
        )
        post.reply_count = 0
        safe(lambda: forum_events.post_created(post))
        return Response(
            PostSerializer(post, context=_context(request)).data, status=status.HTTP_201_CREATED
        )


class StudentForumFeedView(APIView):
    """Aktivitas forum terbaru di semua kelas yang diikuti mahasiswa (untuk beranda)."""

    permission_classes = [IsStudent]
    FEED_LIMIT = 20

    def get(self, request):
        try:
            limit = max(1, min(int(request.query_params.get("limit", 6)), self.FEED_LIMIT))
        except ValueError:
            limit = 6
        posts = (
            ForumPost.objects.filter(class_ref__memberships__student_profile_id=request_user_id(request))
            .select_related("author", "class_ref")
            .annotate(reply_count=Count("replies"))
            .order_by("-last_activity_at")[:limit]
        )
        return Response(PostSerializer(posts, many=True, context=_context(request)).data)


class ForumPostView(APIView):
    """GET satu topik beserta balasannya; DELETE (penulis atau dosen pemilik kelas)."""

    def get(self, request, post_id: str):
        post = _post_for(request, post_id)
        post.reply_count = post.replies.count()
        return Response(PostDetailSerializer(post, context=_context(request)).data)

    def delete(self, request, post_id: str):
        post = _post_for(request, post_id)
        _require_may_delete(request, post.author_id, post.class_ref)
        post.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class ForumReplyCreateView(APIView):
    throttle_classes = [PerUserScopedThrottle]
    throttle_scope = "forum_write"

    def post(self, request, post_id: str):
        post = _post_for(request, post_id)
        reject_if_archived(post.class_ref)
        serializer = ReplyCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        with transaction.atomic():
            reply = ForumReply.objects.create(
                post=post,
                author_id=request_user_id(request),
                body=serializer.validated_data["body"],
            )
            ForumPost.objects.filter(pk=post.pk).update(last_activity_at=timezone.now())
        safe(lambda: forum_events.reply_created(reply))
        return Response(
            ReplySerializer(reply, context=_context(request)).data, status=status.HTTP_201_CREATED
        )


class ForumReplyView(APIView):
    """DELETE balasan (penulis atau dosen pemilik kelas)."""

    def delete(self, request, reply_id: str):
        reply = (
            ForumReply.objects.select_related("post__class_ref")
            .filter(pk=parse_uuid_or_404(reply_id))
            .first()
        )
        if reply is None:
            raise NotFound()
        _forum_class(request, str(reply.post.class_ref_id))
        _require_may_delete(request, reply.author_id, reply.post.class_ref)
        reply.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


def _require_may_delete(request, author_id, klass: Class) -> None:
    viewer = request_user_id(request)
    if viewer != author_id and viewer != klass.owner_id:
        raise PermissionDenied("Hanya penulis atau dosen kelas yang bisa menghapus ini.")
