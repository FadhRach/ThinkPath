# ThinkPath — Backend

Django 5.2 LTS + Django REST Framework. **Satu-satunya API** untuk seluruh data ThinkPath (profil, kelas, tugas, submission, analisis). Frontend tidak pernah menyentuh database langsung.

> Panduan menyeluruh proyek ada di [README utama](../README.md). ERD dan kamus data: [diagram/08](../diagram/08-erd-basis-data.md).

---

## Menjalankan Lokal

```bash
python -m venv venv && source venv/bin/activate   # Windows: venv\Scripts\activate
pip install -r requirements/development.txt
cp .env.example .env             # isi minimal DJANGO_SECRET_KEY
make dev                         # migrate + runserver di :7860 (SQLite bila DATABASE_URL kosong)
python manage.py seed_demo_data  # akun + data demo (idempoten)
```

Cek: `curl http://localhost:7860/health` harus mengembalikan `{"status":"ok"}`.

**Akun demo** (password `thinkpath123`): `dosen@thinkpath.local` · `mhs01@thinkpath.local` s.d. `mhs08@thinkpath.local`

**Tes:**

```bash
make test                        # = python manage.py test
python manage.py test apps.analysis.tests.test_detector   # satu modul
```

`manage.py test` **selalu** memakai `config.settings.test` (SQLite in-memory) dan mengabaikan `DATABASE_URL` di `.env`. Dulu tes ikut memakai `DATABASE_URL` dan nyaris menghapus basis data test di server produksi; `common/tests.py` menjaga agar itu tidak terulang.

**Menguji susunan produksi di laptop** (Docker/OrbStack): isi `POSTGRES_PASSWORD` di `.env`, biarkan `API_DOMAIN=localhost`, lalu `make up && make seed`. API tersedia di `https://localhost` (sertifikat lokal Caddy, `curl -k`) dan langsung di `http://127.0.0.1:8000`. Untuk frontend lokal, pakai `NEXT_PUBLIC_BACKEND_URL=http://127.0.0.1:8000`.

---

## Struktur Proyek

```
backend/
├── config/                   # bukan app: settings, urls, wsgi, gunicorn
│   ├── settings/
│   │   ├── base.py           # bersama
│   │   ├── development.py    # bawaan manage.py
│   │   ├── production.py     # container Docker (DJANGO_SETTINGS_MODULE)
│   │   └── test.py           # dipaksa untuk `manage.py test`
│   └── gunicorn.conf.py
├── apps/
│   ├── accounts/             # Profile, ConsentRecord, JWT, privasi (UU PDP)
│   ├── academics/            # kelas, tugas, materi, pengumuman, submission, verifikasi
│   │   ├── views/            # satu modul per domain (classes, assignments, submissions, ...)
│   │   ├── selectors.py      # query baca + pemeriksaan kepemilikan
│   │   ├── services/         # alur tulis: submit/revisi/analisis ulang, join code
│   │   └── management/commands/seed_demo_data.py
│   ├── analysis/             # AnalysisResult, DetectorScore
│   │   ├── engines/          # mesin skor murni: ai_score, bloom, text_features, process_signals, heuristic
│   │   ├── providers/        # klien API luar: groq.py, winston.py
│   │   ├── insights/         # agregat dosen: overview, reports, cognitive
│   │   ├── pipeline.py       # run_analysis(): satu-satunya pintu analisis
│   │   └── detector_cache.py
│   └── notifications/
├── common/                   # helper lintas app: env, http, HealthView
├── requirements/{base,development,production}.txt
├── deploy/                   # Caddyfile, entrypoint.sh, backup.sh
├── Dockerfile  docker-compose.yml  Makefile
```

Aturan sederhananya: **view tipis** (HTTP saja) → baca lewat `selectors.py`, tulis lewat `services/`. Logika skor tidak pernah ada di view.

---

## Arsitektur

