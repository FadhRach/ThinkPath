"""Dev lokal: DEBUG aktif, SQLite bila DATABASE_URL kosong."""
from config.settings.base import *  # noqa: F403

DEBUG = True
SECRET_KEY = SECRET_KEY or "dev-secret-key-change-me"  # noqa: F405
CORS_ALLOWED_ORIGINS = env_list(  # noqa: F405
    "CORS_ALLOWED_ORIGINS", ["http://localhost:3000", "http://127.0.0.1:3000"]
)
