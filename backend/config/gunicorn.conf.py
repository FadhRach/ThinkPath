"""Konfigurasi gunicorn untuk container produksi (VPS 1 GB RAM).

Analisis berjalan sinkron di dalam request dan bisa ~20 detik menunggu
Winston + Groq. Itu menunggu jaringan (IO), jadi yang ditambah adalah
thread, bukan worker: satu worker + 8 thread melayani dashboard dosen tetap
lancar selagi beberapa mahasiswa mengumpulkan, dengan RAM satu proses saja.
"""
import os

bind = "0.0.0.0:8000"
worker_class = "gthread"
workers = int(os.getenv("WEB_CONCURRENCY", "1"))
threads = int(os.getenv("GUNICORN_THREADS", "8"))
# Di atas timeout Groq (12 s) + Winston (8 s) plus overhead.
timeout = int(os.getenv("GUNICORN_TIMEOUT", "60"))
graceful_timeout = 30
keepalive = 5
# Daur ulang worker berkala supaya memori yang merayap tidak menumpuk.
max_requests = 1000
max_requests_jitter = 100
# Heartbeat worker di RAM, bukan di disk overlay container (macOS tidak
# punya /dev/shm, jadi jatuh ke bawaan gunicorn saat dijalankan di laptop).
if os.path.isdir("/dev/shm"):
    worker_tmp_dir = "/dev/shm"
accesslog = "-"
errorlog = "-"
