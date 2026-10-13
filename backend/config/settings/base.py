"""Settings bersama. Lingkungan dipilih lewat DJANGO_SETTINGS_MODULE:
development (bawaan manage.py), production (container), test (dipaksa `manage.py test`).
"""
import os
from pathlib import Path

import dj_database_url
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parents[2]  # backend/
load_dotenv(BASE_DIR / ".env")

DEBUG = False
SECRET_KEY = os.getenv("DJANGO_SECRET_KEY", "")
ALLOWED_HOSTS = ["localhost", "127.0.0.1"]

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

# Bawaan: Postgres lokal lewat socket, database `thinkpath`, user = user OS.
DATABASES = {
    "default": dj_database_url.parse(
        os.getenv("DATABASE_URL") or "postgres:///thinkpath",
        conn_max_age=60,
        conn_health_checks=True,
    )
}

LANGUAGE_CODE = "id"
TIME_ZONE = "UTC"  # zona tampilan (Asia/Jakarta) urusan frontend
USE_I18N = True
USE_TZ = True

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": ["apps.accounts.authentication.TokenAuthentication"],
    "DEFAULT_PERMISSION_CLASSES": ["rest_framework.permissions.IsAuthenticated"],
    "DEFAULT_RENDERER_CLASSES": ["rest_framework.renderers.JSONRenderer"],
    "UNAUTHENTICATED_USER": None,
    # Hanya endpoint auth yang dibatasi; penghitungnya di memori proses (LocMemCache).
    "DEFAULT_THROTTLE_CLASSES": ["rest_framework.throttling.ScopedRateThrottle"],
    "DEFAULT_THROTTLE_RATES": {"auth_register": "30/hour", "auth_login": "20/min"},
}

AUTH_TOKEN_LIFETIME_DAYS = 7

CORS_ALLOWED_ORIGINS = os.getenv(
    "CORS_ALLOWED_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000"
).split(",")
CORS_ALLOW_CREDENTIALS = True

LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "handlers": {"console": {"class": "logging.StreamHandler"}},
    "root": {"handlers": ["console"], "level": "INFO"},
    # Tanpa ini Django mengirim galat 500 ke email ADMINS, bukan ke log.
    "loggers": {"django.request": {"handlers": ["console"], "level": "ERROR", "propagate": False}},
}