**Identitas dikelola sendiri.** Bukan `django.contrib.auth.User`, melainkan tabel `profiles` (`apps.accounts.models.Profile`) dengan password ter-hash. Login menerbitkan **JWT HS256** yang ditandatangani `DJANGO_SECRET_KEY`, berisi klaim `sub` (UUID profil), `email`, dan `role`. Verifikasi token murni di memori — nol query database per request. App bawaan `django.contrib.auth`/`contenttypes` tidak dipasang, jadi tidak ada tabel `auth_*`.

**Analisis dijalankan sinkron** saat submit lewat `apps.analysis.pipeline.run_analysis`:

```
Skor AI     : Winston (providers/winston.py) -> Groq (providers/groq.py) -> heuristik (engines/ai_score.py)
Level Bloom :                                   Groq                     -> heuristik (engines/bloom.py)
```

Kunci yang kosong atau API yang gagal cukup menjatuhkan ke lapisan berikutnya — tidak pernah menggagalkan pengumpulan tugas. **Level Bloom tidak pernah menyentuh detektor**, dan itu dijaga uji AST, bukan sekadar konvensi. Analisis dijalankan **sebelum** transaksi dibuka, jadi tidak ada baris yang terkunci selama menunggu API (~20 detik kasus terburuk).

Dua jebakan yang dikunci tes:

- **Winston mengembalikan _human score_** (0 = AI, 100 = manusia). Pembalikannya dikerjakan **tepat sekali** di `providers/winston.py`. Kalau hilang atau terjadi dua kali, mahasiswa yang menulis sendiri justru mendapat skor AI tertinggi — dan angkanya tetap terlihat masuk akal.
- **Detektor berbayar per kata**, jadi skornya disimpan di tabel `detector_scores` (`detector_cache.py`). Kunci cache memuat versi model, sehingga menaikkan versi otomatis membatalkan skor lama.

---

## Model Data

Diagram relasi, constraint, index, dan alasan normalisasi ada di [diagram/08-erd-basis-data.md](../diagram/08-erd-basis-data.md). Ringkasnya:

| App | Model → tabel |
|---|---|
| `accounts` | `Profile` → `profiles`, `ConsentRecord` → `consent_records` |
| `academics` | `Class` → `classes`, `ClassMembership` → `class_memberships`, `Assignment` → `assignments`, `Material` → `materials`, `Announcement` → `announcements`, `Submission` → `submissions`, `ReasoningEvent` → `reasoning_events`, `VerbalVerification` → `verbal_verifications` |
| `analysis` | `AnalysisResult` → `analysis_results`, `DetectorScore` → `detector_scores` |
| `notifications` | `Notification` → `notifications` |

Aturan penting dijaga **di basis data**, bukan hanya di serializer: satu submission per mahasiswa per tugas, email unik tanpa peduli huruf besar, rentang nilai/Bloom/semester, dan kesimpulan verifikasi hanya ada setelah sesi selesai. Jenjang, program studi, dan semester **melekat di kelas**, bukan di profil atau tugas.

Riwayat migrasi direset ke `0001_initial` per app saat pindah ke VPS (Oktober 2026, mulai dari DB bersih). Mulai sekarang migrasi ditambahkan seperti biasa (`makemigrations`), dan **tidak pernah** menyunting migrasi yang sudah diterapkan di produksi.

---

## Endpoint

Semua di bawah `/api` dan butuh `Authorization: Bearer <token>`, kecuali yang ditandai publik.

