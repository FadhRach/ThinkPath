#!/bin/sh
# Disiapkan sebelum gunicorn mulai: migrasi skema dan tabel cache throttle.
# Keduanya idempoten, aman dijalankan di setiap start container.
set -e

python manage.py migrate --noinput
python manage.py createcachetable

exec "$@"
