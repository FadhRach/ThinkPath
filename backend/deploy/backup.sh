#!/usr/bin/env bash
# pg_dump terkompresi ke backups/, simpan 7 hari. Cron VPS (02:00):
#   0 2 * * * /opt/thinkpath/backend/deploy/backup.sh >> /opt/thinkpath/backend/backups/backup.log 2>&1
set -euo pipefail  # pipefail: pg_dump gagal tidak boleh menghasilkan backup kosong

cd "$(dirname "$0")/.."
mkdir -p backups
file="backups/thinkpath-$(date +%Y%m%d-%H%M%S).sql.gz"

docker compose exec -T db sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --no-owner --clean --if-exists' \
    | gzip > "$file.tmp"
mv "$file.tmp" "$file"

find backups -name 'thinkpath-*.sql.gz' -mtime +7 -delete
echo "$(date -Is) backup OK: $file ($(du -h "$file" | cut -f1))"