| Method | Path | Akses | Fungsi |
|---|---|---|---|
| GET | `/health` | publik | health check |
| POST | `/api/auth/register` | publik | daftar, balikan token + profil |
| POST | `/api/auth/login` | publik | login, balikan token + profil |
| GET/PATCH | `/api/me` | login | profil sendiri |
| GET/POST/PATCH | `/api/me/consent` | login | keadaan dan riwayat persetujuan / beri persetujuan (balikan token baru) / ubah izin analisis luar negeri |
| POST | `/api/me/consent/withdraw` | login | tarik persetujuan (balikan token tanpa klaim persetujuan) |
| GET/POST | `/api/classes` | dosen | daftar / buat kelas |
| GET/POST | `/api/classes/<id>/assignments` | dosen pemilik | daftar / buat tugas |
| GET | `/api/assignments` | dosen | seluruh tugas lintas kelas |
| GET/PATCH | `/api/assignments/<id>` | dosen pemilik | detail / edit tugas; target Bloom dikunci setelah ada pengumpulan |
| GET | `/api/classes/<id>/students` | dosen pemilik | seluruh anggota kelas beserta jumlah pengumpulan dan penilaian |
| GET/POST | `/api/classes/<id>/announcements` | GET pemilik/anggota, POST dosen pemilik | baca / terbitkan pengumuman dan kirim notifikasi mahasiswa |
| GET | `/api/submissions` | dosen | pengumpulan lintas kelas sendiri; filter `status=all`, `submitted`, atau `reviewed`; tanpa draf |
| GET | `/api/overview` | dosen | agregat layar Overview |
| GET | `/api/reports/overview` | dosen | laporan per kelas, prodi, semester |
| GET | `/api/students/<id>/profile` | dosen pengampu | profil kognitif mahasiswa |
| GET | `/api/verifications` | dosen | antrean verifikasi verbal |
| POST | `/api/join` | mahasiswa | gabung kelas via join code |
| GET | `/api/student/classes` | mahasiswa | kelas diikuti + status tiap tugas |
| GET | `/api/student/progress` | mahasiswa | perkembangan kognitif sendiri |
| GET | `/api/student/assignments/<id>` | mahasiswa anggota | detail tugas + submission sendiri |
| GET/POST | `/api/assignments/<id>/submissions` | GET dosen, POST mahasiswa | daftar / **submit atau revisi** |
| GET/PATCH | `/api/submissions/<id>` | dosen pemilik | detail / beri nilai + umpan balik |
| POST | `/api/submissions/<id>/reanalyze` | dosen pemilik | analisis ulang |
| PUT/DELETE | `/api/submissions/<id>/verification` | dosen pemilik | jadwalkan / catat / hapus verifikasi |
| GET/POST | `/api/classes/<id>/materials` | dosen pemilik | daftar / bagikan materi |
| PATCH/DELETE | `/api/materials/<id>` | dosen pemilik | ubah (tanpa notifikasi ulang) / hapus materi |
| GET | `/api/student/materials` | mahasiswa | materi dari seluruh kelas yang diikuti |
| GET | `/api/student/schedule` | mahasiswa | agenda yang akan datang; dengan `start` & `end`, seluruh agenda di rentang itu |
| GET | `/api/notifications` | login | 30 notifikasi terbaru + jumlah belum dibaca |
| POST | `/api/notifications/read` | login | tandai dibaca (`ids`, atau semua bila kosong) |

### Submit & revisi

`POST /api/assignments/<id>/submissions` bersifat **upsert per mahasiswa**:

- Submission pertama membuat baris baru (`revision_count = 0`). Body: `text_answer`, `started_at`, dan `progress` (cuplikan jumlah kata). Tindakan menempel tidak direkam; kolom `pastes` dari form lama diabaikan.
- Submission berikutnya, selama tenggat belum lewat dan belum dinilai, **memperbarui jawaban yang sama**: `revision_count += 1`, menambah `ReasoningEvent(revision)`, dan memicu analisis ulang yang **memakai ulang cuplikan tersimpan**. Jumlah revisi ditampilkan di bukti, tidak diskor.
- Setelah tenggat lewat atau setelah dinilai dosen, ditolak dengan `400`. Status "sudah dinilai" diperiksa ulang di dalam transaksi (`SELECT ... FOR UPDATE`), jadi nilai yang masuk selagi analisis revisi berjalan tetap menang.
- Klik ganda pada pengumpulan pertama: constraint `submission_unique_per_student` menolak baris kedua, dan permintaan itu dibalas `400`, bukan `500`.

