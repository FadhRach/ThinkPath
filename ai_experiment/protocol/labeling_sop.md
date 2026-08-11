# Prosedur pelabelan

Cara kerja penilai dari awal sampai angka siap dipakai di naskah.

## Kenapa prosedurnya seketat ini

Yang diukur bukan cuma "apakah mesin benar", tetapi juga **apakah manusia
sendiri sepakat**. Kalau dua penilai membaca esai yang sama dan separuh waktu
tidak sepakat C3 atau C4, berarti tugasnya sendiri kabur, dan tidak ada mesin
yang bisa mengalahkan itu.

Konsekuensinya berjalan dua arah:

- Manusia sepakat 65%, mesin dapat 60%. Mesin **hampir menyentuh langit langit
  manusia**. Melaporkan 60% sebagai kegagalan justru keliru.
- Manusia sepakat 90%, mesin dapat 60%. Ini kesenjangan nyata yang harus
  diperbaiki.

Tanpa angka kesepakatan antar manusia, angka akurasi mesin tidak bisa
ditafsirkan sama sekali.

## Siapa yang melabeli

Minimal **dua penilai yang bekerja terpisah**. Idealnya dosen. Kalau tidak
memungkinkan, anggota tim boleh menjadi penilai, **asalkan batasannya ditulis
terus terang di naskah**: penilainya mahasiswa, bukan pengampu mata kuliah.

Itu batasan yang jujur dan lazim untuk proyek mahasiswa. Yang tidak jujur adalah
menyembunyikannya.

## Langkah

### 1. Siapkan berkas

Satu berkas CSV berisi jawaban yang akan dilabeli, minimal dua kolom:

```csv
id,text
sub-001,"Sejauh ini yang saya pahami dari materi ..."
sub-002,"Secara fundamental, kebijakan tersebut ..."
```

Kolom lain boleh ada dan akan diabaikan. **Jangan sertakan kolom yang memuat
soal, nama mahasiswa, atau hasil analisis sistem.** Penilai tidak boleh
melihatnya, karena itu akan mengarahkan penilaian.

### 2. Bagikan ke tiap penilai

Tiap penilai mendapat salinan berkas yang sama. Mereka membuka
`tools/label.html` dengan klik ganda, memuat CSV-nya, lalu melabeli.

Alat itu berjalan sepenuhnya di browser tanpa server dan tanpa internet. Tidak
ada yang perlu dipasang.

### 3. Aturan selama melabeli

- **Jangan berdiskusi** sampai kedua penilai selesai. Diskusi di tengah jalan
  merusak justru angka yang mau diukur.
- **Jangan melihat keluaran sistem.** Kalau sudah tahu tebakan mesin, penilaian
  ikut terseret.
- Kerjakan maksimal **sekitar 50 jawaban per sesi**. Setelah itu ketelitian
  turun dan penilai cenderung memilih level yang sama berulang kali.
- Waktu wajar sekitar **2 sampai 3 menit per jawaban**. Kalau jauh lebih cepat,
  kemungkinan tidak benar benar dibaca.

### 4. Kalibrasi awal, wajib

Sebelum melabeli seluruhnya, **kedua penilai melabeli 20 jawaban yang sama lebih
dulu**, lalu berhenti dan hitung kappa-nya:

```bash
python -m src.evaluate_bloom --raters data/labels/penilai1.csv data/labels/penilai2.csv
```

- Kappa di bawah 0,4: **jangan lanjut.** Bacalah bersama jawaban yang berbeda
  penilaiannya, perbaiki rubriknya, lalu ulangi dengan 20 jawaban baru.
- Kappa 0,4 sampai 0,6: bisa lanjut, tetapi bahas dulu pola ketidaksepakatannya.
- Kappa di atas 0,6: lanjutkan ke seluruh berkas.

Langkah ini yang paling sering dilewati orang, dan paling sering membuat seluruh
pekerjaan pelabelan terbuang.

### 5. Labeli seluruhnya

Target realistis:

| Jumlah | Beban per orang | Keterangan |
|---|---|---|
| 100 sampai 150 | sekitar 3 jam | Minimum. Rentang galat lebar tetapi jauh lebih baik daripada nol |
| 300 | sekitar 8 jam | Angka mulai bisa dipertahankan |
| 500 | sekitar 13 jam | Nyaman, tetapi bukan syarat |

### 6. Selesaikan ketidaksepakatan

Setelah keduanya selesai, jalankan lagi perintah evaluasi. Ia akan menuliskan
daftar jawaban yang berbeda penilaiannya.

Untuk tiap ketidaksepakatan, pilih salah satu:

- Kedua penilai berdiskusi sampai sepakat, lalu label itu yang dipakai.
- Penilai ketiga memutuskan.
- Ambil yang lebih rendah, mengikuti aturan konservatif rubrik.

**Catat cara mana yang dipakai**, karena itu bagian dari metodologi yang harus
ditulis di naskah.

### 7. Ukur sistemnya

```bash
python -m src.evaluate_bloom --raters data/labels/penilai1.csv data/labels/penilai2.csv --gold data/labels/konsensus.csv
```

Keluarannya: kappa antar penilai, F1 makro sistem, matriks konfusi, dan rincian
per level.

## Yang ditulis di naskah

Laporkan keempatnya sekaligus. Tanpa salah satu, angkanya tidak bisa
ditafsirkan.

1. Jumlah sampel dan siapa penilainya
2. **Cohen's kappa antar penilai**, biasa dan berbobot kuadratik
3. F1 makro sistem terhadap label konsensus
4. Cara ketidaksepakatan diselesaikan

Contoh kalimat yang bisa dipertahankan:

> Dua penilai melabeli 300 jawaban mahasiswa secara terpisah memakai rubrik enam
> level. Kesepakatan antar penilai mencapai kappa 0,6x, dan kappa berbobot
> kuadratik 0,7x. Terhadap label konsensus, E2 mencapai F1 makro 0,6x. Selisih
> antara performa mesin dan langit langit manusia sebesar 0,0x menunjukkan bahwa
> sebagian besar kesalahan mesin berada pada kasus yang manusia sendiri
> memperdebatkannya.

## Kenapa kappa berbobot ikut dilaporkan

Level Bloom bersifat **berurutan**, bukan kategori lepas. Kappa biasa
memperlakukan ketidaksepakatan C3 lawan C4 sama beratnya dengan C1 lawan C6,
padahal yang pertama nyaris sepakat dan yang kedua bertolak belakang.

Kappa berbobot kuadratik menghukum selisih jauh lebih berat daripada selisih
dekat. Untuk skala berurutan, itulah ukuran yang benar. Laporkan keduanya:
kappa biasa untuk pembanding dengan literatur, kappa berbobot untuk gambaran
yang jujur.
