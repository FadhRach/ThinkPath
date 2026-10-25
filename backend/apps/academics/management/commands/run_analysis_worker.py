"""Worker antrean analisis: mengerjakan AnalysisJob di luar request web.

    python manage.py run_analysis_worker            # berjalan terus (container `worker`)
    python manage.py run_analysis_worker --once     # kuras antrean lalu keluar

Beberapa thread mengklaim job dengan SELECT ... FOR UPDATE SKIP LOCKED, jadi
aman dijalankan lebih dari satu proses. Thread diberi batas kecil karena
pekerjaannya menunggu jaringan (Winston, Groq) dan jatah token Groq dibagi
dengan Cek Paham.

Setiap putaran menyentuh berkas denyut; healthcheck container memeriksa
umurnya (lihat docker-compose.yml).
"""
from __future__ import annotations

import logging
import signal
import threading
import time
from pathlib import Path

from django.core.management.base import BaseCommand
from django.db import close_old_connections

from apps.academics.services.analysis_jobs import claim_next, run_job

logger = logging.getLogger(__name__)

HEARTBEAT = Path("/tmp/analysis-worker.heartbeat")
IDLE_SLEEP_SECONDS = 1.0


class Command(BaseCommand):
    help = "Mengerjakan antrean analisis jawaban mahasiswa."

    def add_arguments(self, parser):
        parser.add_argument("--threads", type=int, default=3, help="Jumlah thread pengklaim (bawaan 3).")
        parser.add_argument("--once", action="store_true", help="Kuras antrean sekali lalu keluar.")

    def handle(self, *args, threads: int, once: bool, **options):
        stop = threading.Event()
        if threading.current_thread() is threading.main_thread():
            for sig in (signal.SIGTERM, signal.SIGINT):
                signal.signal(sig, lambda *_: stop.set())

        if once:
            self._drain(stop)
            return

        workers = [threading.Thread(target=self._loop, args=(stop,), daemon=True) for _ in range(threads)]
        for worker in workers:
            worker.start()
        self.stdout.write(f"Worker analisis berjalan dengan {threads} thread.")
        while not stop.is_set():
            HEARTBEAT.touch()
            stop.wait(5)
        for worker in workers:
            worker.join(timeout=30)

    def _loop(self, stop: threading.Event) -> None:
        while not stop.is_set():
            if not self._work_one():
                stop.wait(IDLE_SLEEP_SECONDS)

    def _drain(self, stop: threading.Event) -> None:
        while not stop.is_set() and self._work_one():
            pass

    @staticmethod
    def _work_one() -> bool:
        close_old_connections()
        try:
            job = claim_next()
            if job is None:
                return False
            run_job(job)
            return True
        except Exception:  # noqa: BLE001 - satu galat DB tidak boleh mematikan thread
            logger.exception("Putaran worker analisis gagal")
            time.sleep(IDLE_SLEEP_SECONDS)
            return False
        finally:
            close_old_connections()
