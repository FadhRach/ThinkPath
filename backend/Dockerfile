# Image API ThinkPath. Multi-stage: stage pertama memasang dependensi ke
# virtualenv, stage akhir hanya menyalin venv + kode. Tanpa apt-get dan tanpa
# compiler (psycopg[binary] sudah membawa libpq), jadi image tetap kecil.

FROM python:3.13-slim AS builder
ENV PIP_NO_CACHE_DIR=1 PIP_DISABLE_PIP_VERSION_CHECK=1
RUN python -m venv /opt/venv
COPY requirements/ /tmp/requirements/
RUN /opt/venv/bin/pip install -r /tmp/requirements/production.txt


FROM python:3.13-slim
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PATH=/opt/venv/bin:$PATH \
    DJANGO_SETTINGS_MODULE=config.settings.production

# Proses berjalan sebagai user tanpa hak root. Kode dimiliki root sehingga
# tidak bisa diubah oleh proses aplikasi.
RUN useradd --system --uid 10001 --no-create-home app
WORKDIR /app
COPY --from=builder /opt/venv /opt/venv
COPY . .

USER app
EXPOSE 8000

# Tanpa curl: Python sudah ada di image.
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
    CMD ["python", "-c", "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/health', timeout=4)"]

ENTRYPOINT ["sh", "deploy/entrypoint.sh"]
CMD ["gunicorn", "--config", "config/gunicorn.conf.py", "config.wsgi:application"]
