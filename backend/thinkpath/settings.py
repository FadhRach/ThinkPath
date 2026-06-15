"""Django settings untuk ThinkPath backend.

Catatan: Django ORM jadi satu-satunya jalur data; auth identitas tetap di Supabase
(verifikasi JWT lewat core.authentication.SupabaseJWTAuthentication).
"""
from __future__ import annotations

import os
from pathlib import Path

import dj_database_url
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


SECRET_KEY = os.getenv("DJANGO_SECRET_KEY", "dev-secret-key-change-me")
DEBUG = _env_bool("DJANGO_DEBUG", default=True)
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
    DATABASES = {
        "default": dj_database_url.parse(_database_url, conn_max_age=600),
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
        "core.authentication.SupabaseJWTAuthentication",
    ],
    "DEFAULT_PERMISSION_CLASSES": [
        "rest_framework.permissions.IsAuthenticated",
    ],
    "UNAUTHENTICATED_USER": None,
}

SUPABASE_JWT_SECRET = os.getenv("SUPABASE_JWT_SECRET", "")
SUPABASE_JWT_AUDIENCE = os.getenv("SUPABASE_JWT_AUDIENCE", "authenticated")
SUPABASE_JWT_ALGORITHM = "HS256"

CORS_ALLOWED_ORIGINS = _env_list(
    "CORS_ALLOWED_ORIGINS",
    ["http://localhost:3000"],
)
CORS_ALLOW_CREDENTIALS = True