**Skor AI dan sinyal tidak pernah diekspos ke mahasiswa** (`StudentSubmissionStatusSerializer`). Daftar tugas mahasiswa juga tidak mengirim `text_answer` demi menekan ukuran respons — teks lengkap hanya ada di endpoint detail.

### Materi dan jadwal

`topic` adalah teks bebas seperti topik Google Classroom, misalnya "Pertemuan 3: Desain kualitatif". Spasi berlebih dirapikan supaya satu topik tidak terpecah menjadi dua kelompok. Pengurutan dan pengelompokan dilakukan frontend (materi umum dulu, lalu urutan alami: Pertemuan 2 sebelum Pertemuan 10).

`GET /api/student/schedule?start=<ISO>&end=<ISO>` dipakai kalender. Kedua waktu wajib berzona, rentangnya paling panjang 62 hari (satu tampilan bulan paling banyak enam pekan). Batas hari dihitung frontend pada zona tampilan, jadi backend tetap tidak perlu tahu zona kampus. Rentang ini ikut memuat tenggat yang sudah lewat dan sesi yang sudah berlangsung (`status: "done"`, tanpa kesimpulannya); sesi yang dibatalkan tidak dimuat. Tiap agenda membawa `class_id` untuk saringan per kelas.

### Persetujuan data pribadi

Versi kebijakan yang berlaku ada di `apps/accounts/privacy.py` (`PRIVACY_POLICY_VERSION`) dan wajib sama dengan `frontend/lib/privacy.ts`; tes memeriksa keduanya. Frontend dan backend di-deploy terpisah, jadi setelah versi dinaikkan ada jeda sampai keduanya selesai deploy. Selama jeda itu, dan di tab yang dibuka sebelum deploy, layar persetujuan mengirim versi lama dan ditolak `400` dengan pesan untuk memuat ulang halaman. Muat ulang setelah kedua deploy berstatus Ready. Butir persetujuan dipisah per tujuan (Pasal 22 ayat (4) UU PDP): mahasiswa wajib `data_perkuliahan`, `analisis_proses`, `usia_atau_izin_wali`, dan boleh `analisis_luar_negeri`; dosen wajib `data_perkuliahan` dan `tanggung_jawab_dosen`.

Token memuat klaim `consent` berisi versi yang disetujui, dibaca layout frontend untuk gerbang tampilan. Pemrosesan baru tidak memercayai klaim itu: pengumpulan jawaban dan Analisis Ulang memeriksa `ConsentRecord` terbaru di basis data dan menolak dengan `403` bila persetujuan tidak berlaku, sehingga penarikan berlaku seketika meski token lama masih beredar. Tanpa butir `analisis_luar_negeri`, `run_analysis(allow_external=False)` melewati Groq, detektor, dan cache detektor (Pasal 56 ayat (4)). Pemetaan pasal lengkapnya ada di `diagram/07-privasi-dan-persetujuan.md`.

### Notifikasi

Dikirim setelah aksi utamanya tersimpan, dan kegagalannya tidak pernah menggagalkan aksi itu (`notifications.services.safe`). Pengumpulan untuk tugas yang sama digabung selama belum dibaca. Pengingat tenggat 24 jam dibuat saat mahasiswa membuka lonceng, bukan oleh penjadwal, karena backend tidak punya cron; tiap tugas hanya diingatkan sekali, dan constraint unik `notif_deadline_once` menjaganya walau dua permintaan lonceng tiba bersamaan. Notifikasi ke mahasiswa tidak pernah menyebut indikasi AI, termasuk undangan sesi diskusi. Notifikasi materi baru menaut langsung ke materinya (`/student/materi/<kelas>#materi-<id>`).

---

## Environment

Semua di `backend/.env` (templat: `.env.example`). Di Docker, `DATABASE_URL` dan `DJANGO_ALLOWED_HOSTS` dirakit `docker-compose.yml` sehingga tidak perlu diisi.

