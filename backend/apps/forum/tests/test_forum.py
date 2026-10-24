"""Tes forum kelas.

Yang dijaga:
1. Hanya dosen pemilik dan mahasiswa anggota yang melihat atau menulis; selain itu 404.
2. Pengumuman hanya dari dosen, tampil di atas, dan memicu notifikasi ke anggota.
3. Balasan memberi tahu pemilik topik dan dosen, bukan pembalasnya sendiri.
4. Hapus: penulis atau dosen kelas. Kelas arsip tidak menerima tulisan baru.
5. Menghapus akun mahasiswa menghapus tulisannya; tulisan dosen tetap ada.
"""
from __future__ import annotations

from django.test import TestCase
from rest_framework.test import APIClient

from apps.academics.models import Class, ClassMembership
from apps.accounts.authentication import create_access_token
from apps.accounts.deletion import delete_account
from apps.accounts.models import EducationLevel, Profile, Role
from apps.forum.models import ForumPost, ForumReply, PostKind
from apps.notifications.models import Notification, NotificationKind


def _client(profile: Profile) -> APIClient:
    client = APIClient()
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {create_access_token(profile)}")
    return client


class ForumBase(TestCase):
    def setUp(self):
        self.dosen = Profile.objects.create(email="d@t.local", display_name="Dosen Uji", role=Role.TEACHER)
        self.dosen2 = Profile.objects.create(email="d2@t.local", display_name="Dosen Lain", role=Role.TEACHER)
        self.mhs = Profile.objects.create(email="m1@t.local", display_name="Mahasiswa Satu", role=Role.STUDENT)
        self.mhs2 = Profile.objects.create(email="m2@t.local", display_name="Mahasiswa Dua", role=Role.STUDENT)
        self.luar = Profile.objects.create(email="x@t.local", display_name="Orang Luar", role=Role.STUDENT)
        self.kelas = Class.objects.create(
            owner=self.dosen,
            name="Ekonomi B",
            subject="Ekonomi",
            education_level=EducationLevel.S1,
            join_code="EP-FORUM1",
        )
        for student in (self.mhs, self.mhs2):
            ClassMembership.objects.create(class_ref=self.kelas, student_profile=student)
        self.url = f"/api/classes/{self.kelas.id}/forum"

    def make_post(self, author, kind=PostKind.DISCUSSION, title="Judul topik", body="Isi topik."):
        return ForumPost.objects.create(class_ref=self.kelas, author=author, kind=kind, title=title, body=body)


class ForumAccessTest(ForumBase):
    def test_outsiders_and_other_teachers_get_404(self):
        post = self.make_post(self.mhs)
        for who in (self.luar, self.dosen2):
            client = _client(who)
            self.assertEqual(client.get(self.url).status_code, 404, who.email)
            self.assertEqual(
                client.post(self.url, {"title": "abc", "body": "x"}, format="json").status_code, 404
            )
            self.assertEqual(client.get(f"/api/forum/posts/{post.id}").status_code, 404)
            self.assertEqual(
                client.post(f"/api/forum/posts/{post.id}/replies", {"body": "x"}, format="json").status_code,
                404,
            )
            self.assertEqual(client.delete(f"/api/forum/posts/{post.id}").status_code, 404)

    def test_members_and_owner_can_read(self):
        self.make_post(self.mhs)
        for who in (self.dosen, self.mhs, self.mhs2):
            response = _client(who).get(self.url)
            self.assertEqual(response.status_code, 200, who.email)
            self.assertEqual(len(response.json()), 1)


class ForumFeedTest(ForumBase):
    def test_feed_spans_member_classes_only_and_is_student_only(self):
        other_class = Class.objects.create(
            owner=self.dosen2, name="Kelas Lain", subject="S", education_level=EducationLevel.S1, join_code="EP-FEED02"
        )
        ForumPost.objects.create(class_ref=other_class, author=self.dosen2, title="Bukan kelasmu", body="x")
        mine = self.make_post(self.dosen, kind=PostKind.ANNOUNCEMENT, title="Kelasku")
        feed = _client(self.mhs).get("/api/student/forum/recent").json()
        self.assertEqual([item["id"] for item in feed], [str(mine.id)])
        self.assertEqual(feed[0]["class_name"], "Ekonomi B")
        self.assertEqual(_client(self.luar).get("/api/student/forum/recent").json(), [])
        self.assertEqual(_client(self.dosen).get("/api/student/forum/recent").status_code, 403)
        self.assertEqual(_client(self.mhs).get("/api/student/forum/recent?limit=abc").status_code, 200)


