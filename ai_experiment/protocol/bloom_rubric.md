# Rubrik pelabelan level Bloom untuk jawaban mahasiswa

Rubrik ini dipakai penilai manusia untuk memberi label C1 sampai C6 pada jawaban
esai mahasiswa. Label itu menjadi kebenaran acuan untuk mengukur E2.

## Yang membedakan rubrik ini dari rubrik Bloom yang beredar

Hampir semua dataset dan rubrik Bloom yang ada melabeli **soal**, bukan
**jawaban**. Perbedaannya besar dan menentukan.

| | Rubrik soal | Rubrik ini |
|---|---|---|
| Yang dinilai | Apa yang **diminta** pertanyaan | Apa yang **ditunjukkan** jawaban |
| Contoh | "Bandingkan A dan B" selalu C4 | Jawaban atas soal itu bisa C1 kalau mahasiswa cuma mendaftar ciri A dan ciri B tanpa membandingkan |

**Soal C4 tidak menjamin jawaban C4.** Justru selisih itulah yang ingin diukur
ThinkPath. Jangan pernah melihat soalnya untuk memutuskan level jawabannya.

## Aturan dasar

**1. Beri label pada level TERTINGGI yang benar benar ditunjukkan.**
Bloom bersifat menumpuk. Jawaban yang menganalisis pasti juga memahami. Yang
dicari adalah puncaknya, bukan rata rata.

**2. Bukti harus ada di dalam teks.**
Jangan menyimpulkan dari topiknya, dari nama mata kuliahnya, atau dari kesan
bahwa "mahasiswa ini pasti paham". Kalau alasannya tidak tertulis, alasannya
tidak ada.

**3. Kalau ragu antara dua level bersebelahan, pilih yang LEBIH RENDAH.**
Aturan konservatif ini yang paling menentukan kesepakatan antar penilai. Tanpa
aturan ini, dua penilai yang sama sama ragu akan menebak ke arah berbeda dan
kappa jatuh. Catat keraguannya di kolom `catatan`.

**4. Panjang bukan kriteria, tapi tetap membatasi.**
Jawaban panjang tidak otomatis level tinggi. Tetapi jawaban tiga kalimat memang
jarang punya ruang untuk menunjukkan evaluasi bertingkat. Nilai isinya, bukan
jumlah katanya.

**5. Kefasihan bahasa bukan kriteria.**
Tulisan berantakan yang memuat penalaran sebab akibat tetap C4. Tulisan rapi
yang cuma mendaftar tetap C1. Ini penting karena mahasiswa menulis dengan
kemampuan bahasa yang berbeda beda.

**6. Jangan menilai benar atau salahnya.**
Analisis yang penalarannya keliru tetap C4. Yang dinilai adalah **jenis proses
berpikirnya**, bukan ketepatan isinya. Nilai akademik diberikan terpisah.

## Enam level

### C1 Mengingat

Mengulang informasi dari ingatan tanpa mengolahnya.

**Tanda:** menyebutkan definisi seperti di buku, mendaftar istilah, menuliskan
ulang isi catatan, menyalin urutan tanpa menjelaskan.

**Bukan C1 kalau:** mahasiswa menjelaskan dengan kalimatnya sendiri.

> Kebijakan subsidi energi terdiri atas tiga komponen, yaitu komponen fiskal,
> komponen distribusi, dan komponen administratif. Ketiganya disebutkan dalam
> materi kuliah.

### C2 Memahami

Menjelaskan ulang dengan bahasa sendiri, memberi contoh, atau merangkum.

**Tanda:** parafrase, "artinya", "dengan kata lain", contoh yang menerangkan
konsep, ringkasan yang menata ulang isi.

**Bukan C3 kalau:** konsepnya belum dipakai pada kasus tertentu.

> Subsidi energi pada dasarnya adalah cara pemerintah menahan harga supaya
> masyarakat tetap sanggup membeli. Misalnya harga aslinya sepuluh ribu, tetapi
> yang dibayar masyarakat hanya tujuh ribu, sisanya ditanggung negara.

### C3 Menerapkan

Memakai konsep atau prosedur pada satu kasus tertentu.

**Tanda:** menghitung, menjalankan langkah pada data nyata, menerapkan kerangka
pada situasi konkret, "kalau dihitung dengan rumus itu hasilnya".

**Bukan C4 kalau:** cuma menjalankan prosedur tanpa menguraikan hubungan
antarbagian atau membandingkan.

> Dengan memakai kerangka penargetan dari materi, saya coba terapkan pada data
> desa tempat KKN saya. Jumlah penerimanya 340 keluarga, tetapi yang memenuhi
> kriteria pendapatan hanya 210. Berarti ada 130 yang menerima di luar kriteria.

