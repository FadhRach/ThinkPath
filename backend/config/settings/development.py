"""Lokal: runserver + Postgres lokal."""
from config.settings.base import *  # noqa: F403

DEBUG = True
SECRET_KEY = SECRET_KEY or "dev-secret-key"  # noqa: F405

# runserver membuat thread baru per permintaan; koneksi persisten dari thread
# yang sudah mati tidak pernah ditutup dan menghabiskan max_connections Postgres
# (diukur: 10 permintaan paralel -> OperationalError). Di produksi gunicorn
# memakai 8 thread tetap, jadi CONN_MAX_AGE di base.py aman di sana.
DATABASES = {"default": {**DATABASES["default"], "CONN_MAX_AGE": 0}}  # noqa: F405

ANALYSIS_INLINE = True  # job dikerjakan seketika di request; lihat base.py
