"""Notifikasi forum. Dipanggil view SETELAH tulisan tersimpan, dibungkus safe()."""
from __future__ import annotations

from apps.academics.models import ClassMembership
from apps.forum.models import ForumPost, ForumReply, PostKind
from apps.notifications.models import NotificationKind
from apps.notifications.services import notify, notify_grouped

EXCERPT = 120


def _excerpt(text: str) -> str:
    flat = " ".join(text.split())
    return flat if len(flat) <= EXCERPT else flat[: EXCERPT - 1] + "…"


def _member_ids(class_id) -> list:
    return list(
        ClassMembership.objects.filter(class_ref_id=class_id).values_list("student_profile_id", flat=True)
    )


def _thread_link(klass, post_id, *, for_owner: bool) -> str:
    base = f"/dashboard/classes/{klass.id}" if for_owner else f"/student/kelas/{klass.id}"
    return f"{base}?tab=forum&post={post_id}"


def post_created(post: ForumPost) -> int:
    klass = post.class_ref
    author_is_owner = post.author_id == klass.owner_id
    if post.kind == PostKind.ANNOUNCEMENT:
        return notify(
            _member_ids(klass.id),
            kind=NotificationKind.ANNOUNCEMENT_NEW,
            title=f"Pengumuman: {post.title}",
            body=klass.name,
            link=_thread_link(klass, post.id, for_owner=False),
        )
    if author_is_owner:
        return notify(
            _member_ids(klass.id),
            kind=NotificationKind.FORUM_POST_NEW,
            title=f"Topik baru di forum: {post.title}",
            body=klass.name,
            link=_thread_link(klass, post.id, for_owner=False),
        )
    author = post.author.label if post.author else "Mahasiswa"
    return notify(
        [klass.owner_id],
        kind=NotificationKind.FORUM_POST_NEW,
        title=f"Topik baru di forum: {post.title}",
        body=f"{klass.name}. Dari {author}.",
        link=_thread_link(klass, post.id, for_owner=True),
    )


def reply_created(reply: ForumReply) -> None:
    """Pemilik topik dan dosen kelas diberi tahu; balasan beruntun digabung selama belum dibaca."""
    post = reply.post
    klass = post.class_ref
    replier_id = reply.author_id
    replier = reply.author.label if reply.author else "Seseorang"

    recipients = {post.author_id}
    if replier_id != klass.owner_id:
        recipients.add(klass.owner_id)
    recipients.discard(replier_id)
    recipients.discard(None)

    for recipient_id in recipients:

        def build(count: int, _replier=replier) -> tuple[str, str]:
            title = (
                f"{count} balasan baru di: {post.title}"
                if count > 1
                else f"Balasan baru di: {post.title}"
            )
            return title, f"{klass.name}. {_replier}: {_excerpt(reply.body)}"

        notify_grouped(
            recipient_id,
            kind=NotificationKind.FORUM_REPLY_NEW,
            group_key=f"forum-reply:{post.id}",
            build=build,
            link=_thread_link(klass, post.id, for_owner=recipient_id == klass.owner_id),
        )
