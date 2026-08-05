"""Pindahkan jenjang kelas dan tugas dari sekolah ke mahasiswa.

Pasangan dari core/0003. Lihat berkas itu untuk alasan pemetaannya.
"""
from __future__ import annotations

from django.db import migrations, models

CHOICES = [("D3", "D3"), ("S1", "S1"), ("S2", "S2"), ("S3", "S3")]
OLD_VALUES = ("SD", "SMP", "SMA-SMK")


def forward(apps, schema_editor):
    for model_name in ("Class", "Assignment"):
        model = apps.get_model("academics", model_name)
        model.objects.filter(education_level__in=OLD_VALUES).update(
            education_level="S1"
        )


def backward(apps, schema_editor):
    for model_name in ("Class", "Assignment"):
        model = apps.get_model("academics", model_name)
        model.objects.all().update(education_level="SMA-SMK")


class Migration(migrations.Migration):

    dependencies = [
        ("academics", "0004_analysisresult_analysis_source_and_more"),
    ]

    operations = [
        migrations.AlterField(
            model_name="class",
            name="education_level",
            field=models.CharField(choices=CHOICES, max_length=16),
        ),
        migrations.AlterField(
            model_name="assignment",
            name="education_level",
            field=models.CharField(choices=CHOICES, max_length=16),
        ),
        migrations.RunPython(forward, backward),
    ]
