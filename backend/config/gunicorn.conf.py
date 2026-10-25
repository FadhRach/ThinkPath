"""gunicorn di container produksi (VPS 1 GB RAM).

Analisis jawaban tidak lagi berjalan di sini: pengumpulan hanya menyimpan, dan
container `worker` mengerjakan antrean (run_analysis_worker). Yang masih
menahan thread cukup lama: OCR dokumen dan finalisasi Cek Paham (STT + penilai,
sampai ~50 detik), keduanya diberi throttle. Karena IO, yang ditambah thread,
bukan worker. Tetap 1 worker: penghitung throttle login ada di memori
proses, tiap worker tambahan menggandakan batasnya.
"""
bind = "0.0.0.0:8000"
worker_class = "gthread"
workers = 1
threads = 8
timeout = 60  # di atas timeout Groq (12 s) + Winston (8 s)
graceful_timeout = 30
keepalive = 5
max_requests = 1000  # daur ulang worker agar memori tidak merayap
max_requests_jitter = 100
worker_tmp_dir = "/dev/shm"
control_socket_disable = True  # tidak dipakai, dan user container tanpa home dir
accesslog = "-"
errorlog = "-"
