# ai_experiment

Ruang kerja validasi dan kalibrasi model ThinkPath.

Folder ini **bukan** untuk melatih detektor dari nol. Riset lintas-dataset
menunjukkan model terlatih anjlok begitu ketemu konteks baru, dan tidak ada
korpus jawaban esai Indonesia berlabel Bloom di mana pun. Jalur produksi tetap
memakai LLM.

Yang dikerjakan di sini adalah membayar utang kejujuran: seluruh bobot dan
ambang di `backend/academics/ai_score.py`, `bloom.py`, dan `process_signals.py`
saat ini ditetapkan dari penalaran, bukan dari data. Belum ada yang pernah
mengukur apakah angka itu benar. Uji cepat pada esai akademik tulisan manusia
menghasilkan skor 77 dan masuk band tinggi, yaitu tuduhan palsu. Folder ini
tempat masalah seperti itu ditemukan dan diperbaiki.

## Yang sudah tersedia

| Berkas | Guna |
|---|---|
| `src/build_gold_set.py` | membangun set uji manusia vs AI tanpa anotator |
| `src/evaluate_baseline.py` | mengukur heuristik produksi terhadap set itu |
| `src/metrics.py` | ROC-AUC, FPR, korelasi per sinyal |
| `tests/test_metrics.py` | mengunci kebenaran metrik |

## Cara pakai

```bash
cd ai_experiment
python -m venv .venv
.venv/Scripts/activate          # Linux dan macOS: source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env            # lalu isi GROQ_API_KEY dan OPENALEX_MAILTO
```

Unduh sisi manusia lebih dulu, tidak butuh API key mana pun:

```bash
python -m src.build_gold_set --target 500 --human-only
```

Lanjutkan dengan sisi AI:

```bash
python -m src.build_gold_set --target 500 --include-mixed
```

Hasilnya di `data/gold/gold_set.csv`.

Aman dihentikan di tengah jalan. Hasil sementara ditulis sebagai JSONL di
`data/cache/`, jadi menjalankan ulang akan melanjutkan, bukan mengulang.

### Opsi

| Flag | Guna |
|---|---|
| `--target N` | jumlah abstrak manusia, default 500 |
| `--human-only` | hanya unduh sisi manusia, lewati LLM |
| `--include-mixed` | tambah kelas campuran, teks manusia dipoles AI |
| `--models a,b,c` | daftar model Groq, default tiga model |
| `--split-by work\|field` | strategi pemisahan train dan test |

## Mengukur heuristik yang sudah dipakai produksi

```bash
python -m src.evaluate_baseline
python -m src.evaluate_baseline --split test --mixed-as ai
```

Skrip ini mengimpor scorer asli dari `backend/academics`, bukan salinannya, jadi
laporannya tidak pernah basi diam diam ketika kode produksi berubah.

Yang dilaporkan:

- **ROC-AUC.** Di bawah 0,6 berarti nyaris menebak. Di bawah 0,5 berarti arahnya
  terbalik.
- **FPR pada ambang produksi sekarang** (35 dan 70), yaitu berapa banyak
  mahasiswa jujur yang tertuduh.
- **Ambang yang menjaga FPR di bawah 5 persen.** Inilah cara memilih ambang yang
  bisa dipertanggungjawabkan di depan juri. Memilih 70 karena angkanya bulat
  tidak bisa dijawab.
- **Korelasi tiap sinyal terhadap label**, dengan penanda MATI untuk sinyal yang
  tidak membedakan apa pun dan TERBALIK untuk sinyal yang arahnya melawan label.

Jalankan tes metriknya lebih dulu kalau ragu:

```bash
python -m unittest discover -s tests
```

## Cara labelnya dijamin benar

Sisi manusia diambil dari OpenAlex dengan filter `language:id` dan tanggal
terbit **sebelum 31 Oktober 2022**. ChatGPT rilis 30 November 2022, jadi apa pun
yang terbit sebelumnya dijamin bukan hasil AI generatif. Labelnya datang dari
tanggal terbit, bukan dari penilaian manusia. Tidak ada yang perlu direkrut.

Tersedia lebih dari 1,6 juta karya yang cocok dengan filter ini. Kalian hanya
butuh beberapa ratus.

Sisi AI dibuat sekarang, dengan model 2026. **Filter tanggal hanya berlaku untuk
sisi manusia.** Tulisan manusia tidak berubah sejak 2022, jadi abstrak 2018 sama
manusianya dengan abstrak 2026.

## Empat jebakan yang sudah ditangani

Semuanya membuat hasil evaluasi terlihat lebih bagus daripada kenyataan.

**Kebocoran zaman.** Kalau sisi manusia semuanya pra-2022 dan sisi AI dibuat
sekarang, detektor bisa curang dengan mempelajari perbedaan zaman atau topik,
bukan gaya. Ditangani dengan memberi model **hanya judul** dokumen pra-2022 itu,
sehingga topik terkunci sama di kedua sisi. Model tidak pernah melihat abstrak
aslinya, jadi hasilnya bukan parafrase.

