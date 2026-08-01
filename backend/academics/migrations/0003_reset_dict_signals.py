"""Reset signals lama berbentuk dict menjadi list kosong.

Semantik signals berubah dari dict metrik ke list string bahasa Indonesia.
Row lama di-reset ke []; seeder menulis ulang data demo, dan submission asli
bisa dianalisis ulang lewat tombol Analisis Ulang.
"""
from django.db import migrations


def reset_non_list_signals(apps, schema_editor):
    AnalysisResult = apps.get_model("academics", "AnalysisResult")
    for analysis in AnalysisResult.objects.all().iterator():
        if not isinstance(analysis.signals, list):
            analysis.signals = []
            analysis.save(update_fields=["signals"])


class Migration(migrations.Migration):
    dependencies = [
        ("academics", "0002_analysisresult_confidence_analysisresult_summary_and_more"),
    ]

    operations = [
        migrations.RunPython(reset_non_list_signals, migrations.RunPython.noop),
    ]
