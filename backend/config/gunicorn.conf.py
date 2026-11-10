"""gunicorn produksi (VPS 1 GB). Beban IO (OCR, finalisasi Cek Paham): tambah thread, bukan worker.

workers = 1: penghitung throttle ada di memori proses, tiap worker tambahan menggandakan batasnya.
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
