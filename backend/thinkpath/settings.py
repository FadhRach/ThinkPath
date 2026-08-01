"""Django settings untuk ThinkPath backend.

Catatan: Django ORM jadi satu-satunya jalur data; identitas dikelola sendiri
lewat tabel profiles + JWT lokal (core.authentication.TokenAuthentication).
"""
from __future__ import annotations

import os
from pathlib import Path

import dj_database_url
from django.core.exceptions import ImproperlyConfigured
from dotenv import load_dotenv


BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR / ".env")


def _env_bool(name: str, default: bool = False) -> bool:
    raw = os.getenv(name)
    if raw is None:
        return default
    return raw.strip().lower() in {"1", "true", "yes", "on"}


def _env_list(name: str, default: list[str]) -> list[str]:
    raw = os.getenv(name)
    if not raw:
        return default
    return [item.strip() for item in raw.split(",") if item.strip()]


# DEBUG default False (fail-closed). Dev mengaktifkannya lewat DJANGO_DEBUG=1
# di .env (lihat .env.example). Produksi tidak boleh menyalakannya.
DEBUG = _env_bool("DJANGO_DEBUG", default=False)

# SECRET_KEY menandatangani JWT auth (core.authentication). Di produksi wajib
# di-set; fallback dev hanya boleh saat DEBUG agar token tidak bisa dipalsukan.
SECRET_KEY = os.getenv("DJANGO_SECRET_KEY", "")
if not SECRET_KEY:
    if DEBUG:
        SECRET_KEY = "dev-secret-key-change-me"
    else:
        raise ImproperlyConfigured(
            "DJANGO_SECRET_KEY wajib di-set saat DEBUG=False."
        )

ALLOWED_HOSTS = _env_list("DJANGO_ALLOWED_HOSTS", ["localhost", "127.0.0.1"])

INSTALLED_APPS = [
    "django.contrib.contenttypes",
    "django.contrib.auth",
    "django.contrib.staticfiles",
    "rest_framework",
    "corsheaders",
    "core",
    "academics",
]

MIDDLEWARE = [
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.security.SecurityMiddleware",
    "django.middleware.common.CommonMiddleware",
]

ROOT_URLCONF = "thinkpath.urls"
WSGI_APPLICATION = "thinkpath.wsgi.application"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {"context_processors": []},
    },
]

# Database: pakai DATABASE_URL kalau ada, fallback sqlite untuk dev tanpa kredensial.
_database_url = os.getenv("DATABASE_URL")
if _database_url:
    # DB_CONN_MAX_AGE default 0: tiap request menutup koneksi, biar pooler
    # Supabase (free tier, batas 15 koneksi) yang melakukan pooling.
    # Kalau worker sedikit (mis. gunicorn --workers 2), set DB_CONN_MAX_AGE=60
    # untuk memakai ulang koneksi antar request dan memangkas latency GET;
    # conn_health_checks menjaga dari koneksi basi yang diputus pooler.
    DATABASES = {
        "default": dj_database_url.parse(
            _database_url,
            conn_max_age=int(os.getenv("DB_CONN_MAX_AGE", "0")),
            conn_health_checks=True,
        ),
    }
else:
    DATABASES = {
        "default": {
            "ENGINE": "django.db.backends.sqlite3",
            "NAME": BASE_DIR / "db.sqlite3",
        },
    }

LANGUAGE_CODE = "id"
TIME_ZONE = "UTC"
USE_I18N = True
USE_TZ = True

STATIC_URL = "static/"
STATIC_ROOT = BASE_DIR / "staticfiles"

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "core.authentication.TokenAuthentication",
    ],
    "DEFAULT_PERMISSION_CLASSES": [
        "rest_framework.permissions.IsAuthenticated",
    ],
    "UNAUTHENTICATED_USER": None,
}

AUTH_TOKEN_LIFETIME_DAYS = int(os.getenv("AUTH_TOKEN_LIFETIME_DAYS", "7"))

CORS_ALLOWED_ORIGINS = _env_list(
    "CORS_ALLOWED_ORIGINS",
    ["http://localhost:3000"],
)
CORS_ALLOW_CREDENTIALS = True

# Pengamanan produksi. Aktif hanya saat DEBUG=False supaya dev lokal (HTTP)
# tidak terkena redirect HTTPS. HF Spaces menaruh TLS di proxy, jadi Django
# perlu tahu request asli HTTPS lewat header X-Forwarded-Proto.
if not DEBUG:
    SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
    SECURE_SSL_REDIRECT = True
    SECURE_HSTS_SECONDS = 31536000
    SECURE_HSTS_INCLUDE_SUBDOMAINS = True
    SECURE_HSTS_PRELOAD = True
    SESSION_COOKIE_SECURE = True
    CSRF_COOKIE_SECURE = True
