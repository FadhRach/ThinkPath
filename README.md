# ThinkPath

Platform integritas akademik untuk dosen di perguruan tinggi Indonesia. Berbeda dari Turnitin/ZeroGPT yang hanya memberi satu skor "AI atau bukan", ThinkPath merekam proses berpikir mahasiswa dan menyajikan beberapa sinyal sebagai **bukti yang dapat ditinjau dosen, bukan vonis**.

Status: **Core platform berjalan**. Auth email/password, kelas & tugas oleh dosen,
pengumpulan + revisi jawaban oleh mahasiswa, analisis AI (Groq, dengan fallback
heuristik), dan dashboard dosen sudah jalan end-to-end. UI memakai palette teal +
shadcn/ui (lihat `frontend/README.md`).

## Struktur monorepo

```
thinkpath/
├── frontend/        # Next.js 14 (App Router) + TypeScript + Tailwind
├── backend/         # Django 5 + DRF (satu-satunya API untuk semua data)
├── ai_experiment/   # validasi & kalibrasi lapisan analisis
├── docs/            # source of truth: DATABASE, API, DEPLOYMENT, UIUX_PROMAX, FEATURE_REQUIREMENTS (PRIVATE)
└── README.md
```

Arsitektur "satu pintu API":
- **Auth dikelola Django sendiri** (email + password ter-hash di tabel `profiles`, token JWT diterbitkan backend). Google OAuth ditunda ke tahap berikutnya.
- **Django + DRF** sebagai SATU-SATUNYA API untuk semua data (classes, assignments, submissions). Frontend tidak pernah query database langsung.
- Django memverifikasi JWT lokal di setiap request terproteksi (lihat `backend/core/authentication.py`).

## Lapisan analisis

Dua mesin yang saling bebas, keduanya membaca fitur teks dari sumber yang sama
tetapi tidak pernah saling membaca hasil.

| Mesin | Berkas | Keluaran |
|---|---|---|
| E1 indikasi AI | `ai_score.py`, `text_features.py`, `process_signals.py` | skor 0 sampai 100 plus rincian kontribusi tiap sinyal |
| E2 level Bloom | `bloom.py` | level C1 sampai C6 plus keyakinan dan bukti |
| Orkestrator | `analysis.py` | menggabungkan keduanya, membandingkan ke target dosen |
| Jalur LLM | `llm.py` | Groq, dengan jatuh ke heuristik bila gagal |

Tiga aturan yang tidak boleh dilanggar, dijaga oleh 27 tes di
`backend/academics/tests/`:

1. **E2 tidak pernah membaca skor E1.** Level kognitif dan dugaan penggunaan AI
   adalah dua hal berbeda. Mahasiswa bisa menulis analisis tajam dengan bantuan AI,
   dan bisa juga menulis jawaban lemah sepenuhnya sendiri.
2. **E2 tidak pernah membaca target Bloom dosen.** Target adalah harapan, bukan
   hasil ukur. Kalau target dipakai sebagai dasar taksiran, sistem hanya
   memantulkan kembali asumsi dosen dan tidak akan pernah bisa memberi tahu bahwa
   targetnya terlalu tinggi atau terlalu rendah.
3. **Tidak ada langit langit pada level teramati.** Jawaban yang melampaui
   target harus bisa tercatat, kalau tidak pertumbuhan kognitif mustahil dilacak.

Sinyal forensik proses (durasi, revisi, porsi tempelan) adalah satu satunya yang
tidak membaca teks sama sekali, sehingga parafrase tidak menghapusnya. Bobotnya
0,25 dan sinyal teks diciutkan proporsional agar totalnya tetap 1,0.

### Status kalibrasi

Bobot dan ambang saat ini **ditetapkan dari penalaran, bukan dari data**.
Sampai gold set berskala penuh dievaluasi, jangan mengklaim akurasi, presisi,
atau recall dari lapisan ini. Uji jalan awal pada 24 sampel menunjukkan ambang
sekarang meleset di dua arah: pada skor 35 lebih dari separuh teks manusia
tertuduh, sedangkan pada skor 70 tidak ada sampel yang mencapainya.

Perkakas untuk memperbaikinya ada di [`ai_experiment/`](./ai_experiment/README.md).

## Pemodelan domain mahasiswa

Jenjang (`D3`, `S1`, `S2`, `S3`), program studi, dan semester **melekat di
kelas**, bukan di profil mahasiswa dan bukan di tugas.

- **Bukan di profil.** Semester seorang mahasiswa berubah tiap enam bulan.
  Menyimpannya di `Profile` berarti datanya basi terus dan harus diperbarui
  manual. Sebuah kelas sebaliknya permanen berstatus "semester 3".
- **Bukan di tugas.** Sebelumnya `Assignment` menyimpan `education_level`
  sendiri, menduplikasi kolom yang sama di `Class`. Duplikasi itu memungkinkan
  tugas S2 tersimpan di dalam kelas S1. Kolomnya sudah dihapus; serializer tetap
  memaparkan jenjang, tetapi bersumber dari kelas sehingga kontrak API tidak
  berubah.

Program studi dan semester keduanya opsional: ada mata kuliah umum yang tidak
dimiliki satu prodi mana pun, dan ada kelas yang ditawarkan lintas semester.
Memaksakannya wajib hanya akan membuat dosen mengisi data karangan.

