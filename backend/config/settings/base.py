"""Settings bersama untuk semua lingkungan.

Pilih lingkungan lewat DJANGO_SETTINGS_MODULE:
- config.settings.development  (bawaan manage.py)
- config.settings.production   (container Docker di VPS)
- config.settings.test         (selalu dipakai `manage.py test`)

Identitas dikelola sendiri lewat tabel profiles + JWT lokal
(apps.accounts.authentication), bukan django.contrib.auth.User.
"""
from __future__ import annotations

from pathlib import Path

import dj_database_url
from dotenv import load_dotenv

from common.env import env_bool, env_int, env_list, env_str

# backend/
BASE_DIR = Path(__file__).resolve().parents[2]
load_dotenv(BASE_DIR / ".env")

DEBUG = env_bool("DJANGO_DEBUG", default=False)
SECRET_KEY = env_str("DJANGO_SECRET_KEY")
ALLOWED_HOSTS = env_list("DJANGO_ALLOWED_HOSTS", ["localhost", "127.0.0.1"])

INSTALLED_APPS = [
    "rest_framework",
    "corsheaders",
    "apps.accounts",
    "apps.academics",
    "apps.analysis",
    "apps.notifications",
]

MIDDLEWARE = [
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.security.SecurityMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "config.urls"
WSGI_APPLICATION = "config.wsgi.application"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {"context_processors": []},
    },
]

# DATABASE_URL kosong -> SQLite lokal (dev tanpa Postgres).
DATABASES = {
    "default": dj_database_url.parse(
        env_str("DATABASE_URL") or f"sqlite:///{BASE_DIR / 'db.sqlite3'}",
        # Postgres satu jaringan Docker, tanpa pooler: koneksi dipakai ulang
        # 60 detik, dan diperiksa dulu sebelum dipakai agar tidak basi.
        conn_max_age=env_int("DB_CONN_MAX_AGE", 60),
        conn_health_checks=True,
    )
}

LANGUAGE_CODE = "id"
# Backend selalu UTC; zona tampilan (Asia/Jakarta) urusan frontend.
TIME_ZONE = "UTC"
USE_I18N = True
USE_TZ = True

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "apps.accounts.authentication.TokenAuthentication",
    ],
    "DEFAULT_PERMISSION_CLASSES": [
        "rest_framework.permissions.IsAuthenticated",
    ],
    "UNAUTHENTICATED_USER": None,
    # Hanya endpoint auth yang dibatasi (tebak sandi, spam pendaftaran).
    # Membatasi seluruh API akan menghukum dashboard dosen yang berisi banyak
    # grafik. Penghitungnya disimpan di CACHES (lihat production.py).
    "DEFAULT_THROTTLE_CLASSES": [
        "rest_framework.throttling.ScopedRateThrottle",
    ],
    "DEFAULT_THROTTLE_RATES": {
        # Longgar untuk satu kelas yang mendaftar dari wifi kampus (satu IP).
        "auth_register": env_str("THROTTLE_REGISTER", "30/hour"),
        "auth_login": env_str("THROTTLE_LOGIN", "20/min"),
    },
}

AUTH_TOKEN_LIFETIME_DAYS = env_int("AUTH_TOKEN_LIFETIME_DAYS", 7)

CORS_ALLOWED_ORIGINS = env_list("CORS_ALLOWED_ORIGINS", ["http://localhost:3000"])
CORS_ALLOW_CREDENTIALS = True

LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {
        "plain": {"format": "%(asctime)s %(levelname)s %(name)s: %(message)s"},
    },
    "handlers": {
        "console": {"class": "logging.StreamHandler", "formatter": "plain"},
    },
    # Semua log ke stdout/stderr, ditampung `docker compose logs`.
    "root": {"handlers": ["console"], "level": env_str("LOG_LEVEL", "INFO")},
    "loggers": {
        # Galat 500 + traceback; tanpa ini Django mengirimnya ke email ADMINS.
        "django.request": {"handlers": ["console"], "level": "ERROR", "propagate": False},
    },
}
