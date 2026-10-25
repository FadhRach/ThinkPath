"""Dipaksa untuk `manage.py test`. POSTGRES_* sengaja diabaikan: dulu tes
memakai database dari .env dan nyaris menghapus DB server produksi."""
import os

from config.settings.base import *  # noqa: F403

# Kunci dari .env tidak boleh sampai ke tes: tes yang lupa menirukan penyedia
# akan menagih kredit sungguhan (Winston per kata). Groq diisi kunci palsu
# karena tes Cek Paham mensyaratkan kunci ada (503 bila kosong) dan menirukan
# panggilannya sendiri; panggilan yang lolos tiruan ditolak 401, tanpa biaya.
os.environ["GROQ_API_KEY"] = "kunci-palsu-untuk-tes"
os.environ["WINSTON_API_KEY"] = ""

SECRET_KEY = "test-secret-key-test-secret-key-0123456789"  # >= 32 byte, seperti produksi
DATABASES = {"default": {"ENGINE": "django.db.backends.sqlite3", "NAME": ":memory:"}}
PASSWORD_HASHERS = ["django.contrib.auth.hashers.MD5PasswordHasher"]
LOGGING = {"version": 1, "disable_existing_loggers": False}

ANALYSIS_INLINE = True  # job dikerjakan seketika di request; lihat base.py
