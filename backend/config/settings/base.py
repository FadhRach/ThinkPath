"""Settings bersama. Lingkungan dipilih lewat DJANGO_SETTINGS_MODULE:
development (bawaan manage.py), production (container), test (dipaksa `manage.py test`).
"""
import os
from pathlib import Path

from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parents[2]  # backend/
load_dotenv(BASE_DIR / ".env")

DEBUG = False
SECRET_KEY = os.getenv("DJANGO_SECRET_KEY", "")
ALLOWED_HOSTS = ["localhost", "127.0.0.1"]

JWT_ISSUER = "thinkpath-api"
JWT_AUDIENCE = "thinkpath-web"

INSTALLED_APPS = [
    "rest_framework",
    "corsheaders",
    "apps.accounts",
    "apps.academics",
    "apps.analysis",
    "apps.notifications",
    "apps.cekpaham",
    "apps.forum",
    "apps.todos",
]

MIDDLEWARE = [
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.security.SecurityMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
    "common.middleware.NoStoreMiddleware",
]

ROOT_URLCONF = "config.urls"
WSGI_APPLICATION = "config.wsgi.application"

# Nama variabel sama dengan image Postgres resmi, jadi lokal dan produksi seragam.
# USER kosong = user OS; HOST kosong = socket lokal.
DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.postgresql",
        "HOST": os.getenv("POSTGRES_HOST", ""),
        "PORT": os.getenv("POSTGRES_PORT", "5432"),
        "NAME": os.getenv("POSTGRES_DB", "thinkpath"),
        "USER": os.getenv("POSTGRES_USER", ""),
        "PASSWORD": os.getenv("POSTGRES_PASSWORD", ""),
        "CONN_MAX_AGE": 60,
        "CONN_HEALTH_CHECKS": True,
    }
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
    "DEFAULT_THROTTLE_RATES": {
        "auth_register": "30/hour",
        "auth_login": "20/min",
        # Per akun, bukan per IP: menahan tebakan sandi terhadap satu email
        # dari banyak IP, tanpa mengunci IP kampus yang dipakai bersama.
        "auth_login_account": "10/min",
        # Tiap unggahan bisa memicu hingga 6 panggilan OCR berbayar ke Groq.
        "document_import": "30/hour",
        # Setiap pengumpulan memicu analisis berbayar (Winston + Groq); revisi
        # sebelum tenggat tetap leluasa, skrip pembakar kredit tidak.
        "submission_submit": "10/hour",
        "submission_reanalyze": "20/hour",
        # Saran AI untuk dosen: bisa memanggil Groq, jadi dibatasi seperti analisis ulang.
        "ai_suggestion": "40/hour",
        # Ruang kode kelas ±6e8; 10/menit membuat menebak tidak layak.
        "class_join": "10/min",
        # Penyimpanan otomatis berkala (debounce klien); jauh di atas pemakaian
        # sah, jauh di bawah skrip yang membanjiri tabel draf.
        "draft_save": "30/min",
        "password_change": "5/min",
        # Per IP; jeda 60 detik per akun ada di password_reset.py.
        "password_reset": "10/hour",
        "password_reset_confirm": "20/hour",
        "account_delete": "5/hour",
        "upload_ticket": "30/min",
        # Caption live (best-effort, satu potongan ~4 detik) dan finalisasi
        # (STT + penilai berbayar). Satu sesi sah jauh di bawah batas ini.
        "cekpaham_live": "40/min",
        "cekpaham_finalize": "30/hour",
        # Menulis topik/balasan forum dan butir to-do; jauh di atas pemakaian sah.
        "forum_write": "40/hour",
        "todo_write": "120/hour",
    },
}

# Produksi: False, analisis dikerjakan worker terpisah (run_analysis_worker).
# development.py dan test.py menyalakannya agar tidak butuh proses ketiga.
ANALYSIS_INLINE = False

AUTH_TOKEN_LIFETIME_DAYS = 7
# Tiket unggah: token pendek yang hanya berlaku di endpoint unggah/ambil berkas
# (fungsi Vercel membatasi badan permintaan 4,5 MB, sedangkan dokumen 10 MB).
UPLOAD_TICKET_SECONDS = 600

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator", "OPTIONS": {"min_length": 10}},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
    {
        "NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator",
        "OPTIONS": {"user_attributes": ("email", "display_name")},
    },
]

# Dokumen unggahan mahasiswa dan teks hasil OCR-nya (lihat services/documents.py).
MEDIA_ROOT = BASE_DIR / "data" / "media"

CORS_ALLOWED_ORIGINS = os.getenv(
    "CORS_ALLOWED_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000"
).split(",")
CORS_ALLOW_CREDENTIALS = True

# Email reset sandi lewat SMTP biasa (Brevo, Resend, Gmail, dll). EMAIL_HOST
# kosong = pesan dicetak ke log (cukup untuk dev dan demo tanpa penyedia email).
EMAIL_HOST = os.getenv("EMAIL_HOST", "")
EMAIL_PORT = 587
EMAIL_USE_TLS = True
EMAIL_HOST_USER = os.getenv("EMAIL_HOST_USER", "")
EMAIL_HOST_PASSWORD = os.getenv("EMAIL_HOST_PASSWORD", "")
EMAIL_TIMEOUT = 10
EMAIL_BACKEND = (
    "django.core.mail.backends.smtp.EmailBackend"
    if EMAIL_HOST
    else "django.core.mail.backends.console.EmailBackend"
)
DEFAULT_FROM_EMAIL = os.getenv("DEFAULT_FROM_EMAIL", "ThinkPath <noreply@thinkpath.local>")
# Tautan di email mengarah ke origin frontend pertama di CORS_ALLOWED_ORIGINS.
FRONTEND_URL = CORS_ALLOWED_ORIGINS[0]
PASSWORD_RESET_MINUTES = 30

LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "handlers": {"console": {"class": "logging.StreamHandler"}},
    "root": {"handlers": ["console"], "level": "INFO"},
    # Tanpa ini Django mengirim galat 500 ke email ADMINS, bukan ke log.
    "loggers": {"django.request": {"handlers": ["console"], "level": "ERROR", "propagate": False}},
}
