# ThinkPath Backend

Django 5 + Django REST Framework. Satu-satunya API untuk semua data ThinkPath
(profiles, classes, assignments, submissions, analisis). Frontend tidak pernah
menyentuh database langsung, semua lewat endpoint di sini.

## Arsitektur singkat

- **Identitas dikelola sendiri.** Bukan `django.contrib.auth.User`, melainkan
  tabel `profiles` (`core.models.Profile`) dengan password ter-hash. Login
  menerbitkan **JWT HS256 lokal** (`core.authentication.TokenAuthentication`)
  yang ditandatangani `DJANGO_SECRET_KEY`. Klaim token: `sub` (UUID profil),
  `email`, `role`.
- **Dua app:** `core` (auth + profil) dan `academics` (kelas, tugas, submission,
  analisis). `thinkpath` adalah package settings/urls.
- **Analisis** dijalankan sinkron saat submit lewat `academics.llm.run_analysis`.
  Skor AI punya rantai tiga lapis: **detektor eksternal** (`academics.detector`,
  penyedia sekarang Winston AI), lalu `ai_probability` dari **Groq**
  (`llama-3.3-70b-versatile`, OpenAI-compatible), lalu heuristik lokal
  (`academics.analysis`). Kunci yang kosong atau API yang gagal cukup
  menjatuhkan ke lapisan berikutnya, tidak pernah menggagalkan pengumpulan tugas.
  **Level Bloom tidak ikut rantai itu**: hanya Groq lalu heuristik, dan detektor
  tidak pernah menyentuhnya.
  Winston mengembalikan **human score** (0 = AI, 100 = manusia); pembalikannya
  dikerjakan satu kali di `detector.py` dan dikunci tes.

## Model utama (`academics/models.py`, `core/models.py`)

| Model | Tabel | Catatan |
|-------|-------|---------|
| `Profile` | `profiles` | email unik, password hash, `role` teacher/student |
| `Class` | `classes` | milik dosen (`owner`), punya `join_code` unik, plus `education_level`, `program_studi`, dan `semester` |
| `ClassMembership` | `class_memberships` | mahasiswa gabung kelas (unik per kelas) |
| `Assignment` | `assignments` | `deadline`, `expected_bloom_level` (1-6). Jenjang diwarisi dari kelas, tidak disimpan di sini |
| `Submission` | `submissions` | `status` draft/submitted/reviewed, `revision_count`, `grade` |
| `ReasoningEvent` | `reasoning_events` | jejak proses: started/revision/paste/submitted |
| `AnalysisResult` | `analysis_results` | OneToOne submission: `ai_score`, `ai_band`, `bloom_level`, `signals` |

## Endpoint

Semua di bawah `/api`, butuh `Authorization: Bearer <token>` kecuali yang
ditandai publik.

| Method | Path | Akses | Fungsi |
|--------|------|-------|--------|
| GET | `/health` | publik | health check |
| POST | `/api/auth/register` | publik | daftar, balikan token + profil |
| POST | `/api/auth/login` | publik | login, balikan token + profil |
| GET/PATCH | `/api/me` | login | profil sendiri |
| GET/POST | `/api/classes` | dosen | daftar / buat kelas |
| GET/POST | `/api/classes/<id>/assignments` | dosen pemilik | daftar / buat tugas |
| POST | `/api/join` | mahasiswa | gabung kelas via join code |
| GET | `/api/student/classes` | mahasiswa | kelas diikuti + status tiap tugas |
| GET | `/api/student/assignments/<id>` | mahasiswa anggota | detail tugas + submission sendiri |
| GET/POST | `/api/assignments/<id>/submissions` | GET dosen pemilik, POST mahasiswa | daftar submission / **submit atau revisi** |
| GET/PATCH | `/api/submissions/<id>` | dosen pemilik | detail / beri nilai + umpan balik |
| POST | `/api/submissions/<id>/reanalyze` | dosen pemilik | analisis ulang |

### Submit & revisi (fitur inti)

