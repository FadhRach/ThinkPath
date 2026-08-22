# Diagram ThinkPath

Enam berkas, seluruhnya memakai Mermaid sehingga **langsung tampil di GitHub**
tanpa perkakas tambahan.

| Berkas | Isi |
|---|---|
| [01 · Arsitektur Sistem](./01-arsitektur-sistem.md) | Peta lapisan, perjalanan satu permintaan, lapisan analisis, susunan penempatan |
| [02 · Interaksi dengan Dosen](./02-alur-dosen.md) | Perjalanan dosen, peta kelas empat kuadran, alur meninjau submission, verifikasi verbal |
| [03 · Interaksi dengan Mahasiswa](./03-alur-mahasiswa.md) | Perjalanan mahasiswa, batas yang ditampilkan, perekaman jejak, daur hidup submission |
| [04 · Interaksi Gabungan](./04-interaksi-gabungan.md) | Siklus penuh satu tugas, pembagian wewenang, tindak lanjut per kuadran, model data |
| [05 · Alur Analisis](./05-alur-analisis.md) | Pipeline, rantai tiga lapis skor AI, E1, sinyal proses, E2, E4, dan cara validasi diukur |
| [06 · Design System](./06-design-system.md) | Token warna, tipografi, hierarki komponen, pola visualisasi data |

## Cara membaca

Semua diagram ditulis dalam blok ```mermaid. GitHub, GitLab, Obsidian, dan
VS Code dengan ekstensi Mermaid merendernya otomatis. Untuk menyalin ke slide
atau dokumen, tempelkan kode blok itu ke [mermaid.live](https://mermaid.live)
lalu ekspor sebagai PNG atau SVG.

## Versi Figma

Ke-28 diagram di sini juga tersedia sebagai objek FigJam yang bisa diedit:
[board ThinkPath](https://www.figma.com/board/2p1N9xOxblT6cmILJvV8g3). Isinya
dibagi menjadi enam section yang namanya mengikuti keenam berkas di folder ini.

Tiga hal berbeda di versi Figma karena keterbatasan perendernya:

- `quadrantChart` pada 02.2 tidak didukung, jadi diubah menjadi flowchart
- `Note over` pada diagram sekuens dibuang, isinya dipindah ke kotak biasa
- markup `<br/>` dan `<b>` diganti pemisah titik tengah

Berkas Markdown di folder ini tetap sumber kebenaran. Bila kode berubah,
perbarui Markdown lebih dulu, baru regenerasi board Figma.

## Yang perlu dijaga

Diagram ini menggambarkan kode yang benar-benar ada, termasuk batasnya.
Beberapa hal yang **sengaja** ditampilkan apa adanya:

- E2 level Bloom belum divalidasi penilai manusia, dan seluruh keluaran yang
  bertumpu padanya mewarisi ketidakpastian itu
- Ambang heuristik 42 sudah terukur, tetapi ambang tinggi 70 belum, dan ambang
  detektor eksternal 35/70 masih angka sementara
- ROC-AUC 0,901 diukur pada abstrak akademik, bukan pada esai mahasiswa
- Telemetri sisi klien menaikkan biaya kecurangan, bukan menghilangkannya
- Menu Materi, Jadwal, dan mesin dialog Socratic belum dibangun

Bila kode berubah, berkas di sini ikut diperbarui. Diagram yang tidak lagi
sesuai kode lebih buruk daripada tidak ada diagram sama sekali.
