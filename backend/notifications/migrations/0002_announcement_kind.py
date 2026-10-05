from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("notifications", "0001_initial")]

    operations = [
        migrations.AlterField(
            model_name="notification",
            name="kind",
            field=models.CharField(
                max_length=32,
                choices=[
                    ("assignment_new", "Tugas baru"),
                    ("material_new", "Materi baru"),
                    ("announcement_new", "Pengumuman kelas"),
                    ("submission_graded", "Jawaban dinilai"),
                    ("session_scheduled", "Sesi diskusi dijadwalkan"),
                    ("session_cancelled", "Sesi diskusi dibatalkan"),
                    ("deadline_soon", "Tenggat dekat"),
                    ("submissions_new", "Pengumpulan baru"),
                    ("students_joined", "Mahasiswa bergabung"),
                ],
            ),
        ),
    ]