`POST /api/assignments/<id>/submissions` bersifat **upsert per mahasiswa**:

- Submission pertama → dibuat baru (`revision_count=0`).
- Submission berikutnya sebelum tenggat & belum dinilai → **update jawaban yang
  sama**, `revision_count += 1`, tambah `ReasoningEvent(revision)`, analisis
  ulang. Tidak menumpuk baris duplikat.
- Setelah tenggat (`Assignment.deadline`) lewat → ditolak (`400`).
- Setelah dinilai dosen (`status=reviewed`) → ditolak (`400`).

Mahasiswa hanya melihat jawaban, status, nilai, dan umpan balik. **Skor AI dan
sinyal tidak diekspos ke mahasiswa** (`StudentSubmissionStatusSerializer`).

## Menjalankan lokal

```bash
python -m venv .venv
source .venv/bin/activate            # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env                 # isi minimal DJANGO_SECRET_KEY (+ DATABASE_URL kalau pakai Supabase)

python manage.py migrate
python manage.py seed_demo_data      # akun + data demo, idempotent
python manage.py runserver 0.0.0.0:7860
```

Cek: `curl http://localhost:7860/health` -> `{"status":"ok"}`.

Akun demo (password `thinkpath123`): `dosen@thinkpath.local`,
`mahasiswa01@thinkpath.local` s.d. `mahasiswa08@thinkpath.local`.

Tanpa Supabase: kosongkan `DATABASE_URL` di `.env`, backend otomatis pakai
SQLite lokal (`db.sqlite3`).

## Variabel environment

| Var | Wajib | Default | Keterangan |
|-----|-------|---------|------------|
| `DJANGO_SECRET_KEY` | ya (prod) | fallback dev hanya saat DEBUG | menandatangani JWT auth |
| `DJANGO_DEBUG` | - | `0` (False) | set `1` untuk dev |
| `DJANGO_ALLOWED_HOSTS` | ya (prod) | `localhost,127.0.0.1` | host yang diizinkan |
| `CORS_ALLOWED_ORIGINS` | ya (prod) | `http://localhost:3000` | origin frontend |
| `DATABASE_URL` | - | SQLite kalau kosong | Postgres Supabase |
| `DB_CONN_MAX_AGE` | - | `0` | naikkan ke `60` untuk reuse koneksi (worker sedikit) |
| `GROQ_API_KEY` | - | kosong = heuristik | kunci analisis LLM |
| `GROQ_MODEL` | - | `llama-3.3-70b-versatile` | model Groq |
| `WINSTON_API_KEY` | - | kosong = jalur lama | kunci detektor AI eksternal, skor AI saja |
| `AUTH_TOKEN_LIFETIME_DAYS` | - | `7` | umur token |

## Deploy: Hugging Face Spaces (Docker)

`Dockerfile` sudah siap (`python:3.11-slim`, `EXPOSE 7860`, `gunicorn`).
`.dockerignore` mencegah `.env`/`db.sqlite3` ikut ter-bake ke image.

Checklist produksi:

1. Buat Space bertipe **Docker**, push folder `backend/`.
2. Set **Secrets** (bukan Variables biasa, jangan taruh di Dockerfile):
   `DJANGO_SECRET_KEY` (string acak 50+ char), `DJANGO_DEBUG=0`,
   `DJANGO_ALLOWED_HOSTS=<nama-space>.hf.space`,
   `CORS_ALLOWED_ORIGINS=https://<app>.vercel.app`,
   `DATABASE_URL`, `GROQ_API_KEY`, `WINSTON_API_KEY`.
3. Saat `DEBUG=False`: `DJANGO_SECRET_KEY` wajib (boot gagal keras kalau kosong),
   dan flag keamanan (SSL redirect, HSTS, secure cookie, proxy SSL header) aktif
   otomatis.
4. HF free tier tidur setelah ~48 jam idle, pasang keep-alive (cron eksternal
   ping `/health`) kalau perlu selalu hidup.
