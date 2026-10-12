"""Produksi: container Docker di VPS, di belakang Caddy (TLS)."""
from django.core.exceptions import ImproperlyConfigured

from config.settings.base import *  # noqa: F403

DEBUG = False

if not SECRET_KEY:  # noqa: F405
    raise ImproperlyConfigured("DJANGO_SECRET_KEY wajib di-set di produksi.")
# Tanpa DATABASE_URL, base.py jatuh ke SQLite di dalam container dan seluruh
# data hilang saat container dibuat ulang. Lebih baik gagal saat boot.
if not env_str("DATABASE_URL"):  # noqa: F405
    raise ImproperlyConfigured("DATABASE_URL wajib di-set di produksi.")

# Penghitung throttle login/register dibagi antar worker gunicorn lewat tabel
# django_cache (dibuat `createcachetable` saat container mulai). Redis tidak
# dipakai demi menghemat RAM VPS.
CACHES = {
    "default": {
        "BACKEND": "django.core.cache.backends.db.DatabaseCache",
        "LOCATION": "django_cache",
    }
}

# API murni JSON: tanpa browsable API, jadi tidak perlu berkas statis.
REST_FRAMEWORK = {
    **REST_FRAMEWORK,  # noqa: F405
    "DEFAULT_RENDERER_CLASSES": ["rest_framework.renderers.JSONRenderer"],
}

# TLS diakhiri di Caddy, yang juga mengalihkan HTTP -> HTTPS. Django tidak
# ikut redirect: healthcheck Docker memanggil http://localhost langsung dan
# akan terpental 301 bila SECURE_SSL_REDIRECT aktif.
SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
SECURE_SSL_REDIRECT = False
SECURE_HSTS_SECONDS = env_int("SECURE_HSTS_SECONDS", 31536000)  # noqa: F405
SECURE_HSTS_INCLUDE_SUBDOMAINS = False
SECURE_CONTENT_TYPE_NOSNIFF = True
