#!/usr/bin/env bash
# Menguji bahwa backup benar-benar bisa dipulihkan: memuat dump ke Postgres sementara
# (bukan basis data produksi) lalu menghitung baris tabel inti.
#   deploy/restore-test.sh                      # backup terbaru
#   deploy/restore-test.sh backups/<berkas>     # berkas tertentu
# Berkas .age memerlukan AGE_IDENTITY=<berkas kunci privat age>.
# Disarankan dijalankan sebulan sekali; backup yang tak pernah diuji belum bisa disebut backup.
set -euo pipefail

cd "$(dirname "$0")/.."
file="${1:-$(ls -t backups/thinkpath-*.sql.gz* 2>/dev/null | head -1)}"
[ -n "$file" ] && [ -f "$file" ] || { echo "Tidak ada berkas backup." >&2; exit 1; }

open() {
    case "$file" in
        *.age) age -d -i "${AGE_IDENTITY:?isi AGE_IDENTITY untuk membuka berkas .age}" "$file" | gunzip ;;
        *) gunzip -c "$file" ;;
    esac
}

name="thinkpath-restore-test-$$"
trap 'docker rm -f "$name" >/dev/null 2>&1 || true' EXIT
docker run -d --name "$name" -e POSTGRES_PASSWORD=uji -e POSTGRES_DB=uji postgres:17-alpine >/dev/null
until docker exec "$name" pg_isready -U postgres -d uji >/dev/null 2>&1; do sleep 1; done

open | docker exec -i "$name" psql -U postgres -d uji -v ON_ERROR_STOP=1 -q >/dev/null
for table in profiles classes submissions analysis_results; do
    count=$(docker exec "$name" psql -U postgres -d uji -tAc "SELECT count(*) FROM $table")
    echo "$table: $count baris"
done
echo "Pemulihan $file BERHASIL (basis data sementara dibuang)."
