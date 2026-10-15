"""Lokal: runserver + Postgres lokal."""
from config.settings.base import *  # noqa: F403

DEBUG = True
SECRET_KEY = SECRET_KEY or "dev-secret-key"  # noqa: F405