class ForumPostingTest(ForumBase):
    def test_only_teacher_publishes_announcements_and_they_sit_on_top(self):
        denied = _client(self.mhs).post(
            self.url, {"kind": "announcement", "title": "Palsu", "body": "x"}, format="json"
        )
        self.assertEqual(denied.status_code, 403)

        self.make_post(self.mhs, title="Diskusi lebih baru")
        created = _client(self.dosen).post(
            self.url, {"kind": "announcement", "title": "UTS dimajukan", "body": "Jumat."}, format="json"
        )
        self.assertEqual(created.status_code, 201)
        listing = _client(self.mhs).get(self.url).json()
        self.assertEqual([item["kind"] for item in listing], ["announcement", "discussion"])
        self.assertEqual(listing[0]["author_role"], "teacher")

    def test_announcement_notifies_members_not_outsiders(self):
        _client(self.dosen).post(
            self.url, {"kind": "announcement", "title": "UTS dimajukan", "body": "Jumat."}, format="json"
        )
        notified = set(
            Notification.objects.filter(kind=NotificationKind.ANNOUNCEMENT_NEW).values_list(
                "recipient_id", flat=True
            )
        )
        self.assertEqual(notified, {self.mhs.id, self.mhs2.id})

    def test_student_question_notifies_the_teacher(self):
        response = _client(self.mhs).post(
            self.url, {"title": "Soal nomor 3", "body": "Maksudnya apa?"}, format="json"
        )
        self.assertEqual(response.status_code, 201)
        note = Notification.objects.get(kind=NotificationKind.FORUM_POST_NEW)
        self.assertEqual(note.recipient_id, self.dosen.id)
        self.assertIn("tab=forum", note.link)
        self.assertTrue(note.link.startswith("/dashboard/classes/"))

    def test_validation(self):
        client = _client(self.mhs)
        self.assertEqual(client.post(self.url, {"title": "ab", "body": "x"}, format="json").status_code, 400)
        self.assertEqual(client.post(self.url, {"title": "Judul", "body": "   "}, format="json").status_code, 400)
        self.assertEqual(
            client.post(self.url, {"title": "Judul", "body": "x" * 4001}, format="json").status_code, 400
        )

    def test_archived_class_rejects_new_writing(self):
        post = self.make_post(self.dosen)
        Class.objects.filter(pk=self.kelas.pk).update(owner=None)
        response = _client(self.mhs).post(self.url, {"title": "Halo", "body": "x"}, format="json")
        self.assertEqual(response.status_code, 400)
        reply = _client(self.mhs).post(f"/api/forum/posts/{post.id}/replies", {"body": "x"}, format="json")
        self.assertEqual(reply.status_code, 400)
        # Membaca tetap boleh: arsip tetap bisa dibaca.
        self.assertEqual(_client(self.mhs).get(self.url).status_code, 200)