### C4 Menganalisis

Menguraikan menjadi bagian, menunjukkan hubungan sebab akibat, membandingkan,
atau mengidentifikasi faktor.

**Tanda:** "karena", "akibatnya", "sehingga" yang benar benar menghubungkan dua
hal, pembandingan yang menyebut persamaan dan perbedaan, penjelasan **mengapa**
sesuatu terjadi.

**Bukan C5 kalau:** tidak ada penilaian atau keberpihakan yang disertai alasan.

> Subsidi menjaga daya beli, tetapi distribusinya regresif karena konsumsi bahan
> bakar terkonsentrasi pada kelompok menengah atas. Akibatnya instrumen yang sama
> menghasilkan efek berlawanan, tergantung desain penyalurannya. Berbeda dengan
> kasus di kelas, faktor luar di sini justru dominan.

### C5 Mengevaluasi

Memberi penilaian **disertai alasan atau kriteria**, atau menimbang beberapa
pilihan.

**Tanda:** "menurut saya lebih tepat ... karena", menimbang kelebihan dan
kekurangan lalu menyimpulkan, mengkritik dengan dasar, mengakui batas
argumennya sendiri.

**Bukan C5 kalau:** ada pendapat tanpa alasan. "Menurut saya kebijakan ini
buruk" tanpa lanjutan **bukan** C5. Beri label sesuai penalaran yang ada di
bawahnya.

> Dari kedua pendekatan itu, transfer langsung lebih tepat sasaran, tetapi hanya
> kalau basis datanya mutakhir. Karena di daerah tempat saya KKN datanya masih
> 2019, saya menilai subsidi harga justru lebih aman untuk sekarang. Kelemahan
> penilaian saya, dasarnya hanya satu daerah.

### C6 Mencipta

Menyusun sesuatu yang baru: rancangan, usulan, atau sintesis yang tidak
diberikan di materi.

**Tanda:** "saya usulkan", rancangan alur atau instrumen buatan sendiri,
menggabungkan beberapa konsep menjadi kerangka baru.

**Bukan C6 kalau:** usulannya cuma mengulang rekomendasi yang sudah ada di
bacaan.

> Saya usulkan skema dua tahap: tahun pertama subsidi harga tetap jalan sambil
> memutakhirkan basis data lewat posyandu, tahun kedua baru beralih ke transfer
> langsung. Skema ini menggabungkan kelebihan keduanya dan tidak ada di bacaan
> yang kami pakai.

## Kode khusus

Selain C1 sampai C6, ada satu kode:

**X, tidak dapat dinilai.** Dipakai untuk jawaban kosong, jawaban di luar topik,
atau jawaban terlalu pendek sehingga tidak ada yang bisa dinilai (di bawah
sekitar 30 kata).

**Jangan memaksakan jawaban tak layak ke C1.** Nanti C1 tercemar dan sistem
belajar bahwa "pendek" berarti "mengingat", padahal maksudnya "tidak ada data".

## Pohon keputusan

Baca berurutan, berhenti pada jawaban "ya" pertama dari bawah.

```
Apakah ada usulan atau rancangan baru?              -> C6
Apakah ada penilaian YANG DISERTAI alasan?          -> C5
Apakah ada sebab akibat atau pembandingan nyata?    -> C4
Apakah konsep dipakai pada kasus tertentu?          -> C3
Apakah dijelaskan dengan bahasa sendiri?            -> C2
Apakah hanya mengulang dari ingatan?                -> C1
Tidak ada yang bisa dinilai?                        -> X
```

## Kesalahan yang sering terjadi

| Kesalahan | Kenapa salah |
|---|---|
| Melihat soalnya lebih dulu | Soal C4 tidak menjamin jawaban C4. Justru selisihnya yang diukur |
| Menaikkan level karena tulisannya bagus | Kefasihan bukan level kognitif |
| Menaikkan ke C5 karena ada kata "menurut saya" | Pendapat tanpa alasan bukan evaluasi |
| Menaikkan ke C4 karena ada kata "karena" | Harus benar benar menghubungkan dua hal, bukan sekadar muncul |
| Memaksa jawaban kosong ke C1 | Pakai X |
| Menurunkan level karena isinya salah | Yang dinilai proses berpikirnya, bukan kebenarannya |
| Berdiskusi dengan penilai lain saat melabeli | Merusak kesepakatan yang mau diukur |

## Setelah melabeli

Jangan langsung membandingkan hasil. Ikuti [labeling_sop.md](./labeling_sop.md).