Keduanya saat ini murni metadata pelaporan. **Belum menjadi masukan bagi lapisan
analisis**, dan itu disengaja: menambah dimensi kalibrasi sebelum ada data
berlabel akan memperbanyak sel dan memperkecil sampel per sel, sehingga model
justru memburuk. Uji pengaruhnya lewat `ai_experiment` lebih dulu.

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
Auth TIDAK memakai Supabase. Supabase hanya dipakai sebagai database.

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
- Pakai **Session pooler** (port 5432), bukan Transaction pooler (port 6543).
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

- Dosen: `dosen@thinkpath.local`, punya 2 kelas, 3 tugas, 24 submission beranalisis.
- Mahasiswa: `mhs01@thinkpath.local` s.d. `mhs08@thinkpath.local`.

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

1. `/register` → daftar sebagai dosen atau mahasiswa (atau login akun seed di `/login`).
2. Dosen diarahkan ke `/dashboard`, mahasiswa ke `/student`.
3. Dosen membuat kelas + tugas (tenggat wajib), lalu membagikan kode kelas.
   Dashboard dosen berbasis kelas: daftar kelas → pilih kelas → tugas-tugasnya →
   tabel submission (dengan pencarian nama + filter "perlu review"/"AI tinggi").
4. Mahasiswa bergabung dengan kode kelas (keanggotaan tersimpan, seperti Google
   Classroom), memilih tugas, dan mengumpulkan jawaban teks. Backend langsung
   menganalisis jawaban: via LLM Groq kalau `GROQ_API_KEY` diisi
   (`backend/academics/llm.py`), atau heuristik fallback kalau kosong.
5. **Mahasiswa bisa melihat & merevisi jawabannya sendiri selama tenggat belum
   berakhir dan belum dinilai.** Revisi memperbarui jawaban yang sama (tidak
   menumpuk duplikat), menaikkan `revision_count`, dan memicu analisis ulang.
   Skor AI tidak ditampilkan ke mahasiswa, hanya jawaban, status, nilai, umpan balik.
6. Dosen membuka detail submission: probabilitas AI + bar, panel **Asal Skor AI**
   yang merinci kontribusi tiap sinyal, level Bloom beserta keyakinannya
   sendiri, penanda asal analisis (LLM, cadangan heuristik, atau data demo),
   jam mulai dan jam pengumpulan, jumlah kata, daftar sinyal, ringkasan, jumlah
   revisi, tombol Analisis Ulang, dan form penilaian.
7. Mahasiswa melihat status tugasnya berubah menjadi "Dinilai" beserta nilai dan
   umpan balik dosen.
8. Tombol **Keluar** menghapus sesi dan kembali ke `/login`.

## Dokumentasi proyek

Panduan per-bagian:

- [`backend/README.md`](./backend/README.md): model, endpoint, auth JWT, env, deploy HF Spaces.
- [`frontend/README.md`](./frontend/README.md): stack UI, struktur, env, deploy Vercel.
- [`ai_experiment/README.md`](./ai_experiment/README.md): membangun gold set manusia vs AI tanpa anotator, lalu mengukur lapisan analisis terhadapnya.

Baca berurutan sebelum kontribusi besar:

1. [`CLAUDE.md`](./CLAUDE.md): konvensi, code style, scope tahap 1.
2. [`docs/FEATURE_REQUIREMENTS.md`](./docs/FEATURE_REQUIREMENTS.md): fitur P0/P1/P2/P3.
3. [`docs/DATABASE.md`](./docs/DATABASE.md): skema tabel + aturan akses + seed.
4. [`docs/API.md`](./docs/API.md): kontrak endpoint Django.
5. [`docs/skills/UIUX_PROMAX.md`](./docs/skills/UIUX_PROMAX.md): design tokens + prinsip framing "bukti bukan vonis".
6. [`docs/DEPLOYMENT.md`](./docs/DEPLOYMENT.md): deploy ke HF Spaces + Vercel.

## Skrip yang berguna

```bash
# Backend
python manage.py migrate              # apply skema
python manage.py seed_demo_data       # isi data demo (idempotent)
python manage.py runserver 0.0.0.0:7860
python manage.py test academics       # 27 tes lapisan analisis

# Frontend
npm run dev      # dev server di port 3000
npm run build    # production build
npm run lint     # ESLint

# Validasi model (dari folder ai_experiment)
python -m src.build_gold_set --target 500 --include-mixed
python -m src.evaluate_baseline
python -m unittest discover -s tests
```

## Deploy produksi

Backend ke **Hugging Face Spaces** (Docker), frontend ke **Vercel**. Repo aman
di-push apa adanya: tidak ada secret ter-commit, `.env`/`db.sqlite3` di-gitignore,
dan `backend/.dockerignore` mencegah `.env` ikut ke image.

**Backend (HF Spaces, tipe Docker)**: set sebagai **Secrets**, bukan di Dockerfile:

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

**Frontend (Vercel)**: import folder `frontend/`, set
`NEXT_PUBLIC_BACKEND_URL=https://namaspace.hf.space`. Detail di
[`frontend/README.md`](./frontend/README.md).

## Filosofi produk (jangan dilanggar)

- Tujuannya **bukan menghukum** mahasiswa karena pakai AI, tujuannya memberi dosen visibilitas + feedback presisi.
- **Tidak ada satu skor pun yang jadi vonis.** Setiap flag selalu disertai bukti yang bisa dijelaskan.
- Fokus pada mahasiswa, bukan anak di bawah umur, sehingga persetujuan partisipan lebih sederhana. Privasi dan framing yang tidak menuduh tetap requirement, bukan opsi.
