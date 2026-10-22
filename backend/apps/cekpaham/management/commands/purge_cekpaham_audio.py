from django.core.management.base import BaseCommand

from apps.cekpaham.services import audio


class Command(BaseCommand):
    help = (
        f"Hapus audio jawaban Cek Paham yang lebih tua dari {audio.RETENTION_DAYS} hari. "
        "Transkrip dan hasil penilaian tetap disimpan."
    )

    def handle(self, *args, **options):
        self.stdout.write(f"{audio.purge_audio()} berkas audio dihapus.")