class ForumReplyTest(ForumBase):
    def test_teacher_reply_notifies_post_author_only(self):
        post = self.make_post(self.mhs)
        response = _client(self.dosen).post(
            f"/api/forum/posts/{post.id}/replies", {"body": "Lihat slide 4."}, format="json"
        )
        self.assertEqual(response.status_code, 201)
        notes = Notification.objects.filter(kind=NotificationKind.FORUM_REPLY_NEW)
        self.assertEqual({n.recipient_id for n in notes}, {self.mhs.id})
        self.assertTrue(notes.first().link.startswith("/student/kelas/"))

    def test_student_reply_notifies_author_and_teacher_but_not_self(self):
        post = self.make_post(self.mhs)
        _client(self.mhs2).post(f"/api/forum/posts/{post.id}/replies", {"body": "Saya juga."}, format="json")
        notified = set(
            Notification.objects.filter(kind=NotificationKind.FORUM_REPLY_NEW).values_list(
                "recipient_id", flat=True
            )
        )
        self.assertEqual(notified, {self.mhs.id, self.dosen.id})

    def test_own_reply_to_own_post_notifies_only_the_teacher(self):
        post = self.make_post(self.mhs)
        _client(self.mhs).post(f"/api/forum/posts/{post.id}/replies", {"body": "Tambahan."}, format="json")
        notified = list(
            Notification.objects.filter(kind=NotificationKind.FORUM_REPLY_NEW).values_list(
                "recipient_id", flat=True
            )
        )
        self.assertEqual(notified, [self.dosen.id])

    def test_consecutive_replies_merge_while_unread(self):
        post = self.make_post(self.mhs)
        teacher = _client(self.dosen)
        for text in ("Satu.", "Dua.", "Tiga."):
            teacher.post(f"/api/forum/posts/{post.id}/replies", {"body": text}, format="json")
        note = Notification.objects.get(kind=NotificationKind.FORUM_REPLY_NEW, recipient=self.mhs)
        self.assertEqual(note.count, 3)
        self.assertIn("3 balasan", note.title)

    def test_reply_bumps_activity_and_detail_lists_replies_in_order(self):
        old = self.make_post(self.mhs, title="Topik lama")
        newer = self.make_post(self.mhs, title="Topik baru")
        _client(self.dosen).post(f"/api/forum/posts/{old.id}/replies", {"body": "Jawaban."}, format="json")
        titles = [item["title"] for item in _client(self.mhs).get(self.url).json()]
        self.assertEqual(titles, ["Topik lama", "Topik baru"])
        detail = _client(self.mhs).get(f"/api/forum/posts/{old.id}").json()
        self.assertEqual(detail["reply_count"], 1)
        self.assertEqual(detail["replies"][0]["author_role"], "teacher")
        self.assertFalse(detail["replies"][0]["is_mine"])
        self.assertTrue(detail["is_mine"])
        self.assertEqual(newer.replies.count(), 0)


class ForumDeleteTest(ForumBase):
    def test_author_and_class_teacher_may_delete_others_may_not(self):
        post = self.make_post(self.mhs)
        self.assertEqual(_client(self.mhs2).delete(f"/api/forum/posts/{post.id}").status_code, 403)
        self.assertEqual(_client(self.mhs).delete(f"/api/forum/posts/{post.id}").status_code, 204)

        other = self.make_post(self.mhs)
        self.assertEqual(_client(self.dosen).delete(f"/api/forum/posts/{other.id}").status_code, 204)

    def test_reply_deletion_rules(self):
        post = self.make_post(self.mhs)
        reply = ForumReply.objects.create(post=post, author=self.mhs2, body="Balasan.")
        self.assertEqual(_client(self.mhs).delete(f"/api/forum/replies/{reply.id}").status_code, 403)
        self.assertEqual(_client(self.luar).delete(f"/api/forum/replies/{reply.id}").status_code, 404)
        self.assertEqual(_client(self.mhs2).delete(f"/api/forum/replies/{reply.id}").status_code, 204)


class ForumAccountDeletionTest(ForumBase):
    def test_student_deletion_removes_their_writing_but_teacher_writing_stays(self):
        mine = self.make_post(self.mhs, title="Pertanyaan saya")
        theirs = self.make_post(self.dosen, kind=PostKind.ANNOUNCEMENT, title="Pengumuman")
        ForumReply.objects.create(post=theirs, author=self.mhs, body="Terima kasih, Pak.")
        ForumReply.objects.create(post=theirs, author=self.mhs2, body="Siap.")
        delete_account(self.mhs)
        self.assertFalse(ForumPost.objects.filter(pk=mine.pk).exists())
        self.assertEqual(list(theirs.replies.values_list("body", flat=True)), ["Siap."])

    def test_teacher_deletion_keeps_posts_with_a_blank_author(self):
        announcement = self.make_post(self.dosen, kind=PostKind.ANNOUNCEMENT, title="Pengumuman")
        delete_account(self.dosen)
        announcement.refresh_from_db()
        self.assertIsNone(announcement.author_id)
        listing = _client(self.mhs).get(self.url).json()
        self.assertEqual(listing[0]["author_name"], "Dosen (akun telah dihapus)")
        self.assertEqual(listing[0]["author_role"], "teacher")
