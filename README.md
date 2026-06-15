# ThinkPath

Platform integritas akademik untuk guru SMP/SMA/SMK di Indonesia. Berbeda dari Turnitin/ZeroGPT yang hanya memberi satu skor "AI atau bukan", ThinkPath merekam proses berpikir siswa dan menyajikan beberapa sinyal sebagai **bukti yang dapat ditinjau guru — bukan vonis**.

Status: **Tahap 1 (mockup tanpa model AI)** — F-01 s/d F-06 sudah jalan (lihat `docs/FEATURE_REQUIREMENTS.md`).

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
- **Supabase Auth** hanya untuk identitas (register/login email + Google OAuth).
- **Django + DRF** sebagai SATU-SATUNYA API untuk semua data (classes, assignments, submissions). Frontend tidak pernah query Postgres langsung.
- Django memverifikasi JWT Supabase di setiap request terproteksi (lihat `backend/core/authentication.py`).

## Stack ringkas

| Layer    | Teknologi                                          | Deploy             |
|----------|----------------------------------------------------|--------------------|
| Frontend | Next.js 14, TypeScript, Tailwind, `@supabase/ssr`  | Vercel             |
| Backend  | Django 5 + DRF, PyJWT, gunicorn, psycopg           | Hugging Face Spaces (Docker, port 7860) |
| DB       | Postgres (Supabase)                                | Supabase           |
| Auth     | Supabase Auth (email + Google)                     | Supabase           |

## Prasyarat

- Python 3.11+ (developed on 3.13)
- Node.js 20+ (developed on 22)
- Akun Supabase (gratis) untuk auth + Postgres
- Opsional: Docker, kalau ingin coba container backend

## Cara menjalankan lokal

### 1. Siapkan Supabase

1. Buat project di [supabase.com](https://supabase.com).
2. Catat dari **Settings → API**:
   - `Project URL` → untuk `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public` → untuk `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `JWT Secret` → untuk `SUPABASE_JWT_SECRET`
3. Catat dari **Settings → Database → Connection string** → untuk `DATABASE_URL`.
4. Di **Authentication → URL Configuration**, tambahkan `http://localhost:3000/auth/callback` ke "Additional redirect URLs".
5. (Opsional) Aktifkan Google provider di **Authentication → Providers**.

### 2. Backend (Django)

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

cp .env.example .env
# Isi DATABASE_URL, SUPABASE_JWT_SECRET, DJANGO_SECRET_KEY

python manage.py migrate
python manage.py seed_demo_data
python manage.py runserver 0.0.0.0:7860
```

Verifikasi: `curl http://localhost:7860/health` harus mengembalikan `{"status":"ok"}`.

Seed command akan menampilkan UUID teacher demo. Catat — kalau ingin login sebagai teacher demo (agar dashboard berisi data seed), `sub` user Supabase yang kamu pakai harus sama dengan UUID ini. Cara paling cepat: register user baru, lalu di Supabase dashboard update kolom `id` user tersebut, ATAU update kolom `id` di tabel `profiles` Postgres ke `sub` user kamu.

### 3. Frontend (Next.js)

```bash
cd frontend
cp .env.local.example .env.local
# Isi NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, NEXT_PUBLIC_BACKEND_URL

npm install
npm run dev
```

Buka `http://localhost:3000`. Alur:

1. `/register` → daftar email/password atau Google.
2. Setelah login, middleware mengarahkan ke `/dashboard`.
3. Dashboard memanggil Django (`/api/me`, `/api/classes`, `/api/assignments/{id}/submissions`).
4. Klik salah satu baris submission → halaman detail dengan Evidence Strip + ringkasan proses + rekomendasi placeholder.

## Dokumentasi proyek

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

## Filosofi produk (jangan dilanggar)

- Tujuannya **bukan menghukum** siswa karena pakai AI — tujuannya memberi guru visibilitas + feedback presisi.
- **Tidak ada satu skor pun yang jadi vonis.** Setiap flag selalu disertai bukti yang bisa dijelaskan.
- Data milik anak di bawah umur. Privasi & framing yang tidak menuduh adalah requirement, bukan opsi.

