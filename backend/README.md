# ThinkPath — Backend

Django 5.2 LTS + Django REST Framework. **Satu-satunya API** untuk seluruh data ThinkPath (profil, kelas, tugas, submission, analisis). Frontend (Next.js di Vercel) tidak pernah menyentuh database langsung.

> Panduan menyeluruh proyek: [README utama](../README.md) · ERD dan kamus data: [diagram/08](../diagram/08-erd-basis-data.md)

---

## Gambaran singkat

| | **Lokal** | **Produksi (VPS)** |
|---|---|---|
| Server | `manage.py runserver` (auto-reload) | gunicorn di belakang Caddy (HTTPS) |
| Database | PostgreSQL yang terpasang di laptop | PostgreSQL 17 di container `db` |
| Templat `.env` | `.env.example` | `.env.production.example` |
| URL API | `http://127.0.0.1:7860` | `https://api.thinkpath.id` |

Tiap mesin hanya punya **satu** `backend/.env`, disalin dari templat yang sesuai. Selain itu semuanya ditulis langsung di `config/settings/`.

Di produksi, backend berjalan sebagai tiga container Docker di satu VPS (IDCloudHost, Jakarta):

```
Internet ──HTTPS──> caddy ──HTTP──> api (gunicorn + Django) ──> db (PostgreSQL 17)
                    :80/:443        jaringan Docker saja         127.0.0.1:5433 (SSH tunnel)
```