| Var | Wajib | Default | Keterangan |
|---|---|---|---|
| `DJANGO_SECRET_KEY` | ya (prod) | fallback dev | menandatangani JWT; produksi gagal boot bila kosong |
| `DJANGO_DEBUG` | – | `0` | hanya berlaku di dev; container selalu `False` |
| `DJANGO_ALLOWED_HOSTS` | dev | `localhost,127.0.0.1` | di Docker = `API_DOMAIN,localhost,127.0.0.1` |
| `CORS_ALLOWED_ORIGINS` | ya (prod) | `http://localhost:3000` | origin frontend, mis. `https://thinkpath.vercel.app` |
| `DATABASE_URL` | – | SQLite | dev saja; Docker merakitnya dari `POSTGRES_*` |
| `DB_CONN_MAX_AGE` | – | `60` | umur koneksi persisten (detik) |
| `GROQ_API_KEY` / `GROQ_MODEL` | – | kosong / `llama-3.3-70b-versatile` | kosong = heuristik |
| `WINSTON_API_KEY` | – | kosong | detektor eksternal, skor AI saja |
| `AUTH_TOKEN_LIFETIME_DAYS` | – | `7` | umur token |
| `POSTGRES_DB` / `POSTGRES_USER` | – | `thinkpath` | Docker |
| `POSTGRES_PASSWORD` | ya (Docker) | – | aman-URL saja: `openssl rand -hex 24` |
| `API_DOMAIN` | ya (VPS) | `localhost` | subdomain API untuk Caddy (HTTPS) |
| `API_HOST_PORT` | – | `8000` | port loopback untuk akses langsung tanpa Caddy |
| `WEB_CONCURRENCY` / `GUNICORN_THREADS` | – | `1` / `8` | proses x thread gunicorn |
| `NUM_PROXIES` | – | `1` | jumlah proxy di depan Django (Caddy) untuk membaca IP klien |
| `LOG_LEVEL` | – | `INFO` | |

---

## Deploy produksi (VPS)

Contoh di bawah memakai `api.thinkpath.id`; ganti dengan subdomain Anda.

Susunan: **VPS Ubuntu 1 GB RAM (IDCloudHost, Jakarta)** → Docker Compose berisi `caddy` (80/443, HTTPS otomatis) → `api` (gunicorn 1 worker × 8 thread) → `db` (PostgreSQL 17, tanpa port publik). Frontend tetap di Vercel. Batas RAM per container: db 320 MB, api 320 MB, caddy 64 MB.

### 1. Siapkan server (sekali)

```bash
# sebagai root / sudo
apt update && apt upgrade -y
adduser deploy && usermod -aG sudo deploy        # jangan deploy sebagai root

# swap 2 GB: wajib di RAM 1 GB supaya build image / lonjakan tidak memicu OOM
fallocate -l 2G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile
echo '/swapfile none swap sw 0 0' >> /etc/fstab
sysctl vm.swappiness=10 && echo 'vm.swappiness=10' >> /etc/sysctl.conf

# firewall: hanya SSH, HTTP, HTTPS
ufw allow OpenSSH && ufw allow 80/tcp && ufw allow 443/tcp && ufw allow 443/udp && ufw enable

# Docker Engine + compose plugin (repo resmi Docker)
curl -fsSL https://get.docker.com | sh
usermod -aG docker deploy
```

Docker mem-bypass UFW untuk port yang di-*publish*. Karena itu compose hanya mem-publish 80/443 (Caddy), dan port API terikat ke `127.0.0.1`. Postgres tidak di-publish sama sekali.

### 2. DNS

Buat **A record** subdomain API (mis. `api.thinkpath.id`) ke IP VPS. Tunggu sampai `dig +short api.thinkpath.id` mengembalikan IP VPS **sebelum** menyalakan Caddy; tanpa itu Let's Encrypt gagal dan Caddy mencoba ulang dengan jeda makin panjang.

### 3. Kode dan `.env`

```bash
# sebagai user deploy
sudo mkdir -p /opt/thinkpath && sudo chown deploy: /opt/thinkpath
git clone <url-repo> /opt/thinkpath && cd /opt/thinkpath/backend
cp .env.example .env && nano .env
```

