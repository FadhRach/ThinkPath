# ThinkPath

**Sistem Verifikasi Pemahaman Berbasis Proses untuk Integritas Akademik Mahasiswa**

ThinkPath membantu dosen menjawab pertanyaan yang tidak bisa dijawab alat deteksi AI biasa: mahasiswa mana yang paling layak diajak bicara lebih dulu. Alih-alih memberi satu skor "AI atau bukan", ThinkPath merekam proses pengerjaan (durasi, pertumbuhan kata, dan revisi), mengukur level penalaran jawaban dengan Taksonomi Bloom, lalu menyajikan keduanya sebagai bukti yang bisa ditinjau dosen, bukan vonis.

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
| Dosen | `dosen@thinkpath.local` | 2 kelas, 10 tugas, 64 submission teranalisis, 16 materi dalam 11 topik, 3 sesi verifikasi verbal |
| Mahasiswa | `mhs01@thinkpath.local` s.d. `mhs08@thinkpath.local` | 8 mahasiswa dengan lintasan Bloom dan cara mengerjakan berbeda; `mhs07` punya undangan sesi diskusi di halaman Jadwal |

Cara mengerjakan di data demo direkam seperti di produksi, yaitu cuplikan jumlah kata tiap 30 detik, bukan angka karangan: empat mahasiswa menulis bertahap, dua sebagian besar mengetik dengan satu kutipan pendek, dan dua memunculkan seluruh jawaban sekaligus lalu mengumpulkan. Sebaran band yang dihasilkan: 32 rendah, 16 sedang, 16 tinggi. Lonceng notifikasi kedua peran juga sudah terisi.

