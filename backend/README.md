# ThinkPath — Backend

Django 5.2 LTS + DRF. **Satu-satunya API** untuk seluruh data; frontend (Next.js di Vercel) tidak pernah menyentuh database.
Rumus skor AI dan Bloom: [apps/analysis/README.md](apps/analysis/README.md). ERD: [diagram/08](../diagram/08-erd-basis-data.md).

| | **Lokal** | **Produksi (VPS)** |
|---|---|---|
| Server | `manage.py runserver` | gunicorn di belakang Caddy (HTTPS) |
| Database | PostgreSQL di laptop | PostgreSQL 17 di container `db` |
| Templat `.env` | `.env.example` | `.env.production.example` |
| URL API | `http://127.0.0.1:7860` | `https://api.thinkpath.id` |

Produksi = empat container di satu VPS (IDCloudHost, Jakarta):

```
Internet ──HTTPS──> caddy ──HTTP──> api (gunicorn + Django) ──> db (PostgreSQL 17)
                    :80/:443        jaringan Docker saja         127.0.0.1:5433 (SSH tunnel)
                                    worker (run_analysis_worker) ──┘
```

- **api**: gunicorn 1 worker × 8 thread; submit hanya menyimpan, tidak menunggu Groq/Winston.
- **worker**: `manage.py run_analysis_worker` (3 thread) mengerjakan antrean `analysis_jobs`.
- **caddy**: HTTPS otomatis (Let's Encrypt), redirect, kompresi.
- **db**: volume `thinkpath_pgdata`; hanya `docker compose down -v` yang menghapusnya.

---

## Menjalankan di lokal

Prasyarat: **Python 3.12+** dan **PostgreSQL 15+**.

| OS | Siapkan database `thinkpath` |
|---|---|
| macOS | `brew install postgresql@18 && brew services start postgresql@18 && createdb thinkpath` |
| Linux (Ubuntu) | `sudo apt install postgresql && sudo -u postgres createuser -s $USER && createdb thinkpath` |
| Windows | Pasang dari [postgresql.org](https://www.postgresql.org/download/windows/), lalu `createdb -U postgres thinkpath` |

```bash
cd backend
python3 -m venv venv && source venv/bin/activate   # Windows: py -m venv venv; venv\Scripts\Activate.ps1
pip install -r requirements.txt
cp .env.example .env                               # Windows: copy; isi POSTGRES_USER=postgres + password
python manage.py migrate
python manage.py seed_demo_data                    # akun + data demo, aman diulang
python manage.py runserver 127.0.0.1:7860          # atau: make dev (migrate + runserver)
```

Di macOS/Linux `POSTGRES_USER`/`POSTGRES_PASSWORD` boleh kosong (user OS). Cek: `http://127.0.0.1:7860/health` → `{"status":"ok"}`.
Frontend: `frontend/` dengan `NEXT_PUBLIC_BACKEND_URL=http://127.0.0.1:7860`. DB lewat GUI: `127.0.0.1:5432`, database `thinkpath`.

**Akun demo** (password `thinkpath123`): `dosen@thinkpath.local` (3 kelas), `dosen2@thinkpath.local` (Business Creation), `mhs01`…`mhs20@thinkpath.local`. Katalog di `apps/academics/demo/`.

### Tes

```bash
make test                                                # semua tes
python manage.py test apps.analysis.tests.test_detector  # satu modul
```

`manage.py test` **selalu** memakai `config.settings.test` (SQLite in-memory) dan mengabaikan `POSTGRES_*`; dijaga `common/tests.py`.

### Mencoba stack produksi di Mac (OrbStack / Docker Desktop)

`.env` tetap untuk runserver; Docker di Mac membaca `.env.docker`.

```bash
cd backend
cp .env.production.example .env.docker
# isi DJANGO_SECRET_KEY, POSTGRES_PASSWORD, lalu:
#   API_DOMAIN=http://localhost        (HTTP biasa: sertifikat lokal Caddy tidak dipercaya Node.js)
#   CORS_ALLOWED_ORIGINS=http://localhost:3000,http://127.0.0.1:3000
make up && make ps && make seed
curl http://localhost/health
```

Frontend: `NEXT_PUBLIC_BACKEND_URL=http://localhost npm run dev`. DB: `make psql` atau GUI `127.0.0.1:5433`. Selesai: `make down` (data tetap) atau `docker compose --env-file .env.docker down -v`.

---

## Deploy produksi (VPS)

Ringkasnya: siapkan server sekali, arahkan DNS, isi `.env`, lalu `make up`. Contoh memakai `api.thinkpath.id`; ganti dengan subdomain Anda.

**1. Siapkan server (sekali, Ubuntu, sebagai root)**

```bash
apt update && apt upgrade -y && apt install -y git make
adduser deploy && usermod -aG sudo deploy        # jangan menjalankan aplikasi sebagai root

# swap 2 GB: wajib di RAM 1 GB supaya build image tidak kehabisan memori
fallocate -l 2G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile
echo '/swapfile none swap sw 0 0' >> /etc/fstab

# firewall: hanya SSH, HTTP, HTTPS
ufw allow OpenSSH && ufw allow 80/tcp && ufw allow 443/tcp && ufw allow 443/udp && ufw enable

# Docker Engine + compose
curl -fsSL https://get.docker.com | sh
usermod -aG docker deploy
```

Di panel IDCloudHost, pastikan firewall jaringan (bila dipakai) juga membuka port 22, 80, dan 443. UFW di dalam VPS saja tidak cukup bila panel menutupnya.

**2. DNS**: buat *A record* `api.thinkpath.id` → IP VPS. Tunggu sampai `dig +short api.thinkpath.id` menampilkan IP VPS, karena Caddy butuh itu untuk mengambil sertifikat HTTPS.

**3. Kode dan `.env` (login sebagai `deploy`)**

```bash
sudo mkdir -p /opt/thinkpath && sudo chown deploy: /opt/thinkpath
git clone <url-repo> /opt/thinkpath && cd /opt/thinkpath/backend
cp .env.production.example .env && chmod 600 .env && nano .env
```

Isi `DJANGO_SECRET_KEY`, `POSTGRES_PASSWORD`, `API_DOMAIN`, `CORS_ALLOWED_ORIGINS`, dan key analisis. Cara membuat nilai acaknya tertulis di komentar templat.

**4. Nyalakan**

```bash
make up                                  # build + start; migrasi jalan otomatis
make ps                                  # db & api "healthy"
make seed                                # opsional: akun demo
curl https://api.thinkpath.id/health     # {"status":"ok"}
```

**5. Frontend**: kode frontend di `main` harus memuat Kebijakan Privasi versi yang sama dengan backend (`2026-10-26`); bila belum, layar persetujuan menolak semua login. Jadi deploy backend dan frontend dari commit yang sama, berdekatan. Di proyek Vercel, set `NEXT_PUBLIC_BACKEND_URL=https://api.thinkpath.id` lalu **Redeploy** (nilai `NEXT_PUBLIC_*` ditanam saat build).

**6. Backup harian**

```bash
crontab -e
# tambahkan:
0 2 * * * /opt/thinkpath/backend/deploy/backup.sh >> /opt/thinkpath/backend/backups/backup.log 2>&1
```

Backup disimpan 7 hari di `backups/`. Backup di disk yang sama tidak menolong bila VPS-nya rusak, jadi isi di `.env` (lihat `.env.production.example`):

- `BACKUP_AGE_RECIPIENT`: kunci publik [age](https://age-encryption.org) (`age-keygen`); backup dienkripsi sebelum ditulis. Simpan kunci privatnya di luar VPS.
- `BACKUP_RCLONE_REMOTE`: tujuan [rclone](https://rclone.org) di luar VPS (mis. bucket R2/B2). Skrip menolak mengunggah bila kunci age kosong, karena backup berisi data pribadi.

Uji pemulihan sebulan sekali: `deploy/restore-test.sh` memuat backup terbaru ke Postgres sementara dan menghitung baris tabel inti (berkas `.age` butuh `AGE_IDENTITY=<kunci privat>`). Jalur enkripsi dan unggah belum pernah dijalankan di VPS sungguhan.

**7. Email reset sandi (opsional)**: isi `EMAIL_HOST`, `EMAIL_HOST_USER`, `EMAIL_HOST_PASSWORD`, `DEFAULT_FROM_EMAIL` di `.env` (SMTP biasa, port 587 + STARTTLS). Kosong = tautan reset hanya tercetak di log container `api`, cukup untuk demo. Tautan mengarah ke origin pertama `CORS_ALLOWED_ORIGINS`.

### Sehari-hari di VPS

| Kebutuhan | Perintah (dari `/opt/thinkpath/backend`) |
|---|---|
| Rilis kode baru dari `main` | `make deploy` (pull → build → up → hapus image lama) |
| Log API | `make logs` |
| Status, RAM | `make ps`, `docker stats --no-stream` |
| Masuk database | `make psql` |
| Database lewat GUI di laptop | `ssh -L 5433:127.0.0.1:5433 deploy@<ip-vps>`, lalu GUI ke `127.0.0.1:5433`, user/db `thinkpath`, password dari `.env` |
| Backup / pulihkan | `make backup` / `make restore FILE=backups/<berkas>.sql.gz` |
| Rollback | `git checkout <commit-lama> && make up` (+ `make restore` bila rilisnya mengubah skema) |
| Bersihkan disk | `make prune` |

Hal yang perlu diingat:

- **Migrasi otomatis** setiap container `api` mulai. Menghapus atau mengganti nama kolom tetap harus dua rilis: rilis kode yang tidak lagi memakai kolom itu dulu, baru rilis migrasinya.
- **Batas RAM**: db 320 MB, api 320 MB, worker 160 MB, caddy 64 MB. Saat diam totalnya sekitar 120 MB. Jika banyak mahasiswa mengumpulkan bersamaan, naikkan `threads` di `config/gunicorn.conf.py`, bukan `workers`.
- **Throttle login** (20/menit per IP) disimpan di memori proses, bukan di DB, sesuai Kebijakan Privasi. Restart container mengenolkannya.
- **Port**: hanya 80/443 yang publik. Postgres terikat ke `127.0.0.1:5433`, jadi hanya bisa dibuka lewat SSH tunnel. Docker melewati UFW untuk port yang dipublikasikan, jadi jangan pernah mengubahnya ke `0.0.0.0`.

---

## Struktur dan arsitektur

```
backend/
├── config/            settings/{base,development,production,test}.py, urls, wsgi, gunicorn.conf.py
├── apps/
│   ├── accounts/      Profile, ConsentRecord, JWT, privasi (UU PDP)
│   ├── academics/     kelas, tugas, materi, submission; views/ (HTTP saja), selectors.py (baca), services/ (tulis)
│   ├── analysis/      engines/ (skor murni), providers/ (groq, winston), insights/, pipeline.py, detector_cache.py
│   ├── cekpaham/      tes lisan
│   └── forum/ todos/ notifications/
├── common/            helper http, HealthView, throttling
├── deploy/            Caddyfile, entrypoint.sh, backup.sh, maintenance.sh
└── Dockerfile  docker-compose.yml  Makefile  requirements.txt
```

- **Identitas sendiri**: tabel `profiles` dengan password ter-hash (tanpa `django.contrib.auth`). Login menerbitkan **JWT HS256** (`DJANGO_SECRET_KEY`) berisi `sub`, `email`, `role`, `consent`, `sid`.
- **Analisis** di worker lewat `apps.analysis.pipeline.run_analysis`. Skor AI: Winston → heuristik (Groq tidak memberi skor AI). Bloom: Groq → heuristik. Ambang band: heuristik 42/70, Winston 35/70. API gagal/kunci kosong = jatuh ke lapis berikutnya. **Bloom tidak pernah menyentuh detektor** (uji AST).
- Jebakan yang dikunci tes: **Winston mengembalikan _human score_** (0 = AI), dibalik **tepat sekali** di `providers/winston.py`; **detektor ditagih per kata**, skornya di-cache di `detector_scores` dengan kunci memuat versi model.

### Model data

| App | Model → tabel |
|---|---|
| `accounts` | `Profile` → `profiles`, `ConsentRecord` → `consent_records` |
| `academics` | `Class` → `classes`, `ClassMembership` → `class_memberships`, `Assignment` → `assignments`, `Material` → `materials`, `Submission` → `submissions`, `ReasoningEvent` → `reasoning_events` |
| `analysis` | `AnalysisResult` → `analysis_results`, `DetectorScore` → `detector_scores` |
| `forum` | `ForumPost` → `forum_posts` (kind `announcement`/`discussion`), `ForumReply` → `forum_replies` |
| `todos` | `StudentTodo` → `student_todos` |
| `notifications` | `Notification` → `notifications` |

Dijaga **di basis data**: satu submission per mahasiswa per tugas, email unik tanpa peduli huruf besar, rentang nilai/Bloom/semester, satu Cek Paham aktif per submission. Jenjang, prodi, semester melekat di **kelas**. Migrasi direset ke `0001_initial` per app (Oktober 2026); sejak itu tambah migrasi biasa dan **jangan pernah** menyunting migrasi yang sudah diterapkan.

---

## Endpoint

Semua di bawah `/api` dan butuh `Authorization: Bearer <token>`, kecuali yang ditandai publik.

| Method | Path | Akses | Fungsi |
|---|---|---|---|
| GET | `/health` | publik | health check |
| POST | `/api/auth/register` | publik | daftar (wajib `accept_policy: true` + `policy_version` berlaku; persetujuan dicatat di transaksi yang sama), balikan token + profil |
| POST | `/api/auth/login` | publik | login (throttle per IP dan per email), balikan token + profil |
| POST | `/api/auth/logout` | login | cabut sesi ini di server; token langsung tidak berlaku |
| POST | `/api/auth/upload-ticket` | login | tiket 10 menit untuk unggah/ambil berkas besar langsung ke API (lihat "Sesi, token, dan akses") |
| POST | `/api/auth/password-reset` | publik | minta tautan atur ulang sandi (`email`); selalu 202, ada atau tidaknya akun tidak terlihat; 10/jam per IP, jeda 60 detik per akun |
| POST | `/api/auth/password-reset/confirm` | publik | pasang sandi baru (`token`, `new_password`); tautan sekali pakai, berlaku 30 menit, mencabut semua sesi |
| POST | `/api/me/password` | login | ganti kata sandi (`current_password`, `new_password`); sesi lain dicabut |
| GET | `/api/me/deletion-impact` | login | hitungan yang ikut hilang bila akun dihapus |
| DELETE | `/api/me` | login | **hapus akun beserta semua datanya dan berkasnya** (`password`, `confirm: "HAPUS"`); 204 |
| GET/PATCH | `/api/me` | login | profil sendiri |
| GET/POST | `/api/me/consent` | login | keadaan dan riwayat persetujuan / setujui ulang versi berlaku, body `{policy_version}` (butir dari peran; balikan token baru) |
| POST | `/api/me/consent/withdraw` | login | tarik persetujuan (balikan token tanpa klaim persetujuan) |
| GET/POST | `/api/classes` | dosen | daftar / buat kelas |
| GET/POST | `/api/classes/<id>/assignments` | dosen pemilik | daftar / buat tugas |
| GET | `/api/assignments` | dosen | seluruh tugas lintas kelas |
| GET/PATCH | `/api/assignments/<id>` | dosen pemilik | detail / edit tugas; target Bloom dikunci setelah ada pengumpulan |
| GET | `/api/classes/<id>/students` | dosen pemilik | seluruh anggota kelas beserta jumlah pengumpulan dan penilaian |
| GET | `/api/classes/<id>/people` | mahasiswa anggota | dosen dan teman sekelas, hanya nama tampil (tanpa email; akun tanpa nama diberi nama umum); non-anggota 404 |
| GET/POST | `/api/classes/<id>/forum` | GET pemilik/anggota, POST pemilik/anggota (kind `announcement` hanya dosen pemilik) | daftar topik (pengumuman di atas) / buat topik; memicu notifikasi `forum_post_new`; ditolak di kelas arsip |
| GET | `/api/student/forum/recent?limit=` | mahasiswa | aktivitas forum terbaru lintas kelas (maks 20) |
| GET/DELETE | `/api/forum/posts/<id>` | pemilik/anggota; hapus oleh penulis atau dosen pemilik | topik beserta balasan / hapus |
| POST | `/api/forum/posts/<id>/replies` | pemilik/anggota | balas topik; notifikasi `forum_reply_new` |
| DELETE | `/api/forum/replies/<id>` | penulis atau dosen pemilik | hapus balasan |
| GET/POST | `/api/student/todos` | mahasiswa | to-do pribadi (maks 100 yang belum selesai) |
| PATCH/DELETE | `/api/student/todos/<id>` | pemilik item | centang/ubah / hapus; item orang lain 404 |
| GET | `/api/submissions` | dosen | pengumpulan lintas kelas sendiri; filter `status=all`, `submitted`, atau `reviewed`; `limit` (bawaan 200, maks 2000) dan `offset`; total di header `X-Total-Count`; tanpa draf |
| GET | `/api/overview` | dosen | agregat layar Overview |
| GET | `/api/reports/overview` | dosen | laporan per kelas, prodi, semester |
| GET | `/api/students/<id>/profile` | dosen pengampu | profil kognitif mahasiswa |
| POST | `/api/join` | mahasiswa | gabung kelas via join code |
| GET | `/api/student/classes` | mahasiswa | kelas diikuti + status tiap tugas |
| GET | `/api/student/progress` | mahasiswa | perkembangan kognitif sendiri |
| GET | `/api/student/assignments/<id>` | mahasiswa anggota | detail tugas + submission sendiri |
| PUT | `/api/assignments/<id>/draft` | mahasiswa anggota | simpan otomatis draf (`rich_answer` dokumen editor, atau `text_answer` teks polos); **server mencatat waktu mulai dan kurva kata**; baru mulai pada simpan pertama yang berisi teks |
| GET/POST | `/api/assignments/<id>/submissions` | GET dosen, POST mahasiswa | daftar / **submit atau revisi** (hanya menyimpan, analisis dikerjakan worker) |
| POST | `/api/assignments/<id>/documents` | mahasiswa anggota | unggah PDF/DOCX/PNG/JPG (maks 10 MB, multipart `file`); membalas teks hasil baca |
| GET/PATCH | `/api/submissions/<id>` | dosen pemilik | detail / beri nilai + umpan balik; detail memuat `style_markers` (penanda gaya teks, bukan bagian skor AI) dan `similar_submissions` (irisan 5 kata berurutan dengan jawaban lain di tugas yang sama, maks. 5); `assignment` memuat `instructions`/`instructions_rich` |
| POST | `/api/submissions/<id>/reanalyze` | dosen pemilik | antrekan analisis ulang; **202** + `analysis_state` |
| GET | `/api/submissions/<id>/compare/<other_id>` | dosen pemilik | dua jawaban pada tugas yang sama berdampingan; `spans` = potongan lima kata yang sama persis di tiap sisi |
| POST | `/api/submissions/<id>/suggestion` | dosen pemilik | saran satu klik (baik / tinjau / perlu Cek Paham / bandingkan). **409** sampai analisis selesai. Aturan lokal selalu jalan; narasi Groq hanya bila mahasiswa menyetujui analisis luar negeri. Throttle `ai_suggestion` 40/jam |
| GET/POST | `/api/submissions/<id>/cekpaham` | dosen pemilik | daftar / **minta Cek Paham** (soal, bahasa, durasi 15–300 dtk, jendela waktu) |
| GET | `/api/cekpaham` | dosen | antrean; filter `status`, `phase` (`upcoming`/`open`/`closed`), `has_open_report` |
| GET | `/api/cekpaham/<id>` | dosen pemilik | detail: transkrip, saran skor, bukti, flag, konteks sesi, laporan |
| POST | `/api/cekpaham/<id>/cancel` | dosen pemilik | batalkan |
| GET | `/api/cekpaham/<id>/attempts/<n>/audio` | dosen pemilik | audio jawaban (`Cache-Control: private, no-store`) |
| POST | `/api/cekpaham/<id>/attempts/<n>/reprocess` | dosen pemilik | ulangi STT + penilai bila gagal atau macet |
| POST | `/api/cekpaham/reports/<id>/resolve` | dosen pemilik | `dismissed` atau `grant_retry` |
| GET | `/api/student/cekpaham/<id>` | mahasiswa penerima | metadata netral; **tanpa soal dan tanpa skor** |
| POST | `/api/student/cekpaham/<id>/start` | mahasiswa penerima | mulai sesi; satu-satunya tempat soal keluar |
| POST | `/api/student/cekpaham/<id>/live` | mahasiswa penerima | caption sementara dari satu potongan audio (`audio`, `purpose`) |
| POST | `/api/student/cekpaham/<id>/finalize` | mahasiswa penerima | audio utuh + konteks; membalas `state` dan transkripnya sendiri |
| POST | `/api/student/cekpaham/<id>/report` | mahasiswa penerima | lapor transkrip salah / mikrofon bermasalah |
| GET/POST | `/api/classes/<id>/materials` | dosen pemilik | daftar / bagikan materi |
| PATCH/DELETE | `/api/materials/<id>` | dosen pemilik | ubah (tanpa notifikasi ulang) / hapus materi |
| GET | `/api/student/materials` | mahasiswa | materi dari seluruh kelas yang diikuti |
| GET | `/api/student/schedule` | mahasiswa | agenda yang akan datang; dengan `start` & `end`, seluruh agenda di rentang itu |
| GET | `/api/notifications` | login | 30 notifikasi terbaru + jumlah belum dibaca |
| POST | `/api/notifications/read` | login | tandai dibaca (`ids`, atau semua bila kosong) |

### Draf, submit, dan revisi

- Bukti proses **dicatat server**: `PUT /api/assignments/<id>/draft` membuat draf pada simpan pertama yang berisi teks (`started_at` = jam server), lalu satu cuplikan jumlah kata paling sering tiap 30 detik (maks 240). `started_at`/`progress` kiriman klien diabaikan.
- `POST /api/assignments/<id>/submissions` = **upsert per mahasiswa**: `rich_answer` (TipTap, dibersihkan `services/rich_text.py`, server menurunkan `text_answer`) atau `text_answer`, minimal 5 kata. Gambar data URI maks 6 / 2,5 MB. Tanpa draf: durasi 0, teks dianggap tiba sekaligus.
- Pengumpulan berikutnya sebelum tenggat dan belum dinilai: `revision_count += 1`, `ReasoningEvent(revision)` dengan `inserted_words`. Setelah tenggat/dinilai: `400` (dicek ulang dengan `SELECT ... FOR UPDATE`). Klik ganda pertama: constraint unik → `400`, bukan `500`.
- Residu: skrip yang mengirim draf bertahap berjam-jam bisa meniru kurva wajar (biayanya waktu nyata).

### Analisis di worker

- Submit/revisi menyimpan jawaban + satu `AnalysisJob` (antrean Postgres, tanpa Redis). Worker (`SKIP LOCKED`) membaca persetujuan dan jejak proses saat job berjalan, menulis `AnalysisResult` (terkini) dan `AnalysisRun` (riwayat).
- Galat diulang 2×, lalu hasil heuristik dipakai. Job `running` macet > 90 detik diambil ulang; hasil job yang teksnya sudah direvisi dibuang.
- `Submission.analysis_state` (`pending`/`running`/`done`/`failed`); frontend memuat ulang tiap 3 detik. Lokal/tes: `ANALYSIS_INLINE = True` (tanpa proses ketiga).
- `ai_score` dari **teks saja**; `process_band` (`normal`/`partial`/`attention`/`unrecorded`, kosong untuk jawaban diimpor) dilaporkan terpisah, `PROCESS_WEIGHT = 0`. Teks berisi perintah untuk penilai ("abaikan instruksi…") tidak dikirim ke Groq (`apps/analysis/injection.py`).

### Sesi, token, dan akses

- JWT memuat `sid` → baris `auth_sessions` (cache 15 detik); logout dan ganti sandi mencabut sesi. Token di cookie **HttpOnly** lewat `/bff` frontend.
- Unggahan > 4,5 MB (dokumen 10 MB, audio 5 MB) memakai **tiket unggah** 10 menit, hanya diterima view `accepts_upload_ticket`.
- Sandi minimal 10 karakter, bukan sandi umum. Login dibatasi 20/menit per IP dan 10/menit per email.
- **Skor AI dan sinyal tidak pernah dikirim ke mahasiswa** (`StudentSubmissionStatusSerializer`); daftar tugas mahasiswa tidak memuat `text_answer`.

### Penghapusan data

`DELETE /api/me` menghapus profil (cascade) **dan berkasnya** (`documents/<id>/`, `cekpaham/<id>/`, setelah commit); tersisa hanya `account_deletions` (id acak, peran, versi, jumlah). Dosen yang menghapus akun **tidak** menghapus kelasnya: `Class.owner` = NULL, kelas jadi arsip baca-saja (`is_archived`, `reject_if_archived`). `purge_stale_data` (cron `deploy/maintenance.sh`) menyapu berkas yatim > 24 jam, job > 30 hari, notifikasi > 90 hari, sesi lama. Backup (7 hari) masih memuat data sampai kedaluwarsa.

### Unggah dokumen (OCR)

- Per tugas lewat `Assignment.allow_file_upload` (bawaan `false` → `403`). Unggahan tidak pernah mengumpulkan jawaban sendiri.
- `POST /api/assignments/<id>/documents` (multipart `file`, maks 10 MB) → `{document_id, text, page_count, method, warnings}`. Lalu submit dengan `document_id`: `text_answer` = ketikan + teks dokumen (dianalisis), `rich_answer` = ketikan saja. Revisi wajib mengirim ulang `document_id`.
- Jenis berkas dari isi. DOCX/PDF berlapis teks dibaca server; halaman gambar lewat model visual Groq (`GROQ_VISION_MODEL`, bawaan `qwen/qwen3.8-27b`) **hanya bila mahasiswa mengizinkan analisis di luar negeri**. Batas 20 halaman, 6 halaman gambar. `.doc` tidak didukung.
- Berkas di `MEDIA_ROOT = backend/data/media/documents/<mahasiswa>/<dokumen>.{pdf,png,jpg,docx,txt}` (Docker: volume `media`). `verified_source()` memastikan ≥ separuh kata jawaban ada di dokumen; bila terbukti, `source_document` terisi dan forensik proses dilewati, kecuali ketikan > separuh gabungan. Caddy: body unggahan 11 MB, lainnya 2 MB.

### Cek Paham (tes lisan)

```
browser ── rekaman utuh ───────────────► finalize ─► audio disimpan ─► Groq Whisper (transkrip yang dinilai)
        └─ potongan ~4 dtk (mandiri) ──► live ─────► Groq Whisper ─► teks caption saja (tidak disimpan)
                                                          penilai (Groq chat, GROQ_MODEL, 2 jalan paralel) ─► skor + bukti
```

- Jawaban **hanya suara**, 15–300 detik. Transkrip yang dinilai hanya dari audio utuh di server; `live_transcript` klien tidak pernah sampai ke penilai.
- Tanpa env baru: `GROQ_API_KEY` + `GROQ_MODEL`; endpoint yang memanggil Groq membalas `503` bila kunci kosong.
- **Skor dihitung di kode** (`rubric.py`) dari level 0–3 per dimensi: ketepatan 35%, konsistensi 25%, kedalaman 25%, keakraban 15%. Penilai jalan dua kali (urutan rubrik dibalik, selisih besar → `judge_disagreement`); kutipan bukan potongan transkrip dibuang; bukti kurang (< 15 kata) → skor kosong. **Ambang 70/40 belum dikalibrasi**. Tidak pernah mengubah nilai, skor E1, atau Bloom (`tests/test_decoupling.py`).
- Whisper mengarang kalimat pada audio hening; `filter_segments()` membuang segmen di luar durasi dan frasa penutup yang dikenal.
- Persetujuan `rekaman_suara_cekpaham` + `analisis_luar_negeri` diperiksa di DB pada `start`, `live`, `finalize`. Satu attempt aktif; `finalize` diterima sampai tenggat + 10 detik, idempoten. Laporan: `dismissed` atau `grant_retry` (sisa jendela ≥ 24 jam).
- Retensi audio 30 hari: crontab VPS `17 3 * * * cd /opt/thinkpath/backend && docker compose exec -T api python manage.py purge_cekpaham_audio`. Caddy: body `finalize` 6 MB (`make deploy` setelah `git pull`).

### Materi, jadwal, notifikasi

- `topic` materi = teks bebas ("Pertemuan 3: ..."); pengelompokan di frontend.
- `GET /api/student/schedule?start=&end=`: waktu berzona, rentang maks 62 hari, termasuk tenggat lewat.
- Notifikasi dikirim setelah aksi tersimpan, gagalnya tidak menggagalkan aksi (`notifications.services.safe`). Pengingat tenggat 24 jam dibuat saat lonceng dibuka (unik `notif_deadline_once`). Notifikasi mahasiswa tidak pernah menyebut indikasi AI.

### Persetujuan data pribadi

- `PRIVACY_POLICY_VERSION` di `apps/accounts/privacy.py` wajib sama dengan `frontend/lib/privacy.ts` (dicek tes). Setelah versi naik, deploy frontend dan backend berdekatan; versi lama ditolak `400`.
- Satu centang saat daftar (`accept_policy`); server mencatat butir per tujuan (Pasal 22 ayat (4) UU PDP): mahasiswa `data_perkuliahan`, `analisis_proses`, `usia_atau_izin_wali`, `analisis_luar_negeri`, `rekaman_suara_cekpaham`; dosen `data_perkuliahan`, `tanggung_jawab_dosen`. `ConsentRecord` menyimpan versi, butir, waktu, `source`; tidak menyimpan IP.
- Pengumpulan dan Analisis Ulang memeriksa `ConsentRecord` di DB (`403` bila tidak berlaku), bukan klaim token. Tanpa `analisis_luar_negeri`: `run_analysis(allow_external=False)` (Pasal 56 ayat (4)). Pemetaan pasal: `diagram/07-privasi-dan-persetujuan.md`.

---

## Environment

Lokal memakai `.env.example`, produksi memakai `.env.production.example`. Nilai lain (DEBUG, umur token, batas throttle, jumlah thread gunicorn) ditulis langsung di `config/`, bukan di `.env`.

| Var | Lokal | Produksi | Keterangan |
|---|---|---|---|
| `GROQ_API_KEY` / `GROQ_MODEL` | opsional | opsional | kosong = heuristik; model bawaan `openai/gpt-oss-120b` |
| `GROQ_VISION_MODEL` | opsional | opsional | model OCR untuk dokumen scan/foto; bawaan `qwen/qwen3.8-27b`. Perlu `GROQ_API_KEY` |
| `WINSTON_API_KEY` | opsional | opsional | detektor eksternal, skor AI saja |
| `DJANGO_SECRET_KEY` | – | wajib | menandatangani JWT; produksi gagal boot bila kosong |
| `API_DOMAIN` | – | wajib | subdomain API untuk Caddy (HTTPS) dan `ALLOWED_HOSTS` |
| `CORS_ALLOWED_ORIGINS` | – | wajib | origin frontend, mis. `https://thinkpath.vercel.app`; lokal bawaannya `localhost:3000` |
| `POSTGRES_DB` / `POSTGRES_USER` / `POSTGRES_PASSWORD` | ya (user/password boleh kosong di macOS/Linux) | wajib | produksi: membuat user + database container saat pertama kali menyala; password huruf+angka saja |
| `POSTGRES_HOST` / `POSTGRES_PORT` | `localhost` / `5432` | – | produksi: diisi `docker-compose.yml` (`db:5432`) |
