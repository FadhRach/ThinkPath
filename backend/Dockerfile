FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends build-essential libpq-dev curl \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 7860

# --threads penting: analisis dijalankan sinkron di dalam request dan menunggu
# Groq. Dengan 2 worker tanpa thread, dua pengumpulan bersamaan membekukan
# seluruh aplikasi termasuk dashboard dosen. Menunggu jaringan itu IO, jadi
# thread menyelesaikannya tanpa menambah beban CPU.
# --timeout 60 memberi ruang di atas timeout Groq (12 detik) plus overhead.
CMD ["sh", "-c", "python manage.py migrate --noinput && gunicorn thinkpath.wsgi:application --bind 0.0.0.0:7860 --workers 2 --threads 4 --timeout 60"]
