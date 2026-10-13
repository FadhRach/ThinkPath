"""Dipaksa untuk `manage.py test`. DATABASE_URL sengaja diabaikan: dulu tes
memakai DATABASE_URL di .env dan nyaris menghapus DB server produksi."""
from config.settings.base import *  # noqa: F403

SECRET_KEY = "test-secret-key"
DATABASES = {"default": {"ENGINE": "django.db.backends.sqlite3", "NAME": ":memory:"}}
PASSWORD_HASHERS = ["django.contrib.auth.hashers.MD5PasswordHasher"]
LOGGING = {"version": 1, "disable_existing_loggers": False}
