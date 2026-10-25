#!/usr/bin/env bash
# Pembersihan harian di VPS: berkas yatim, baris lama, dan audio Cek Paham > 30 hari.
# Cron (03:00, setelah backup 02:00):
#   0 3 * * * /opt/thinkpath/backend/deploy/maintenance.sh >> /opt/thinkpath/backend/backups/maintenance.log 2>&1
set -euo pipefail

cd "$(dirname "$0")/.."
echo "$(date -Is) maintenance mulai"
docker compose exec -T api python manage.py purge_stale_data
docker compose exec -T api python manage.py purge_cekpaham_audio
echo "$(date -Is) maintenance selesai"
