FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

# Sengaja tanpa apt-get sama sekali.
#
# Sebelumnya baris ini memasang build-essential, libpq-dev, dan curl. Ketiganya
# tidak pernah terpakai: requirements.txt memakai psycopg[binary], yaitu wheel
# yang sudah terkompilasi lengkap dengan libpq bawaannya, dan delapan paket
# lainnya Python murni. curl dipasang tanpa satu pun HEALTHCHECK memakainya.
# Akibatnya seluruh perkakas kompiler diunduh untuk sesuatu yang tidak pernah
# dikompilasi, dan pada koneksi lambat langkah itu sendirian memakan lebih dari
# setengah jam.
#
# Kalau suatu saat psycopg[binary] diganti psycopg biasa, atau ada dependensi
# baru yang menuntut kompilasi, blok apt-get perlu dikembalikan bersama
# build-essential dan libpq-dev.

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
