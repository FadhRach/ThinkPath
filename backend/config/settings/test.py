"""Dipaksa manage.py untuk `test` (SQLite in-memory); POSTGRES_* diabaikan agar tes tak menyentuh DB sungguhan."""
import os

from config.settings.base import *  # noqa: F403

# Kunci .env tidak boleh sampai ke tes (Winston menagih per kata); Groq palsu karena Cek Paham butuh kunci ada.
os.environ["GROQ_API_KEY"] = "kunci-palsu-untuk-tes"
os.environ["WINSTON_API_KEY"] = ""

SECRET_KEY = "test-secret-key-test-secret-key-0123456789"  # >= 32 byte, seperti produksi
DATABASES = {"default": {"ENGINE": "django.db.backends.sqlite3", "NAME": ":memory:"}}
PASSWORD_HASHERS = ["django.contrib.auth.hashers.MD5PasswordHasher"]
LOGGING = {"version": 1, "disable_existing_loggers": False}

ANALYSIS_INLINE = True  # job dikerjakan seketika di request; lihat base.py
