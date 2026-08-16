# ThinkPath

Platform integritas akademik untuk dosen di perguruan tinggi Indonesia. Berbeda dari Turnitin/ZeroGPT yang hanya memberi satu skor "AI atau bukan", ThinkPath merekam proses berpikir mahasiswa dan menyajikan beberapa sinyal sebagai **bukti yang dapat ditinjau dosen, bukan vonis**.

Status: **Perangkat lunak lengkap, model belum tervalidasi.** Auth, kelas dan
tugas, pengumpulan dan revisi, analisis, verifikasi verbal, profil kognitif,
laporan agregat, serta layar Overview berbasis grafik sudah jalan end-to-end
untuk dua peran. Yang belum ada adalah angka akurasi: lihat
[Status kalibrasi](#status-kalibrasi) sebelum mengutip klaim apa pun.

Kalau Anda meninjau proyek ini dan hanya punya waktu untuk satu layar, buka
**Overview dosen**. Peta kelas di sana memetakan tiap mahasiswa pada dua sumbu,
dugaan AI dan selisih level Bloom terhadap target. Pemisahan dua sumbu itulah
seluruh argumen produk ini: himpunan "perlu bantuan" dan himpunan "dicurigai"
sering tidak beririsan, dan alat yang hanya memberi satu skor kecurigaan tidak
akan pernah menunjukkannya.

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
| E1 detektor eksternal | `detector.py` | skor teks 0 sampai 1 dari detektor terlatih, atau diam bila gagal |
| Cache detektor | `detector_cache.py` | teks yang sama tidak pernah dibayar dua kali; penyedia menagih per kata |
| E2 level Bloom | `bloom.py` | level C1 sampai C6 plus keyakinan dan bukti |
| E4 profil kognitif | `cognitive.py` | tren level Bloom per kelas, rata rata bergerak eksponensial |
| Agregasi kelas | `overview.py` | sebaran dua sumbu, distribusi Bloom, tren kohort |
| Laporan lintas kelas | `reports.py` | kesenjangan kognitif per kelas, prodi, semester |
| Orkestrator | `analysis.py` | menggabungkan keduanya, membandingkan ke target dosen |
| Rantai jalur | `llm.py` | detektor eksternal, lalu Groq, lalu heuristik |

**Skor AI punya tiga lapis, level Bloom hanya dua.** Skor AI diambil dari
detektor eksternal; kalau ia diam, dari `ai_probability` Groq; kalau itu pun
gagal, dari heuristik. Level Bloom tidak pernah menyentuh detektor sama sekali.

Detektor dipasang sebagai lapisan yang **menimpa** hasil yang sudah jadi, bukan
sebagai cabang di tengah alur. Bentuk itu dipilih supaya taksiran Bloom mustahil
tercemar secara struktural: tidak ada jalur kode yang bisa membawa skor detektor
ke sana, jadi dekoplingnya tidak bergantung pada kedisiplinan siapa pun.

Sinyal forensik proses tetap dipakai dan tetap berbobot 0,25 walaupun skornya
datang dari detektor. Detektor mana pun membaca teks, dan apa pun yang membaca
teks bisa dikalahkan parafrase.

### Kenapa penyedianya bisa berganti, dan kenapa namanya generik

Berkasnya bernama `detector.py`, bukan `winston.py`, dan `analysis_source`
menyimpan `"detector"`, bukan nama penyedia. Itu pelajaran yang dibayar:

**Integrasi pertama memakai Sapling dan dibatalkan sebelum sempat diukur.**
Detektor AI Sapling **English-only**. Bahasa Indonesia memang muncul di daftar
Sapling, tetapi di produk *spelling*-nya, bukan di detektornya. Memasangnya di
produk yang menilai esai berbahasa Indonesia berarti menilai teks dengan model
yang tidak mengenal bahasanya, dan angkanya akan tetap terlihat masuk akal.

Aturan yang lahir dari situ: **periksa daftar bahasa penyedia lebih dulu, dari
dokumentasi API-nya sendiri, bukan dari halaman pemasarannya.** Winston
mencantumkan `id` di enum parameter `language` pada dokumentasi API-nya.

Nama penyedia dan versi modelnya tetap tercatat per baris di dalam
`signal_breakdown`, jadi skor lama masih bisa ditelusuri asalnya tanpa
mengubah skema tiap kali penyedia berganti.

Satu jebakan yang dikunci tes: **Winston mengembalikan "human score"**, arahnya
berlawanan. 0 berarti hampir pasti AI, 100 berarti hampir pasti manusia.
Pembalikannya dikerjakan tepat sekali di `detector.py`. Kalau hilang, mahasiswa
yang menulis sendiri justru mendapat skor AI tertinggi, dan angkanya cukup masuk
akal untuk berjalan berbulan bulan tanpa ketahuan.

E4 memakai rata rata bergerak eksponensial, bukan rata rata biasa. Yang ingin
dijawab adalah "mahasiswa ini ada di level mana sekarang", bukan "berapa rata
ratanya sepanjang semester": yang naik dari C1 ke C4 tidak sedang berada di C2.
Arah tren tidak disebut sebelum ada tiga titik, karena dua titik hanya membentuk
garis antara dua titik.

Tiga aturan yang tidak boleh dilanggar, dijaga oleh 113 tes di
`backend/academics/tests/`. Uji dekopling membacanya lewat AST, bukan lewat
pencocokan teks, supaya menambahkan `import ai_score` ke dalam `bloom.py` akan
langsung menggagalkan tes alih alih lolos diam diam:

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

Sudah diukur pada gold set 999 sampel: 500 abstrak manusia berbahasa Indonesia
terbit sebelum November 2022, dan 499 teks AI dari tiga model berbeda.
Reproduksi:

```bash
cd ai_experiment
python -m src.build_gold_set --target 500
python -m src.evaluate_baseline --gold data/gold/gold_set.csv
```

**ROC-AUC 0,869.** Ensemble sinyalnya memang membedakan, jauh di atas tebakan
acak.

**Ambang produksi sekarang meleset jauh di dua arah, dan ini terkonfirmasi:**

| Ambang | Presisi | Recall | FPR |
|---|---|---|---|
| `mid` skor >= 35 (lama) | 0,540 | 0,986 | **0,838** |
| `mid` skor >= 56 (dipakai sekarang) | 0,932 | 0,489 | 0,036 |
| `high` skor >= 70 | 1,000 | **0,006** | 0,000 |

Pada 35, **84 persen tulisan manusia ikut tertuduh** dan presisinya setara
lempar koin. Pada 70, praktis tidak ada teks yang pernah mencapainya. Ambang
yang menjaga FPR di bawah 5 persen adalah **56**, dengan recall 0,489 dan FPR
0,036 — 18 dari 500 tulisan manusia tetap tertuduh. **Sejak 16 Agustus 2026
angka itulah yang dipakai produksi**, lihat alasannya di bawah.

**Tiga dari lima sinyal teks diam sepanjang pengukuran ini, dan itu artefak,
bukan vonis.** `formulaic_phrasing`, `impersonality`, dan `flat_certainty`
mengandalkan penanda suara pribadi, keraguan, dan frasa khas LLM. Gold set ini
berisi **abstrak akademik**, yang menurut konvensinya impersonal dan tegas,
sedangkan produk ini menilai **esai mahasiswa**. Ketidakcocokannya soal jenis
tulisan, bukan soal bahasa: gold set memang berbahasa Indonesia.

Selisihnya besar, diukur pada gold set dibandingkan jawaban mahasiswa:

| Penanda | Abstrak akademik | Esai mahasiswa |
|---|---|---|
| personal | 0,210 per teks | 1,859 per teks |
| hedging | 0,040 per teks | 1,906 per teks |
| llm_phrase | 0,035 per teks | 0,844 per teks |

Abstrak nyaris tidak pernah menulis "menurut saya" atau "tampaknya". Yang
terukur bukan "sinyalnya buruk", melainkan "sinyalnya tidak diuji".

**Dua sinyal yang bebas bahasa memikul seluruh angka 0,869, dan keduanya sahih:**

| Sinyal | Korelasi | Manusia | AI |
|---|---|---|---|
| `uniformity` (burstiness) | -0,566 | 0,498 | 0,276 |
| `lexical_uniformity` | +0,440 | 0,249 | 0,491 |

Keduanya bertahan setelah panjang teks disamakan. Pada pita 150 sampai 220 kata
dengan rata rata kedua kelas sama persis 181 kata, korelasinya justru menguat
(+0,497 dan -0,559), jadi bukan panjang teks yang menyamar sebagai sinyal.

Satu keputusan desain terbukti benar oleh data: `lexical_uniformity` mengukur
**jarak dari titik tengah 0,62**, bukan nilai TTR mentah. TTR mentah berkorelasi
-0,014 terhadap label, yaitu tidak ada sama sekali; jaraknya dari 0,62
berkorelasi +0,440. Teks manusia berkerumun di sekitar 0,62 sementara teks AI
menyimpang ke dua arah, persis seperti alasan yang ditulis di
`_signal_lexical_uniformity`.

**Yang TIDAK boleh diklaim dari angka ini.** ROC-AUC 0,869 berlaku untuk
**abstrak akademik dengan dua dari lima sinyal aktif**. Ia bukan akurasi
ThinkPath pada esai mahasiswa.

Bukti bahwa sebarannya memang berbeda: satu jawaban esai berbahasa Indonesia
yang ditulis tangan mendapat skor 19, jauh di bawah ambang mana pun yang dibahas
di sini.

#### Kenapa ambang akhirnya digeser 35 ke 56

Keputusan ini sempat berbunyi sebaliknya, dan alasan pembalikannya layak
ditulis lengkap.

Argumen menahan: ambang 56 terukur pada abstrak akademik sementara produk ini
menilai esai mahasiswa, dan menyalin ambang antar register memang menyesatkan.

Yang membatalkan argumen itu: **35 juga bukan hasil ukur.** Ia ditulis dari
penalaran sebelum ada satu pun pengukuran. Jadi pilihannya bukan antara angka
terukur dan angka aman, melainkan antara angka terukur pada register yang salah
dan angka yang tidak pernah diukur sama sekali. Yang pertama tetap lebih banyak
informasinya.

Yang menentukan arahnya: **arah biasnya bisa diketahui, bukan ditebak.** Abstrak
akademik menurut konvensinya lebih formal, lebih impersonal, dan lebih seragam
daripada esai mahasiswa. Tulisan manusia di gold set karena itu mendapat skor
lebih TINGGI daripada tulisan manusia yang sebenarnya dinilai produk ini.
Ambang yang menahan FPR pada korpus yang lebih sulit akan bersikap lebih
longgar, bukan lebih ketat, ketika dipakai pada esai mahasiswa. Kesalahannya
jatuh ke arah tidak menuduh.

Harganya recall: **0,489 pada 56, turun dari 0,986 pada 35.** Pertukaran itu
disengaja. Sistem ini tidak memvonis, ia mengurutkan siapa yang paling layak
diajak bicara lebih dulu, dan daftar yang memuat 84 persen kelas tidak
mengurutkan apa pun.

`HIGH_THRESHOLD` 70 **tidak** ikut digeser dan masih belum terukur: tidak ada
satu pun sampel gold set yang mencapainya, jadi tidak ada data untuk
menempatkannya. Ambang detektor eksternal di `detector.py` juga tidak ikut
bergerak, karena sebaran skornya berbeda bentuk dan belum pernah diukur.
Keduanya dijaga `academics/tests/test_thresholds.py`.

Langkah yang benar berikutnya adalah gold set dengan **register esai
mahasiswa**, bukan abstrak akademik. Menambah abstrak berapa pun banyaknya
tidak akan pernah menguji ketiga sinyal yang diam itu.

Perkakas untuk memperbaikinya ada di [`ai_experiment/`](./ai_experiment/README.md).

### Status kalibrasi detektor eksternal

**Belum diukur.** Detektor sudah tersambung di jalur produksi dan mati secara
default (`WINSTON_API_KEY` kosong berarti perilakunya persis seperti sebelum ia
ada), tetapi belum ada satu pun angka yang membandingkannya terhadap heuristik
pada teks berbahasa Indonesia.

Sampai angka itu ada, tidak boleh ada klaim bahwa detektor berbayar lebih
akurat. Yang boleh dikatakan hanya: skornya berasal dari detektor yang memang
dilatih untuk tugas ini dan **mengaku** mendukung bahasanya, sedangkan heuristik
kita ditulis dari penalaran. Klaim penyedia bukan hasil ukur.

Dua hal yang belum terjawab dan keduanya penting:

1. **Dukungan bahasa Indonesia masih klaim penyedia.** Winston mencantumkan
   `id` di enum `language` dokumentasi API-nya, tetapi tidak menerbitkan angka
   per bahasa. Riset yang mendasari kehati hatian di `ai_score.py` berlaku di
   sini juga: detektor teks AI menandai penulis non-native jauh lebih sering
   daripada penulis native, dan pada korpus multibahasa M4GT-Bench performa
   untuk bahasa Indonesia berada jauh di bawah bahasa Inggris.
2. **Ambang bandnya masih pinjaman.** `MID_THRESHOLD` dan `HIGH_THRESHOLD` di
   `detector.py` sementara diisi 35 dan 70, angka yang berasal dari sebaran skor
   heuristik dan tidak ada alasan berlaku untuk sebaran detektor terlatih.
   Keduanya ditandai sebagai titik awal di dalam kode, bukan hasil ukur.

Cara mengisinya:

```bash
cd ai_experiment
python -m src.evaluate_detector --limit 40
```

Skrip itu menilai detektor dan heuristik pada **subset yang sama persis**, lalu
melaporkan ROC-AUC keduanya berdampingan dan ambang yang menjaga FPR di bawah
5 persen. Membandingkan angka detektor pada 40 sampel terhadap angka 0,869 di
atas tidak sah, dan godaannya besar karena angkanya sudah ada.

Kalau hasilnya menunjukkan detektor **tidak** mengungguli heuristik, langkah
yang benar adalah mencabut integrasinya, bukan menggeser ambang sampai angkanya
terlihat bagus. Detektor berbayar yang tidak lebih baik daripada heuristik
gratis hanya menambah satu titik kegagalan.

Perhatikan juga bahwa ketidakcocokan register di atas berlaku sama persis untuk
pengukuran ini. Gold setnya tetap abstrak akademik, bukan esai mahasiswa.

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

- Dosen: `dosen@thinkpath.local`, punya 2 kelas, 10 tugas, 64 submission beranalisis.
  Delapan mahasiswa seed masing masing punya lintasan Bloom sendiri (menaik,
  mendatar, menurun) supaya grafik tren memperlihatkan sesuatu yang nyata, dan
  satu tugas per kelas sengaja dibiarkan masih berjalan supaya alur pengumpulan
  bisa dicoba.
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
   menganalisis jawaban (`backend/academics/llm.py`). Skor AI diambil dari
   detektor eksternal kalau `WINSTON_API_KEY` diisi, jatuh ke Groq kalau `GROQ_API_KEY`
   diisi, lalu ke heuristik kalau keduanya kosong atau gagal. Level Bloom hanya
   dari Groq atau heuristik.
5. **Mahasiswa bisa melihat & merevisi jawabannya sendiri selama tenggat belum
   berakhir dan belum dinilai.** Revisi memperbarui jawaban yang sama (tidak
   menumpuk duplikat), menaikkan `revision_count`, dan memicu analisis ulang.
   Skor AI tidak ditampilkan ke mahasiswa, hanya jawaban, status, nilai, umpan balik.
6. Dosen membuka detail submission: probabilitas AI + bar, panel **Asal Skor AI**
   yang merinci kontribusi tiap sinyal, level Bloom beserta keyakinannya
   sendiri, penanda asal analisis (LLM, cadangan heuristik, atau data demo),
   jam mulai dan jam pengumpulan, jumlah kata, daftar sinyal, ringkasan, jumlah
   revisi, tombol Analisis Ulang, dan form penilaian.
7. Kalau dosen ingin menindaklanjuti, ia menjadwalkan **verifikasi verbal** dari
   panel di halaman submission, lalu mencatat kesimpulannya setelah berbicara.
   Kesimpulan itu **tidak pernah mengubah skor AI**, dan pilihan kesimpulannya
   sengaja tidak memuat "terbukti menyontek". Antreannya ada di
   `/dashboard/verifikasi`.
8. Nama mahasiswa di tabel submission menuju **profil kognitif**
   (`/dashboard/students/<id>`): tren level Bloom per kelas, level saat ini,
   arah, dan selisih terhadap target. Mahasiswa melihat versi dirinya sendiri di
   `/student/progres`, **tanpa kolom indikasi AI**.
9. `/dashboard/laporan` merangkum seluruh kelas berdasarkan kesenjangan kognitif
   lebih dulu, bukan berdasarkan skor AI.
10. Mahasiswa melihat status tugasnya berubah menjadi "Dinilai" beserta nilai dan
    umpan balik dosen.
11. Tombol **Keluar** menghapus sesi dan kembali ke `/login`.

Peta rute lengkap:

| Peran | Rute | Isi |
|---|---|---|
| Dosen | `/dashboard` | Overview: peta kelas dua sumbu, sebaran Bloom, tren kohort |
| Dosen | `/dashboard/classes` | Daftar kelas dan kode gabung |
| Dosen | `/dashboard/tugas` | Seluruh tugas lintas kelas |
| Dosen | `/dashboard/verifikasi` | Antrean dan riwayat verifikasi verbal |
| Dosen | `/dashboard/laporan` | Laporan agregat per kelas, prodi, semester |
| Dosen | `/dashboard/students/<id>` | Profil kognitif seorang mahasiswa |
| Dosen | `/dashboard/submission/<id>` | Bukti lengkap satu jawaban plus linimasa proses |
| Mahasiswa | `/student` | Beranda, tugas aktif, nilai |
| Mahasiswa | `/student/tugas` | Daftar tugas dan tenggat |
| Mahasiswa | `/student/progres` | Perkembangan level penalaran, tanpa skor AI |

Menu **Materi** dan **Jadwal** sengaja dibiarkan nonaktif, bukan diisi tampilan
kosong. Keduanya butuh model backend yang belum ada, dan menu yang bisa diklik
tetapi tidak melakukan apa apa lebih menyesatkan daripada menu yang jujur
menyatakan dirinya belum jadi.

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
python manage.py test academics       # 104 tes lapisan analisis

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
| `WINSTON_API_KEY` | kunci detektor eksternal, opsional. Kosong berarti skor AI memakai jalur Groq lalu heuristik |

Saat `DEBUG=0`, flag keamanan (HTTPS redirect, HSTS, secure cookie, proxy SSL
header) aktif otomatis. Detail di [`backend/README.md`](./backend/README.md).

**Frontend (Vercel)**: import folder `frontend/`, set
`NEXT_PUBLIC_BACKEND_URL=https://namaspace.hf.space`. Detail di
[`frontend/README.md`](./frontend/README.md).

## Urutan deploy (bagian yang menjegal)

Backend dan frontend saling menyebut alamat satu sama lain, dan itu melingkar:
Space butuh `CORS_ALLOWED_ORIGINS` berisi URL Vercel, sedangkan Vercel butuh
`NEXT_PUBLIC_BACKEND_URL` berisi URL Space. Tidak ada urutan yang bisa
menyelesaikannya dalam sekali jalan, jadi lakukan tiga langkah, bukan dua.

1. **Deploy backend lebih dulu** ke Hugging Face Space bertipe Docker. Isi
   semua secret kecuali `CORS_ALLOWED_ORIGINS`, yang untuk sementara boleh
   diisi `http://localhost:3000`. Catat URL-nya: `https://<space>.hf.space`.
2. **Deploy frontend** ke Vercel dengan root direktori `frontend/` dan
   `NEXT_PUBLIC_BACKEND_URL` menunjuk URL Space tadi. Catat URL Vercel-nya.
3. **Kembali ke Space**, ubah `CORS_ALLOWED_ORIGINS` menjadi URL Vercel, lalu
   restart. Tanpa langkah ketiga ini setiap permintaan dari frontend akan
   ditolak CORS, dan gejalanya menyesatkan: halaman termuat tetapi semua data
   kosong, seolah olah backend mati padahal ia menolak dengan sengaja.

`NEXT_PUBLIC_BACKEND_URL` ikut ter-bake saat build, jadi mengubahnya di Vercel
menuntut **redeploy**, bukan sekadar restart. Variabel berawalan `NEXT_PUBLIC_`
memang dimasukkan ke bundel browser saat build; jangan pernah menaruh rahasia
di variabel berawalan itu.

Setelah ketiganya hidup, isi data demo supaya ada yang bisa dilihat peninjau:

```bash
python manage.py seed_demo_data
```

Perintah itu idempotent, jadi menjalankannya dua kali tidak menggandakan apa pun.

## Filosofi produk (jangan dilanggar)

- Tujuannya **bukan menghukum** mahasiswa karena pakai AI, tujuannya memberi dosen visibilitas + feedback presisi.
- **Tidak ada satu skor pun yang jadi vonis.** Setiap flag selalu disertai bukti yang bisa dijelaskan.
- Fokus pada mahasiswa, bukan anak di bawah umur, sehingga persetujuan partisipan lebih sederhana. Privasi dan framing yang tidak menuduh tetap requirement, bukan opsi.
