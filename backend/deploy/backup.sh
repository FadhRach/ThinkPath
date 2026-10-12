#!/usr/bin/env bash
# Backup basis data: pg_dump terkompresi, simpan KEEP_DAYS hari terakhir.
# Cron VPS (setiap 02:00):
#   0 2 * * * /opt/thinkpath/backend/deploy/backup.sh >> /opt/thinkpath/backend/backups/backup.log 2>&1
set -euo pipefail

cd "$(dirname "$0")/.."
BACKUP_DIR="${BACKUP_DIR:-./backups}"
KEEP_DAYS="${KEEP_DAYS:-7}"
mkdir -p "$BACKUP_DIR"

file="$BACKUP_DIR/thinkpath-$(date +%Y%m%d-%H%M%S).sql.gz"
# pipefail: pg_dump yang gagal tidak boleh menghasilkan berkas kosong yang
# terlihat seperti backup sukses.
docker compose exec -T db sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --no-owner --clean --if-exists' \
    | gzip > "$file.tmp"
mv "$file.tmp" "$file"

find "$BACKUP_DIR" -name 'thinkpath-*.sql.gz' -mtime +"$KEEP_DAYS" -delete
echo "$(date -Is) backup OK: $file ($(du -h "$file" | cut -f1))"