Isi minimal di `.env` produksi:

```
DJANGO_SECRET_KEY=<python -c "import secrets; print(secrets.token_urlsafe(50))">
CORS_ALLOWED_ORIGINS=https://thinkpath.vercel.app
POSTGRES_PASSWORD=<openssl rand -hex 24>
API_DOMAIN=api.thinkpath.id
GROQ_API_KEY=...
WINSTON_API_KEY=...
```

`chmod 600 .env`. Jangan pernah commit berkas ini.

### 4. Jalankan

```bash
make up          # build image + start db, api, caddy (migrasi jalan otomatis)
make ps          # ketiganya harus "healthy"
make seed        # opsional: akun demo
curl https://api.thinkpath.id/health   # {"status":"ok"}
```

### 5. Arahkan frontend

Di proyek Vercel frontend, set `NEXT_PUBLIC_BACKEND_URL=https://api.thinkpath.id` lalu **redeploy** (nilai `NEXT_PUBLIC_*` ditanam saat build). Kebijakan Privasi versi `2026-10-12` sudah menyebut server di Jakarta; frontend dan backend harus sama-sama terdeploy agar versi kebijakan cocok (selama jeda, layar persetujuan menolak dengan pesan muat ulang).

Domain API sudah diketahui sejak awal, jadi tidak ada lagi urutan melingkar CORS ↔ URL backend seperti di Vercel: isi `CORS_ALLOWED_ORIGINS` dan `NEXT_PUBLIC_BACKEND_URL` sekaligus. Kalau CORS lupa diisi, gejalanya halaman termuat tetapi semua data kosong.

### 6. Backup harian

```bash
mkdir -p /opt/thinkpath/backend/backups
crontab -e
# 0 2 * * * /opt/thinkpath/backend/deploy/backup.sh >> /opt/thinkpath/backend/backups/backup.log 2>&1
```

`backup.sh` menyimpan `pg_dump` terkompresi 7 hari terakhir di `backups/`. Backup di disk yang sama dengan DB **bukan** cadangan bencana: salin berkala ke luar VPS (mis. `rsync` ke laptop atau object storage).

---

## Operasional

| Kebutuhan | Perintah (dari `backend/`) |
|---|---|
| Rilis kode baru | `make deploy` (git pull → build → up → prune image lama) |
| Lihat log API | `make logs` (log dirotasi 3 × 10 MB per container) |
| Status & health | `make ps`, `docker stats --no-stream` |
| Django shell / psql | `make shell`, `make psql` |
| Backup manual | `make backup` |
| Pulihkan backup | `make restore FILE=backups/thinkpath-YYYYMMDD-HHMMSS.sql.gz` |
| Bersihkan disk | `make prune` |

**Rollback rilis:** `git checkout <commit-sebelumnya> && docker compose up -d --build`. Bila rilis itu membawa migrasi yang mengubah skema, pulihkan juga backup yang dibuat sebelum rilis.

**Migrasi** berjalan otomatis setiap container `api` mulai (`deploy/entrypoint.sh`). Migrasi yang menghapus atau mengganti nama kolom tetap harus dua langkah: rilis dulu kode yang tidak lagi memakai kolom itu, baru rilis migrasinya.

**Catatan yang diketahui:** analisis berjalan sinkron di dalam request (±20 detik kasus terburuk: Winston 8 s + Groq 12 s). Satu worker × 8 thread menampung itu tanpa membekukan dashboard; kalau banyak mahasiswa mengumpulkan bersamaan dalam satu menit, naikkan `GUNICORN_THREADS` sebelum menambah worker. Memindahkannya ke background job masih pekerjaan berikutnya.

**Throttle login** (20/menit, daftar 30/jam per IP) disimpan di memori proses API, bukan di DB, sesuai Kebijakan Privasi. Dengan `WEB_CONCURRENCY=1` hitungannya tepat; tiap worker tambahan menggandakan batas efektifnya, dan restart container mengenolkannya.
