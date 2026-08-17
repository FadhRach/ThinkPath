# ThinkPath

**Sistem Verifikasi Pemahaman Berbasis Proses untuk Integritas Akademik Mahasiswa**

ThinkPath membantu dosen menjawab pertanyaan yang tidak bisa dijawab alat deteksi AI biasa: mahasiswa mana yang paling layak diajak bicara lebih dulu. Alih-alih memberi satu skor "AI atau bukan", ThinkPath merekam proses pengerjaan (durasi, revisi, pertumbuhan kata, tempelan), mengukur level penalaran jawaban dengan Taksonomi Bloom, lalu menyajikan keduanya sebagai bukti yang bisa ditinjau dosen, bukan vonis.

**Live demo:** https://thinkpath.vercel.app

## Kontributor

Tim DataDigger, Universitas Bina Nusantara.

| Nama | NIM | GitHub |
|---|---|---|
| Fadhlan Nur Rachman | 2802491690 | [@FadhRach](https://github.com/FadhRach) |
| Bambang Aranaya Saputra | 2802388831 | [@Bambang-Saputra](https://github.com/Bambang-Saputra) |
| Pasya Kemal Halim | 2802486684 | [@Pasya-Kemal](https://github.com/Pasya-Kemal) |

## Akun Demo

Password untuk semua akun: `thinkpath123`

| Peran | Email | Isi |
|---|---|---|
| Dosen | `dosen@thinkpath.local` | 2 kelas, 10 tugas, 64 submission yang sudah dianalisis |
| Mahasiswa | `mhs01@thinkpath.local` s.d. `mhs08@thinkpath.local` | 8 mahasiswa dengan lintasan Bloom berbeda |

Untuk peninjauan cepat, login sebagai dosen dan buka halaman Overview.

## Tech Stack

| Layer | Teknologi | Deploy |
|---|---|---|
| Frontend | Next.js 14 (App Router), TypeScript, Tailwind, shadcn/ui, Recharts | Vercel |
| Backend | Django 5 + DRF, PyJWT, gunicorn, psycopg | Hugging Face Spaces (Docker) |
| Database | PostgreSQL, SQLite untuk dev offline | Supabase |
| Analisis AI | Winston AI, Groq `llama-3.3-70b-versatile`, heuristik lokal | - |
| Auth | Email + password, JWT HS256 diterbitkan Django | - |

## Struktur Project

```
thinkpath/
├── frontend/        Next.js 14, antarmuka dosen dan mahasiswa
├── backend/         Django 5 + DRF, satu-satunya API untuk semua data
├── ai_experiment/   Validasi dan kalibrasi lapisan analisis
└── docs/            Dokumentasi teknis internal
```

Frontend tidak pernah menyentuh database langsung:

```
Browser -> Next.js (Vercel) -> Django + DRF (HF Spaces) -> PostgreSQL (Supabase)
                                      |
                                      +-> Analisis: Winston -> Groq -> heuristik
```

## Setup Lokal

Prasyarat: Python 3.11+ dan Node.js 20+

**1. Backend**

```bash
cd backend
python -m venv venv
venv\Scripts\activate            # macOS/Linux: source venv/bin/activate
pip install -r requirements.txt

cp .env.example .env             # isi minimal DJANGO_SECRET_KEY
python manage.py migrate
python manage.py seed_demo_data  # akun + data demo, aman diulang
python manage.py runserver 0.0.0.0:7860
```

Cek: `curl http://localhost:7860/health` harus mengembalikan `{"status":"ok"}`.

Tanpa Supabase, kosongkan `DATABASE_URL` di `.env` dan backend otomatis memakai SQLite lokal.

**2. Frontend**

```bash
cd frontend
cp .env.local.example .env.local  # NEXT_PUBLIC_BACKEND_URL=http://localhost:7860
npm install
npm run dev
```

Buka http://localhost:3000 lalu login dengan akun demo di atas.

Detail lanjutan ada di [backend/README.md](./backend/README.md), [frontend/README.md](./frontend/README.md), dan [ai_experiment/README.md](./ai_experiment/README.md).

## Sistem di Dalamnya

### Alur pengguna

Dosen membuat kelas, membagikan kode gabung, membuat tugas beserta target level Bloom, menerima submission yang sudah dianalisis otomatis, meninjau bukti, menjadwalkan verifikasi verbal bila perlu, lalu memberi nilai.

Mahasiswa bergabung lewat kode kelas, mengerjakan tugas dengan proses pengerjaan terekam, boleh merevisi selama tenggat belum lewat dan belum dinilai, lalu melihat nilai, umpan balik, dan perkembangan penalarannya. Mahasiswa tidak pernah melihat skor AI tentang dirinya.

### Lapisan analisis

Dua mesin yang saling bebas dan tidak pernah membaca hasil satu sama lain:

| Mesin | Keluaran | Berkas |
|---|---|---|
| E1, indikasi AI | Skor 0-100 beserta rincian kontribusi tiap sinyal | `ai_score.py`, `detector.py`, `process_signals.py` |
| E2, level Bloom | Level C1-C6 beserta keyakinan dan bukti | `bloom.py` |
| E4, profil kognitif | Tren level Bloom per kelas | `cognitive.py` |
| Agregasi dan laporan | Peta kelas, sebaran Bloom, tren kohort, laporan lintas kelas | `overview.py`, `reports.py` |

Skor AI punya tiga lapis, level Bloom hanya dua. Skor AI diambil dari detektor eksternal Winston; kalau ia diam, dari Groq; kalau itu pun gagal, dari heuristik lokal. Level Bloom tidak pernah menyentuh detektor, dan itu dijaga uji otomatis yang membaca kode lewat AST.

Skor E1 disusun dari lima sinyal teks dan satu sinyal proses:

| Sinyal | Bobot | Yang diukur |
|---|---|---|
| Forensik proses | 0,25 | Durasi, revisi, porsi tempelan, pertumbuhan kata |
| Keseragaman kalimat | 0,30 | Variasi panjang kalimat |
| Frasa formulaik | 0,19 | Kepadatan frasa transisi khas LLM |
| Keragaman kosakata | 0,19 | Jarak TTR dari titik tengah wajar |
| Ketiadaan suara personal | 0,04 | Sudut pandang pribadi dan contoh konkret |
| Kepastian datar | 0,04 | Keraguan dan kualifikasi wajar |

Sinyal forensik proses diberi porsi terbesar karena ia satu-satunya yang tidak membaca teks, sehingga parafrase tidak bisa menghapusnya.

### Fitur utama

- Peta kelas dua sumbu, memisahkan "perlu bantuan" dari "perlu ditanya"
- Panel Asal Skor AI, merinci dari mana tiap poin skor berasal
- Linimasa pengerjaan berupa kurva pertumbuhan kata
- Ritme kalimat sebagai bukti gaya menulis
- Verifikasi verbal, mencatat hasil sesi tanya jawab tanpa mengubah skor AI
- Profil kognitif, tren level penalaran lintas tugas
- Laporan agregat per kelas, program studi, dan semester

## Status Validasi

| Aspek | Status |
|---|---|
| Fitur end-to-end dua peran | Lengkap dan berjalan |
| Uji otomatis | 126 tes backend dan 68 tes ai_experiment, semuanya lolos |
| Kalibrasi E1 heuristik | Terukur, ROC-AUC 0,900 pada gold set 999 sampel; bobot sinyal dan ambang band keduanya hasil ukur |
| Detektor eksternal Winston | Tersambung, belum diukur pada teks Indonesia |
| Level Bloom E2 | Berjalan, belum divalidasi penilai manusia |

ROC-AUC 0,900 diukur pada abstrak akademik, sedangkan produk ini menilai esai mahasiswa. Angka itu sah untuk membandingkan antar-detektor, tetapi bukan akurasi ThinkPath pada esai mahasiswa. Metodologi dan cara mereproduksinya ada di [ai_experiment/README.md](./ai_experiment/README.md).

## Filosofi Produk

1. Bukan menghukum, tapi memberi visibilitas. Tujuannya membantu dosen menemukan siapa yang butuh percakapan, bukan menyusun daftar tersangka.
2. Tidak ada satu skor pun yang jadi vonis. Setiap penanda selalu disertai bukti yang bisa dijelaskan dan dibantah.
3. Kesimpulan tetap milik manusia. Hasil verifikasi verbal sengaja tidak dialirkan balik ke skor, supaya skor yang keliru tidak bisa membenarkan dirinya sendiri.

---

DataDigger, Universitas Bina Nusantara

GEMASTIK XIX 2026, Pengembangan Perangkat Lunak