| Komponen | Untuk apa |
|---|---|
| **gunicorn** | Server aplikasi produksi yang menjalankan Django. `runserver` hanya untuk dev. Konfigurasinya 1 worker × 8 thread, jadi dashboard dosen tetap jalan walau ada submit yang menunggu Winston + Groq (~20 detik) |
| **Caddy** | Pintu depan dari internet: sertifikat HTTPS otomatis (Let's Encrypt), redirect HTTP→HTTPS, kompresi, lalu meneruskan ke gunicorn |
| **PostgreSQL** | Datanya di Docker volume `thinkpath_pgdata`, tetap ada walau container dibuat ulang. Hanya `docker compose down -v` yang menghapusnya |

---

## Menjalankan di lokal

Prasyarat: **Python 3.12+** dan **PostgreSQL 15+**.

**1. Pasang dan nyalakan PostgreSQL, lalu buat database `thinkpath`**

| OS | Perintah |
|---|---|
| macOS | `brew install postgresql@18 && brew services start postgresql@18 && createdb thinkpath` |
| Linux (Ubuntu) | `sudo apt install postgresql && sudo -u postgres createuser -s $USER && createdb thinkpath` |
| Windows | Pasang dari [postgresql.org/download/windows](https://www.postgresql.org/download/windows/) (catat password user `postgres`), lalu di PowerShell: `createdb -U postgres thinkpath` |

**2. Pasang backend**

macOS / Linux:

```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
python manage.py migrate
python manage.py seed_demo_data      # akun + data demo, aman diulang
python manage.py runserver 127.0.0.1:7860
```

Windows (PowerShell):

```powershell
cd backend
py -m venv venv
venv\Scripts\Activate.ps1            # jika diblokir: Set-ExecutionPolicy -Scope CurrentUser RemoteSigned
pip install -r requirements.txt
copy .env.example .env
# di .env: POSTGRES_USER=postgres dan POSTGRES_PASSWORD=<password instalasi>
python manage.py migrate
python manage.py seed_demo_data
python manage.py runserver 127.0.0.1:7860
```

Di macOS/Linux, `POSTGRES_USER` dan `POSTGRES_PASSWORD` boleh kosong: user yang dipakai adalah user sistem operasi, tanpa password. Nama variabelnya sama dengan di produksi.

Cek: `http://127.0.0.1:7860/health` membalas `{"status":"ok"}`. Di macOS/Linux, `make dev` menjalankan migrate + runserver sekaligus.

Frontend dijalankan terpisah di `frontend/` (`npm install` lalu `npm run dev`), dengan `NEXT_PUBLIC_BACKEND_URL=http://127.0.0.1:7860` di `frontend/.env.local`.

**Akun demo** (password `thinkpath123`): `dosen@thinkpath.local` · `mhs01@thinkpath.local` s.d. `mhs08@thinkpath.local`

Membuka database: `psql thinkpath` di terminal, atau GUI (TablePlus, DBeaver, pgAdmin) dengan host `127.0.0.1`, port `5432`, database `thinkpath`.

### Tes

```bash
python manage.py test                                    # semua tes (= make test)
python manage.py test apps.analysis.tests.test_detector  # satu modul
```

Aplikasi selalu memakai PostgreSQL; hanya tes yang berbeda. `manage.py test` **selalu** memakai SQLite in-memory dan mengabaikan `POSTGRES_*` di `.env`, jadi tidak pernah menyentuh database sungguhan. Dulu tes ikut memakai database dari `.env` dan nyaris menghapus database di server produksi; `common/tests.py` menjaga agar itu tidak terulang.

### Mencoba stack produksi di Mac (OrbStack / Docker Desktop)

Menjalankan susunan yang sama persis dengan VPS (Postgres + gunicorn + Caddy) sebelum deploy. `.env` tetap untuk runserver; Docker di Mac membaca `.env.docker`.

```bash
cd backend
cp .env.production.example .env.docker
# di .env.docker isi: DJANGO_SECRET_KEY, POSTGRES_PASSWORD (perintahnya ada di komentar), lalu
#   API_DOMAIN=http://localhost
#   CORS_ALLOWED_ORIGINS=http://localhost:3000,http://127.0.0.1:3000
make up        # build + start; Makefile otomatis memakai .env.docker bila ada
make ps        # db & api "healthy"
make seed      # akun demo
curl http://localhost/health
```

Frontend ke API Docker: `NEXT_PUBLIC_BACKEND_URL=http://localhost npm run dev` di `frontend/`. Database container: `make psql`, atau GUI ke `127.0.0.1:5433` user/db `thinkpath` dengan password dari `.env.docker`. Selesai: `make down` (data tetap), atau `docker compose --env-file .env.docker down -v` untuk menghapus datanya juga.

`API_DOMAIN=http://localhost` membuat Caddy melayani HTTP biasa, karena sertifikat lokal buatan Caddy tidak dipercaya Node.js. Di VPS isi dengan nama domain saja (tanpa `http://`) supaya Caddy mengambil sertifikat HTTPS.

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

**5. Frontend**: kode frontend di `main` harus memuat Kebijakan Privasi versi yang sama dengan backend (`2026-10-12`); bila belum, layar persetujuan menolak semua login. Jadi deploy backend dan frontend dari commit yang sama, berdekatan. Di proyek Vercel, set `NEXT_PUBLIC_BACKEND_URL=https://api.thinkpath.id` lalu **Redeploy** (nilai `NEXT_PUBLIC_*` ditanam saat build).

**6. Backup harian**

```bash
crontab -e
# tambahkan:
0 2 * * * /opt/thinkpath/backend/deploy/backup.sh >> /opt/thinkpath/backend/backups/backup.log 2>&1
```

Backup disimpan 7 hari di `backups/`. Salin berkala ke luar VPS (mis. `scp` ke laptop), karena backup di disk yang sama tidak menolong bila VPS-nya rusak.

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
- **Batas RAM**: db 320 MB, api 320 MB, caddy 64 MB. Saat diam totalnya sekitar 120 MB. Jika banyak mahasiswa mengumpulkan bersamaan, naikkan `threads` di `config/gunicorn.conf.py`, bukan `workers`.
- **Throttle login** (20/menit per IP) disimpan di memori proses, bukan di DB, sesuai Kebijakan Privasi. Restart container mengenolkannya.
- **Port**: hanya 80/443 yang publik. Postgres terikat ke `127.0.0.1:5433`, jadi hanya bisa dibuka lewat SSH tunnel. Docker melewati UFW untuk port yang dipublikasikan, jadi jangan pernah mengubahnya ke `0.0.0.0`.

---

## Struktur Proyek

```
backend/
├── config/                   # bukan app: settings, urls, wsgi, gunicorn
│   ├── settings/
│   │   ├── base.py           # bersama
│   │   ├── development.py    # lokal, bawaan manage.py
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
├── common/                   # helper lintas app: http, HealthView
├── requirements.txt
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

Lokal memakai `.env.example`, produksi memakai `.env.production.example`. Nilai lain (DEBUG, umur token, batas throttle, jumlah thread gunicorn) ditulis langsung di `config/`, bukan di `.env`.

| Var | Lokal | Produksi | Keterangan |
|---|---|---|---|
| `GROQ_API_KEY` / `GROQ_MODEL` | opsional | opsional | kosong = heuristik; model bawaan `openai/gpt-oss-120b` |
| `WINSTON_API_KEY` | opsional | opsional | detektor eksternal, skor AI saja |
| `DJANGO_SECRET_KEY` | – | wajib | menandatangani JWT; produksi gagal boot bila kosong |
| `API_DOMAIN` | – | wajib | subdomain API untuk Caddy (HTTPS) dan `ALLOWED_HOSTS` |
| `CORS_ALLOWED_ORIGINS` | – | wajib | origin frontend, mis. `https://thinkpath.vercel.app`; lokal bawaannya `localhost:3000` |
| `POSTGRES_DB` / `POSTGRES_USER` / `POSTGRES_PASSWORD` | ya (user/password boleh kosong di macOS/Linux) | wajib | produksi: membuat user + database container saat pertama kali menyala; password huruf+angka saja |
| `POSTGRES_HOST` / `POSTGRES_PORT` | `localhost` / `5432` | – | produksi: diisi `docker-compose.yml` (`db:5432`) |
