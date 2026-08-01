# ThinkPath

Platform integritas akademik untuk guru SMP/SMA/SMK di Indonesia. Berbeda dari Turnitin/ZeroGPT yang hanya memberi satu skor "AI atau bukan", ThinkPath merekam proses berpikir siswa dan menyajikan beberapa sinyal sebagai **bukti yang dapat ditinjau guru — bukan vonis**.

Status: **Core platform berjalan** — auth email/password, kelas & tugas oleh guru,
pengumpulan + revisi jawaban oleh siswa, analisis AI (Groq, dengan fallback
heuristik), dan dashboard guru sudah jalan end-to-end. UI memakai palette teal +
shadcn/ui (lihat `frontend/README.md`).

## Struktur monorepo

```
thinkpath/
├── frontend/        # Next.js 14 (App Router) + TypeScript + Tailwind
├── backend/         # Django 5 + DRF (satu-satunya API untuk semua data)
├── ai_experiment/   # placeholder untuk detektor & Bloom's classifier (tahap berikutnya)
├── docs/            # source of truth: DATABASE, API, DEPLOYMENT, UIUX_PROMAX, FEATURE_REQUIREMENTS (PRIVATE)
└── README.md
```

Arsitektur "satu pintu API":
- **Auth dikelola Django sendiri** (email + password ter-hash di tabel `profiles`, token JWT diterbitkan backend). Google OAuth ditunda ke tahap berikutnya.
- **Django + DRF** sebagai SATU-SATUNYA API untuk semua data (classes, assignments, submissions). Frontend tidak pernah query database langsung.
- Django memverifikasi JWT lokal di setiap request terproteksi (lihat `backend/core/authentication.py`).

## Stack ringkas

| Layer    | Teknologi                                          | Deploy             |
|----------|----------------------------------------------------|--------------------|
| Frontend | Next.js 14, TypeScript, Tailwind                   | Vercel             |
| Backend  | Django 5 + DRF, PyJWT, gunicorn, psycopg           | Hugging Face Spaces (Docker, port 7860) |
| DB       | SQLite (dev) / Postgres via `DATABASE_URL` (prod)  | Supabase/managed   |
| Auth     | Email + password (Django, JWT lokal)               | Backend            |

## Prasyarat

- Python 3.11+ (developed on 3.13)
- Node.js 20+ (developed on 22)
- Opsional: Docker, kalau ingin coba container backend

## Cara menjalankan lokal

Backend jalan di mesin lokal dan terhubung ke database Postgres di Supabase.
Auth TIDAK memakai Supabase — Supabase hanya dipakai sebagai database.

### 1. Siapkan database Supabase (sekali saja)

