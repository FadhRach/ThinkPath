"""Pengumuman lama harus ikut pindah ke forum saat migrasi dijalankan."""
from __future__ import annotations

from django.db import connection
from django.db.migrations.executor import MigrationExecutor
from django.test import TransactionTestCase


class CopyAnnouncementsMigrationTest(TransactionTestCase):
    def test_old_announcements_become_pinned_forum_posts(self):
        executor = MigrationExecutor(connection)
        executor.migrate([("academics", "0006_class_owner_nullable"), ("forum", "0001_initial")])
        old = executor.loader.project_state(
            [("academics", "0006_class_owner_nullable"), ("forum", "0001_initial")]
        ).apps
        Profile = old.get_model("accounts", "Profile")
        Class = old.get_model("academics", "Class")
        Announcement = old.get_model("academics", "Announcement")
        owner = Profile.objects.create(email="o@t.local", display_name="O", role="teacher")
        klass = Class.objects.create(
            owner=owner, name="K", subject="S", education_level="S1", join_code="MIG-0001"
        )
        Announcement.objects.create(class_ref=klass, title="UTS", body="Jumat")

        executor = MigrationExecutor(connection)
        executor.migrate([("academics", "0007_remove_announcement"), ("forum", "0002_copy_announcements")])
        new = executor.loader.project_state(
            [("academics", "0007_remove_announcement"), ("forum", "0002_copy_announcements")]
        ).apps
        post = new.get_model("forum", "ForumPost").objects.get(title="UTS")
        self.assertEqual(post.kind, "announcement")
        self.assertEqual(post.author_id, owner.id)
        self.assertEqual(post.class_ref_id, klass.id)
