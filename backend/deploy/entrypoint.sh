#!/bin/sh
# Migrasi skema sebelum gunicorn mulai. Idempoten, aman di setiap start.
set -e

python manage.py migrate --noinput

exec "$@"