Untuk peninjauan cepat, login sebagai dosen dan buka halaman Overview. Saat pertama masuk, setiap akun diminta membaca dan menyetujui [Kebijakan Privasi](https://thinkpath.vercel.app/kebijakan-privasi) lebih dulu.

## Tech Stack

| Layer | Teknologi | Deploy |
|---|---|---|
| Frontend | Next.js 15 (App Router), TypeScript, Tailwind, shadcn/ui, Recharts | Vercel |
| Backend | Django 5.2 LTS + DRF, PyJWT, psycopg, gunicorn | VPS IDCloudHost (Jakarta), Docker Compose + Caddy |
| Database | PostgreSQL 17 | Container di VPS yang sama; lokal memakai Postgres terpasang |
| Analisis AI | Winston AI, Groq `openai/gpt-oss-120b`, heuristik lokal | - |
| Auth | Email + password, JWT HS256 diterbitkan Django | - |

## Struktur Project

```
thinkpath/
├── frontend/        Next.js 15, antarmuka dosen dan mahasiswa
├── backend/         Django 5 + DRF, satu-satunya API untuk semua data
├── ai_experiment/   Validasi dan kalibrasi lapisan analisis
└── diagram/         Diagram arsitektur, alur peran, design system, ERD (Mermaid)
```

Frontend tidak pernah menyentuh database langsung:

```
Browser -> Next.js (Vercel) -> Caddy -> Django + DRF -> PostgreSQL   (VPS)
                                         |
                                         +-> Analisis: Winston -> Groq (AI as a Judge) -> heuristik
```

## Setup Lokal

Prasyarat: Python 3.12+, Node.js 20+, dan PostgreSQL 15+ yang menyala dengan database `thinkpath` (macOS: `brew services start postgresql@18 && createdb thinkpath`; OS lain lihat [backend/README.md](./backend/README.md#menjalankan-di-lokal)).

Backend dan frontend dijalankan di dua terminal terpisah.

Terminal 1, backend (http://127.0.0.1:7860):

```bash
cd backend
python3 -m venv venv && source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env                 # Windows: isi POSTGRES_USER=postgres + password
python manage.py migrate
python manage.py seed_demo_data      # akun + data demo, aman diulang
python manage.py runserver 127.0.0.1:7860
```

Terminal 2, frontend (http://localhost:3000):

```bash
cd frontend
cp .env.local.example .env.local
npm install
npm run dev
```

Backend juga bisa dijalankan dengan Docker, baik di laptop maupun di VPS; lihat [backend/README.md](./backend/README.md).

Aplikasi selalu memakai PostgreSQL (runserver, Docker, maupun VPS). Satu-satunya pengecualian adalah tes otomatis (`python manage.py test`), yang memakai SQLite in-memory agar tidak pernah menyentuh database sungguhan.

Detail lanjutan ada di [backend/README.md](./backend/README.md), [frontend/README.md](./frontend/README.md), dan [ai_experiment/README.md](./ai_experiment/README.md).

## Deploy

Frontend (`thinkpath.vercel.app`) di-deploy otomatis oleh Vercel dari `main`. Backend dan PostgreSQL berjalan di VPS IDCloudHost (Jakarta) dengan Docker Compose: `db` (PostgreSQL 17), `api` (gunicorn), dan `caddy` (HTTPS otomatis). Di VPS, `make deploy` menarik `main`, membangun ulang image, dan menjalankan migrasi saat container mulai.

Runbook lengkap (menyiapkan server, DNS, `.env`, backup harian, rollback) ada di [backend/README.md](./backend/README.md#deploy-produksi-vps).

## Sistem di Dalamnya

### Alur pengguna

Dosen membuat kelas, membagikan kode gabung dan materi, membuat tugas beserta target level Bloom, menerima submission yang sudah dianalisis otomatis, meninjau bukti, menjadwalkan verifikasi verbal bila perlu, lalu memberi nilai.

Mahasiswa bergabung lewat kode kelas, membaca materi, mengerjakan tugas dengan proses pengerjaan terekam, boleh merevisi selama tenggat belum lewat dan belum dinilai, lalu melihat nilai, umpan balik, dan perkembangan penalarannya. Mahasiswa tidak pernah melihat skor AI tentang dirinya, dan undangan sesi diskusi pun tidak menyebut alasannya.

Materi dan Jadwal sengaja berbentuk berbeda karena cara mencarinya berbeda:

- **Materi** dicari lewat kelas dan pertemuannya. Halaman Materi berisi folder per kelas dan satu kotak pencarian untuk semua kelas. Di dalam kelas, materi dikelompokkan per topik atau pertemuan dan dilengkapi indeks topik yang menempel di samping (di ponsel menjadi deretan chip), mengikuti pola "Tugas Kelas" Google Classroom. Tiap kelas punya alamatnya sendiri (`/student/materi/<kelas>`), dan notifikasi materi baru membuka langsung materinya.
- **Jadwal** dicari lewat tanggal. Bentuknya kalender bulan dan pekan seperti Google Calendar, dengan daftar agenda per hari dan saringan per kelas. Kalender juga bisa dibuka mundur untuk melihat tenggat yang sudah lewat beserta statusnya. Tampilan, tanggal, dan kelas yang dipilih tersimpan di alamat halaman, jadi notifikasi undangan sesi membuka pekan sesinya.

Yang direkam saat mengerjakan hanya jumlah kata tiap 30 detik, bukan isi tulisannya, dan form pengerjaan memberitahukan hal ini sebelum mahasiswa menulis. Tindakan menempel tidak direkam: menempel kutipan dari rujukan itu wajar.

Kedua peran punya lonceng notifikasi: mahasiswa diberi tahu soal tugas dan materi baru, nilai, undangan atau perubahan sesi diskusi, dan tenggat yang tinggal 24 jam; dosen diberi tahu soal pengumpulan baru dan mahasiswa yang bergabung, digabung per tugas supaya tidak membanjiri.

### Privasi dan persetujuan

Sebelum memakai ThinkPath, setiap pengguna membaca ringkasan pemrosesan data dan menyetujui butir-butirnya satu per satu, sesuai UU No. 27 Tahun 2022 tentang Pelindungan Data Pribadi:

- **Mahasiswa** menyetujui tiga butir wajib: data perkuliahan, perekaman proses menulis beserta analisis otomatis, dan pernyataan usia atau izin wali. Butir keempat opsional, yaitu mengizinkan teks jawaban dianalisis Groq (Amerika Serikat) dan Winston AI (Kanada). Tanpa izin itu, jawaban hanya dianalisis heuristik di server ThinkPath.
- **Dosen** menyetujui data akun dan menyatakan tanggung jawabnya: menjaga kerahasiaan data mahasiswa dan tidak menjatuhkan sanksi hanya berdasarkan skor.
- Setiap keputusan dicatat sebagai bukti per versi kebijakan dan tidak pernah ditimpa. Pengguna bisa melihat riwayatnya, mengubah pilihan opsional, dan menarik persetujuan di Pengaturan. Penarikan menghentikan pengumpulan jawaban dan analisis ulang seketika, termasuk dari token lama di perangkat lain.

Isi [Kebijakan Privasi](https://thinkpath.vercel.app/kebijakan-privasi) disusun dari kode yang berlaku dan dari teks resmi undang-undang. Pemetaan tiap pasal ke kode yang melaksanakannya, beserta penilaian dampak awal, ada di [diagram/07-privasi-dan-persetujuan.md](./diagram/07-privasi-dan-persetujuan.md).

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
| Forensik proses | 0,25 | Kurva pertumbuhan kata, atau laju bila kurva tidak terekam; jumlah revisi ditampilkan, tidak diskor |
| Keseragaman kalimat | 0,30 | Variasi panjang kalimat |
| Frasa formulaik | 0,19 | Kepadatan frasa transisi khas LLM |
| Keragaman kosakata | 0,19 | Jarak TTR dari titik tengah wajar |
| Ketiadaan suara personal | 0,04 | Sudut pandang pribadi dan contoh konkret |
| Kepastian datar | 0,04 | Keraguan dan kualifikasi wajar |

Sinyal forensik proses diberi porsi terbesar karena ia satu-satunya yang tidak membaca teks, sehingga parafrase tidak bisa menghapusnya.

Beberapa masukan sengaja diam ketika datanya tidak layak dibaca. Keragaman kosakata netral di bawah 120 kata, panjang minimum gold set: rasio kata unik teks pendek selalu tinggi secara alami, dan memaksakan titik tengah yang diukur pada teks panjang akan mendorong jawaban jujur yang pendek ke band sedang. Jumlah revisi tidak diskor sama sekali, karena yang tercatat hanya tombol Simpan Revisi setelah jawaban dikumpulkan, bukan penyuntingan saat menulis; angkanya tetap ditampilkan ke dosen, seperti jam pengumpulan. Tindakan menempel tidak dibaca sama sekali; jawaban yang seluruhnya muncul sekaligus tetap terlihat dari bentuk kurvanya, sedangkan satu kutipan 60 kata di tengah esai hanya menambah sekitar 4 poin.

### Fitur utama

- Peta kelas dua sumbu, memisahkan "perlu bantuan" dari "perlu ditanya"
- Panel Asal Skor AI, merinci dari mana tiap poin skor berasal
- Linimasa pengerjaan berupa kurva pertumbuhan kata
- Pemberitahuan terbuka ke mahasiswa tentang apa yang direkam saat ia menulis
- Materi kelas tersusun per topik atau pertemuan, dengan pencarian lintas kelas
- Jadwal mahasiswa berbentuk kalender bulan dan pekan: tenggat tugas dan sesi diskusi
- Notifikasi di dalam aplikasi untuk dosen dan mahasiswa
- Kebijakan Privasi dan persetujuan berbasis UU PDP, dengan bukti persetujuan per versi, izin analisis di luar negeri yang bisa dicabut, dan penarikan persetujuan
- Ritme kalimat sebagai bukti gaya menulis
- Verifikasi verbal, mencatat hasil sesi tanya jawab tanpa mengubah skor AI
- Profil kognitif, tren level penalaran lintas tugas
- Laporan agregat per kelas, program studi, dan semester

## Status Validasi

| Aspek | Status |
|---|---|
| Fitur end-to-end dua peran | Lengkap dan berjalan |
| Uji otomatis | 191 tes backend dan 68 tes ai_experiment, semuanya lolos |
| Kalibrasi E1 heuristik | Terukur, ROC-AUC 0,900 pada gold set 999 sampel; bobot sinyal teks dan ambang sedang 42 hasil ukur |
| Ambang tinggi 70 dan bobot forensik proses | Belum terukur; tidak ada sampel gold set yang mencapai 70 |
| Detektor eksternal Winston | Tersambung, belum diukur pada teks Indonesia |
| Level Bloom E2 | Berjalan, belum divalidasi penilai manusia |
| Jawaban di bawah 120 kata | Di luar rentang panjang gold set; sinyal keragaman kosakata dinetralkan di sana |

ROC-AUC 0,900 diukur pada abstrak akademik, sedangkan produk ini menilai esai mahasiswa. Angka itu sah untuk membandingkan antar-detektor, tetapi bukan akurasi ThinkPath pada esai mahasiswa. Metodologi dan cara mereproduksinya ada di [ai_experiment/README.md](./ai_experiment/README.md).

## Filosofi Produk

1. Bukan menghukum, tapi memberi visibilitas. Tujuannya membantu dosen menemukan siapa yang butuh percakapan, bukan menyusun daftar tersangka.
2. Tidak ada satu skor pun yang jadi vonis. Setiap penanda selalu disertai bukti yang bisa dijelaskan dan dibantah.
3. Kesimpulan tetap milik manusia. Hasil verifikasi verbal sengaja tidak dialirkan balik ke skor, supaya skor yang keliru tidak bisa membenarkan dirinya sendiri.

---

DataDigger, Universitas Bina Nusantara

GEMASTIK XIX 2026, Pengembangan Perangkat Lunak
