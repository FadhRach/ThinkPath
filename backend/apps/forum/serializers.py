from __future__ import annotations

from rest_framework import serializers

from apps.accounts.models import Role
from apps.forum.models import ForumPost, ForumReply, PostKind

DELETED_TEACHER = "Dosen (akun telah dihapus)"
BODY_MAX = 4000


def author_info(author) -> tuple[str, str]:
    """(nama, peran). Penulis kosong hanya mungkin dosen: tulisan mahasiswa dihapus bersama akunnya."""
    if author is None:
        return DELETED_TEACHER, Role.TEACHER
    return author.label, author.role


class _AuthoredSerializer(serializers.ModelSerializer):
    author_name = serializers.SerializerMethodField()
    author_role = serializers.SerializerMethodField()
    is_mine = serializers.SerializerMethodField()

    def get_author_name(self, obj) -> str:
        return author_info(obj.author)[0]

    def get_author_role(self, obj) -> str:
        return author_info(obj.author)[1]

    def get_is_mine(self, obj) -> bool:
        viewer = self.context.get("viewer_id")
        return viewer is not None and obj.author_id == viewer


class ReplySerializer(_AuthoredSerializer):
    post_id = serializers.UUIDField(read_only=True)

    class Meta:
        model = ForumReply
        fields = ["id", "post_id", "author_name", "author_role", "is_mine", "body", "created_at"]


class PostSerializer(_AuthoredSerializer):
    class_id = serializers.UUIDField(source="class_ref_id", read_only=True)
    class_name = serializers.CharField(source="class_ref.name", read_only=True)
    reply_count = serializers.IntegerField(read_only=True)

    class Meta:
        model = ForumPost
        fields = [
            "id",
            "class_id",
            "class_name",
            "kind",
            "title",
            "body",
            "author_name",
            "author_role",
            "is_mine",
            "reply_count",
            "created_at",
            "last_activity_at",
        ]


class PostDetailSerializer(PostSerializer):
    replies = serializers.SerializerMethodField()

    class Meta(PostSerializer.Meta):
        fields = [*PostSerializer.Meta.fields, "replies"]

    def get_replies(self, obj) -> list[dict]:
        return ReplySerializer(obj.replies.all(), many=True, context=self.context).data


class PostCreateSerializer(serializers.Serializer):
    kind = serializers.ChoiceField(choices=PostKind.values, default=PostKind.DISCUSSION)
    title = serializers.CharField(min_length=3, max_length=160, trim_whitespace=True)
    body = serializers.CharField(min_length=1, max_length=BODY_MAX, trim_whitespace=True)


class ReplyCreateSerializer(serializers.Serializer):
    body = serializers.CharField(min_length=1, max_length=BODY_MAX, trim_whitespace=True)