1. Buat project baru di [supabase.com](https://supabase.com) (free tier cukup).
   Simpan **Database Password** yang kamu isi saat membuat project.
2. Di dashboard project, klik tombol **Connect** (di atas) → tab **ORMs** atau
   **Connection String** → pilih **Session pooler** (port `5432`).
   Formatnya seperti ini:

   ```
   postgresql://postgres.xxxxxxxxxxxx:[YOUR-PASSWORD]@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres
   ```

3. Ganti `[YOUR-PASSWORD]` dengan Database Password project-mu.

Catatan:
- Pakai **Session pooler** (port 5432), bukan Transaction pooler (port 6543) —
  Session mode paling kompatibel dengan Django dan jaringan IPv4.
- Free tier Supabase di-pause otomatis setelah sekitar 1 minggu tidak aktif.
  Kalau koneksi tiba-tiba gagal (`tenant/user not found` atau timeout), buka
  dashboard Supabase dan klik **Restore project**.

### 2. Backend (Django)

```bash
cd backend
python -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate
pip install -r requirements.txt

cp .env.example .env
```

Edit `backend/.env`:

```
DJANGO_SECRET_KEY=ganti-dengan-string-acak-panjang
DATABASE_URL=postgresql://postgres.xxxxxxxxxxxx:PASSWORDMU@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres
```

Lalu buat skema tabel di Supabase, isi data demo, dan nyalakan server:

```bash
python manage.py migrate            # membuat semua tabel di Supabase
python manage.py seed_demo_data     # isi akun + data demo (idempotent)
python manage.py runserver 0.0.0.0:7860
```

Verifikasi: `curl http://localhost:7860/health` harus mengembalikan `{"status":"ok"}`.
Tabel juga bisa dicek di Supabase dashboard → **Table Editor** (profiles, classes,
assignments, submissions, reasoning_events, analysis_results).

Seeder membuat akun demo siap login (password semua: `thinkpath123`):

- Guru: `guru@thinkpath.local` — punya 2 kelas, 3 tugas, 24 submission beranalisis.
- Siswa: `siswa01@thinkpath.local` s.d. `siswa08@thinkpath.local`.

Alternatif tanpa Supabase: kosongkan/komentari `DATABASE_URL` di `.env`, maka
backend otomatis memakai SQLite lokal (`backend/db.sqlite3`). Berguna saat
offline; langkah lain sama persis.

### 3. Frontend (Next.js)

```bash
cd frontend
cp .env.local.example .env.local    # isinya NEXT_PUBLIC_BACKEND_URL=http://localhost:7860

npm install
npm run dev
```

Buka `http://localhost:3000`. Alur MVP:

1. `/register` → daftar sebagai guru atau siswa (atau login akun seed di `/login`).
2. Guru diarahkan ke `/dashboard`, siswa ke `/student`.
3. Guru membuat kelas + tugas (tenggat wajib), lalu membagikan kode kelas.
   Dashboard guru berbasis kelas: daftar kelas → pilih kelas → tugas-tugasnya →
   tabel submission (dengan pencarian nama + filter "perlu review"/"AI tinggi").
4. Siswa bergabung dengan kode kelas (keanggotaan tersimpan, seperti Google
   Classroom), memilih tugas, dan mengumpulkan jawaban teks. Backend langsung
   menganalisis jawaban: via LLM Groq kalau `GROQ_API_KEY` diisi
   (`backend/academics/llm.py`), atau heuristik fallback kalau kosong.
5. **Siswa bisa melihat & merevisi jawabannya sendiri selama tenggat belum
   berakhir dan belum dinilai.** Revisi memperbarui jawaban yang sama (tidak
   menumpuk duplikat), menaikkan `revision_count`, dan memicu analisis ulang.
   Skor AI tidak ditampilkan ke siswa — hanya jawaban, status, nilai, umpan balik.
6. Guru membuka detail submission: probabilitas AI + bar, level Bloom, daftar
   sinyal, ringkasan, badge keyakinan, jumlah revisi, tombol Analisis Ulang, dan
   form penilaian (nilai + umpan balik).
7. Siswa melihat status tugasnya berubah menjadi "Dinilai" beserta nilai dan
   umpan balik guru.
8. Tombol **Keluar** menghapus sesi dan kembali ke `/login`.

## Dokumentasi proyek

Panduan per-bagian:

- [`backend/README.md`](./backend/README.md) — model, endpoint, auth JWT, env, deploy HF Spaces.
- [`frontend/README.md`](./frontend/README.md) — stack UI, struktur, env, deploy Vercel.

Baca berurutan sebelum kontribusi besar:

1. [`CLAUDE.md`](./CLAUDE.md) — konvensi, code style, scope tahap 1.
2. [`docs/FEATURE_REQUIREMENTS.md`](./docs/FEATURE_REQUIREMENTS.md) — fitur P0/P1/P2/P3.
3. [`docs/DATABASE.md`](./docs/DATABASE.md) — skema tabel + aturan akses + seed.
4. [`docs/API.md`](./docs/API.md) — kontrak endpoint Django.
5. [`docs/skills/UIUX_PROMAX.md`](./docs/skills/UIUX_PROMAX.md) — design tokens + prinsip framing "bukti bukan vonis".
6. [`docs/DEPLOYMENT.md`](./docs/DEPLOYMENT.md) — deploy ke HF Spaces + Vercel.

## Skrip yang berguna

```bash
# Backend
python manage.py migrate              # apply skema
python manage.py seed_demo_data       # isi data demo (idempotent)
python manage.py runserver 0.0.0.0:7860

# Frontend
npm run dev      # dev server di port 3000
npm run build    # production build
npm run lint     # ESLint
```

## Deploy produksi

Backend ke **Hugging Face Spaces** (Docker), frontend ke **Vercel**. Repo aman
di-push apa adanya: tidak ada secret ter-commit, `.env`/`db.sqlite3` di-gitignore,
dan `backend/.dockerignore` mencegah `.env` ikut ke image.

**Backend (HF Spaces, tipe Docker)** — set sebagai **Secrets**, bukan di Dockerfile:

| Secret | Contoh |
|--------|--------|
| `DJANGO_SECRET_KEY` | string acak 50+ char (wajib; boot gagal kalau kosong saat `DEBUG=0`) |
| `DJANGO_DEBUG` | `0` |
| `DJANGO_ALLOWED_HOSTS` | `namaspace.hf.space` |
| `CORS_ALLOWED_ORIGINS` | `https://namaapp.vercel.app` |
| `DATABASE_URL` | connection string Supabase |
| `GROQ_API_KEY` | kunci Groq |

Saat `DEBUG=0`, flag keamanan (HTTPS redirect, HSTS, secure cookie, proxy SSL
header) aktif otomatis. Detail di [`backend/README.md`](./backend/README.md).

**Frontend (Vercel)** — import folder `frontend/`, set
`NEXT_PUBLIC_BACKEND_URL=https://namaspace.hf.space`. Detail di
[`frontend/README.md`](./frontend/README.md).

## Filosofi produk (jangan dilanggar)

- Tujuannya **bukan menghukum** siswa karena pakai AI — tujuannya memberi guru visibilitas + feedback presisi.
- **Tidak ada satu skor pun yang jadi vonis.** Setiap flag selalu disertai bukti yang bisa dijelaskan.
- Data milik anak di bawah umur. Privasi & framing yang tidak menuduh adalah requirement, bukan opsi.
