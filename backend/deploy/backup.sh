#!/usr/bin/env bash
# pg_dump + arsip dokumen unggahan ke backups/, simpan 7 hari. Cron VPS (02:00):
#   0 2 * * * /opt/thinkpath/backend/deploy/backup.sh >> /opt/thinkpath/backend/backups/backup.log 2>&1
#
# Opsional, diatur di .env (dibaca skrip ini):
#   BACKUP_AGE_RECIPIENT  kunci publik `age` (age-keygen): backup dienkripsi sebelum disimpan.
#   BACKUP_RCLONE_REMOTE  tujuan `rclone` di luar VPS (mis. r2:thinkpath-backups); WAJIB bersama
#                         BACKUP_AGE_RECIPIENT, karena berkas berisi data pribadi.
# Uji pemulihan: deploy/restore-test.sh
set -euo pipefail  # pipefail: pg_dump gagal tidak boleh menghasilkan backup kosong

cd "$(dirname "$0")/.."
# Dibaca dengan grep, bukan `source`: nilai lain di .env (DEFAULT_FROM_EMAIL) memuat spasi dan "<".
envval() { grep -E "^$1=" .env 2>/dev/null | tail -1 | cut -d= -f2- || true; }
recipient="${BACKUP_AGE_RECIPIENT:-$(envval BACKUP_AGE_RECIPIENT)}"
remote="${BACKUP_RCLONE_REMOTE:-$(envval BACKUP_RCLONE_REMOTE)}"
if [ -n "$remote" ] && [ -z "$recipient" ]; then
    echo "BACKUP_RCLONE_REMOTE diisi tetapi BACKUP_AGE_RECIPIENT kosong: menolak mengunggah data pribadi tanpa enkripsi." >&2
    exit 1
fi

# Meneruskan stdin ke stdout, terenkripsi bila kunci diberikan.
seal() { if [ -n "$recipient" ]; then age -r "$recipient"; else cat; fi; }
suffix=""; [ -n "$recipient" ] && suffix=".age"

mkdir -p backups
stamp="$(date +%Y%m%d-%H%M%S)"
file="backups/thinkpath-$stamp.sql.gz$suffix"
docker compose exec -T db sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --no-owner --clean --if-exists' \
    | gzip | seal > "$file.tmp"
mv "$file.tmp" "$file"

# Dokumen unggahan ada di volume, bukan di basis data.
media="backups/media-$stamp.tar.gz$suffix"
docker compose exec -T api tar -czf - -C /app/data media | seal > "$media.tmp"
mv "$media.tmp" "$media"

if [ -n "$remote" ]; then
    rclone copy "$file" "$remote" && rclone copy "$media" "$remote"
fi

find backups \( -name 'thinkpath-*.sql.gz*' -o -name 'media-*.tar.gz*' \) -mtime +7 -delete
echo "$(date -Is) backup OK: $file ($(du -h "$file" | cut -f1))${recipient:+, terenkripsi}${remote:+, diunggah ke $remote}"
