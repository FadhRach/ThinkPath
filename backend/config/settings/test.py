"""Settings tes. Selalu dipakai `manage.py test` (dipaksa di manage.py).

DATABASE_URL sengaja DIABAIKAN: dulu tes ikut memakai DATABASE_URL di .env
dan nyaris menghapus basis data test di server produksi.
"""
from config.settings.base import *  # noqa: F403

DEBUG = False
SECRET_KEY = "test-secret-key"
DATABASES = {"default": {"ENGINE": "django.db.backends.sqlite3", "NAME": ":memory:"}}
CACHES = {"default": {"BACKEND": "django.core.cache.backends.locmem.LocMemCache"}}
PASSWORD_HASHERS = ["django.contrib.auth.hashers.MD5PasswordHasher"]
LOGGING = {"version": 1, "disable_existing_loggers": False}
