"""Produksi: container Docker di VPS, di belakang Caddy (TLS)."""
import os

from django.core.exceptions import ImproperlyConfigured

from config.settings.base import *  # noqa: F403

if not SECRET_KEY:  # noqa: F405
    raise ImproperlyConfigured("DJANGO_SECRET_KEY wajib diisi di .env produksi.")

# localhost dipakai healthcheck Docker di dalam container.
ALLOWED_HOSTS = [os.environ["API_DOMAIN"], "localhost", "127.0.0.1"]

# Di belakang Caddy, IP klien asli ada di X-Forwarded-For. Tanpa ini throttle
# login menghitung semua pengguna sebagai satu IP.
REST_FRAMEWORK = {**REST_FRAMEWORK, "NUM_PROXIES": 1}  # noqa: F405

# Caddy yang mengurus HTTPS + redirect. Django tidak ikut redirect, kalau ikut
# healthcheck internal (http://localhost) terpental 301.
SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
SECURE_SSL_REDIRECT = False
SECURE_HSTS_SECONDS = 31536000
SECURE_CONTENT_TYPE_NOSNIFF = True

SILENCED_SYSTEM_CHECKS = [
    "security.W003",  # CSRF: auth lewat header Bearer, bukan cookie
    "security.W008",  # redirect HTTPS dikerjakan Caddy
    "security.W005",  # HSTS subdomain: API hanya satu subdomain
    "security.W021",  # HSTS preload: sama
]
