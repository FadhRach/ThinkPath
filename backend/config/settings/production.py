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

# Penghitung throttle login/register disimpan di memori proses (bawaan
# LocMemCache), bukan di basis data: Kebijakan Privasi menjanjikan alamat IP
# tidak disimpan di DB. Dengan WEB_CONCURRENCY=1 hitungannya tepat; tiap
# worker tambahan menggandakan batas efektifnya.

REST_FRAMEWORK = {
    **REST_FRAMEWORK,  # noqa: F405
    # API murni JSON: tanpa browsable API, jadi tidak perlu berkas statis.
    "DEFAULT_RENDERER_CLASSES": ["rest_framework.renderers.JSONRenderer"],
    # Di belakang Caddy, REMOTE_ADDR selalu IP container Caddy. Tanpa ini
    # throttle login menghitung SEMUA pengguna sebagai satu IP. Dengan satu
    # proxy, IP klien asli adalah entri terakhir X-Forwarded-For.
    "NUM_PROXIES": env_int("NUM_PROXIES", 1),  # noqa: F405
}

# TLS diakhiri di Caddy, yang juga mengalihkan HTTP -> HTTPS. Django tidak
# ikut redirect: healthcheck Docker memanggil http://localhost langsung dan
# akan terpental 301 bila SECURE_SSL_REDIRECT aktif.
SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
SECURE_SSL_REDIRECT = False
SECURE_HSTS_SECONDS = env_int("SECURE_HSTS_SECONDS", 31536000)  # noqa: F405
SECURE_HSTS_INCLUDE_SUBDOMAINS = False
SECURE_CONTENT_TYPE_NOSNIFF = True

# Peringatan `check --deploy` yang memang tidak berlaku untuk API ini:
SILENCED_SYSTEM_CHECKS = [
    "security.W003",  # CSRF: auth lewat header Bearer, bukan cookie sesi
    "security.W008",  # SSL redirect dikerjakan Caddy (lihat di atas)
    "security.W005",  # HSTS includeSubDomains/preload: API hanya satu subdomain
    "security.W021",
]
