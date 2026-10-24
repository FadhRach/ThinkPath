"""Salin pengumuman lama ke forum sebagai topik berjenis "announcement".

Dijalankan sebelum academics 0007 menghapus tabel `announcements`. Penulis salinan
adalah dosen pemilik kelas saat ini (pengumuman lama memang hanya punya satu penulis
yang mungkin); kelas arsip tanpa pemilik menghasilkan penulis kosong.
"""
from django.db import migrations


def copy_announcements(apps, schema_editor):
    Announcement = apps.get_model("academics", "Announcement")
    ForumPost = apps.get_model("forum", "ForumPost")
    rows = [
        ForumPost(
            class_ref_id=item.class_ref_id,
            author_id=item.class_ref.owner_id,
            kind="announcement",
            title=item.title,
            body=item.body,
            created_at=item.created_at,
            last_activity_at=item.created_at,
        )
        for item in Announcement.objects.select_related("class_ref").iterator()
    ]
    ForumPost.objects.bulk_create(rows, batch_size=500)


class Migration(migrations.Migration):
    dependencies = [
        ("forum", "0001_initial"),
        ("academics", "0006_class_owner_nullable"),
    ]

    operations = [migrations.RunPython(copy_announcements, migrations.RunPython.noop)]
