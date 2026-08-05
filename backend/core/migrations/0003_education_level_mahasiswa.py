"""Pindahkan jenjang dari sekolah ke mahasiswa.

Baris lama menyimpan SD, SMP, atau SMA-SMK. Nilai itu tidak lagi ada di daftar
pilihan, dan kalau dibiarkan akan menjadi data yang tidak valid di produksi.

Seluruhnya dipetakan ke S1 karena data yang ada hanya data demo, dan S1 adalah
kasus mayoritas. Migrasi mundur mengembalikannya ke SMA-SMK sebagai perkiraan
terdekat. Pemetaan ini memang lossy, dan itu bisa diterima karena tidak ada
data pengguna sungguhan yang dipertaruhkan pada tahap ini.
"""
from __future__ import annotations

from django.db import migrations, models

OLD_TO_NEW = {"SD": "S1", "SMP": "S1", "SMA-SMK": "S1"}


def forward(apps, schema_editor):
    Profile = apps.get_model("core", "Profile")
    for old_value in OLD_TO_NEW:
        Profile.objects.filter(education_level=old_value).update(
            education_level=OLD_TO_NEW[old_value]
        )


def backward(apps, schema_editor):
    Profile = apps.get_model("core", "Profile")
    Profile.objects.exclude(education_level="").update(education_level="SMA-SMK")


class Migration(migrations.Migration):

    dependencies = [
        ("core", "0002_profile_password_alter_profile_email_and_more"),
    ]

    operations = [
        migrations.AlterField(
            model_name="profile",
            name="education_level",
            field=models.CharField(
                blank=True,
                choices=[("D3", "D3"), ("S1", "S1"), ("S2", "S2"), ("S3", "S3")],
                default="",
                max_length=16,
            ),
        ),
        migrations.RunPython(forward, backward),
    ]
