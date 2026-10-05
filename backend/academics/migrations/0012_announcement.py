import uuid

import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("academics", "0011_material")]

    operations = [
        migrations.CreateModel(
            name="Announcement",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("title", models.CharField(max_length=160)),
                ("body", models.TextField()),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("class_ref", models.ForeignKey(db_column="class_id", on_delete=django.db.models.deletion.CASCADE, related_name="announcements", to="academics.class")),
            ],
            options={
                "db_table": "announcements",
                "indexes": [models.Index(fields=["class_ref", "-created_at"], name="announcement_class_recent_idx")],
            },
        ),
    ]
