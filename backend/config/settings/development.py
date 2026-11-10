"""Lokal: runserver + Postgres lokal."""
from config.settings.base import *  # noqa: F403

DEBUG = True
SECRET_KEY = SECRET_KEY or "dev-secret-key"  # noqa: F405

# runserver: thread per permintaan, koneksi persisten dari thread mati menghabiskan max_connections.
DATABASES = {"default": {**DATABASES["default"], "CONN_MAX_AGE": 0}}  # noqa: F405

ANALYSIS_INLINE = True  # job dikerjakan seketika di request; lihat base.py