**Kebocoran panjang.** Kalau teks AI sistematis lebih panjang atau lebih pendek,
panjang jadi petunjuk gratis. Ditangani dengan meminta panjang yang sama dengan
abstrak manusianya, dan skrip melaporkan selisih rata rata beserta peringatan
kalau melebihi 30 kata.

**Kebocoran generator.** Kalau seluruh sisi AI lahir dari satu model dan satu
prompt, yang dipelajari detektor adalah jejak prompt itu. Ditangani dengan
memutar tiga model dan empat varian prompt. Kolom `generator` dan
`prompt_variant` disimpan supaya performa per generator bisa dianalisis.

**Kebocoran pasangan.** Abstrak manusia dan padanan AI dari judul yang sama
tidak boleh jatuh di sisi train dan test yang berbeda. Ditangani dengan memisah
berdasarkan `openalex_id`, bukan acak. Pembagiannya deterministik lewat hash,
jadi menjalankan ulang menghasilkan split yang sama.

## Penyaringan mutu

OpenAlex memuat buku yang bidang abstraknya sebenarnya daftar isi. Teks seperti
`Bab 1 : ... Bab 2 : ...` bukan prosa dan akan mengajari detektor hal yang
salah. Disaring lewat `type:article` di sisi API, ditambah pemeriksaan
keprosaan: minimal tiga tanda akhir kalimat, rata rata kalimat di bawah 60 kata,
dan titik dua tidak berlebihan. Panjang dibatasi 120 sampai 400 kata.

## Kolom keluaran

| Kolom | Isi |
|---|---|
| `id` | hash stabil dari sumber, label, dan generator |
| `label` | `human`, `ai`, atau `mixed` |
| `text` | teks abstrak |
| `title` | judul, sama di kedua sisi pasangan |
| `year` | tahun terbit, kosong untuk baris AI |
| `field` | bidang ilmu dari OpenAlex |
| `word_count` | jumlah kata |
| `generator` | model pembuat, kosong untuk baris manusia |
| `prompt_variant` | varian prompt yang dipakai |
| `split` | `train` atau `test` |

## Temuan dari uji jalan pertama

Angka di bawah berasal dari **24 sampel saja**, jadi ini bukti bahwa alatnya
bekerja, **bukan hasil yang boleh dikutip**. Rentang galatnya sangat lebar.

Yang sudah terlihat dan layak diperiksa ulang pada skala penuh:

- Ambang produksi sekarang meleset di kedua arah. Pada ambang 35, lebih dari
  separuh teks manusia tertuduh. Pada ambang 70, tidak ada satu pun teks AI yang
  tertangkap. Tidak ada sampel yang mencapai skor 70, sehingga band tinggi
  praktis tidak pernah aktif pada teks akademik.
- `impersonality` muncul sebagai sinyal mati, nilainya identik di kedua kelas.
- `mechanical_polish` justru termasuk sinyal terkuat pada korpus ini, padahal
  dugaan awal menyebutnya mati. Dugaan itu berasal dari dua esai buatan tangan,
  dan data membantahnya. Ini alasan mengapa tahap ini ada.

## Catatan operasional soal generator

`qwen/qwen3.6-27b` tidak dipakai secara bawaan. Model itu menuliskan proses
berpikirnya lebih dulu dalam bahasa Inggris **tanpa tag** `<think>`, sehingga
tidak bisa dibersihkan berdasarkan tag, dan keluarannya membengkak sampai lima
kali panjang yang diminta. `gemma2-9b-it` yang sempat ada di daftar bawaan juga
sudah dihentikan penyedianya.

Karena itu skrip memeriksa katalog model sebelum mulai, dan melewati nama yang
sudah tidak dilayani. Tanpa pemeriksaan itu, satu nama basi membuat sebagian
sampel gagal diam diam dan sebaran generator jadi timpang tanpa terlihat.

Tiga penjaga umum bekerja terlepas dari model mana yang dipakai: keluaran yang
didominasi kata fungsi bahasa Inggris ditolak, keluaran di bawah 50 kata
ditolak, dan sampel yang panjangnya tetap meleset lebih dari dua kali toleransi
setelah satu koreksi akan dibuang.

## Batasan yang harus ditulis di naskah

Abstrak ilmiah **bukan** esai tugas mahasiswa. Registernya lebih formal dan
strukturnya lebih baku. Set ini sah untuk mengukur apakah sinyal-sinyal kita
bekerja pada teks akademik Indonesia, tetapi angkanya tidak boleh diklaim
berlaku untuk jawaban tugas tanpa uji lanjutan.

Sisi AI seluruhnya berasal dari model yang dilayani Groq. Menambah generator
dari keluarga lain akan memperkuat kesimpulan.

## Berikutnya

Tahap 1 adalah menjalankan heuristik yang sudah ada di `backend/academics`
terhadap `gold_set.csv`, bersama beberapa detektor publik, lalu menghitung
korelasi tiap sinyal terhadap label. Dari situ ketahuan sinyal mana yang mati
dan mana yang arahnya terbalik.

## Catatan lama yang masih berlaku

- Eksplorasi awal di notebook, pindahkan ke `.py` setelah matang.
- Jangan jadikan Binoculars sebagai dependency runtime, butuh GPU.
