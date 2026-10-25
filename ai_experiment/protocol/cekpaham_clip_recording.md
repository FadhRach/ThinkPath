# Protokol merekam klip uji ASR (Cek Paham)

Tujuan: mengukur WER ASR pada suara yang mirip pemakaian sebenarnya, bukan memercayai angka vendor.
Dipakai oleh `notebooks/06_cekpaham_asr_dan_penilai.ipynb` (bagian A).

## Yang direkam

20–30 klip, masing-masing 30–90 detik, dengan campuran:

| Dimensi | Variasi yang diminta |
|---|---|
| Bahasa (`language`) | Indonesia dan Inggris, minimal 8 klip per bahasa |
| Perangkat (`device`) | laptop, hp (mikrofon bawaan), dan satu earphone/headset bila ada |
| Kebisingan (`noise`) | tenang, sedang (kipas, TV pelan), berisik (kafe/lorong) |
| Gaya (`style`) | `spontan` (menjelaskan dari kepala, ini yang terpenting), `baca` (membaca teks) |
| Hening (`style=silence`) | 2–3 klip 10–20 detik tanpa bicara (ruangan sepi dan sedikit derau), untuk mengukur halusinasi |

Libatkan lebih dari satu penutur bila memungkinkan, dengan izin tertulis dari tiap penutur. **Rekaman
dan referensi tidak boleh masuk git** (`data/asr_clips/` sudah di `.gitignore`); yang dibagikan cukup
`results/asr_report.md`.

## Isi ucapan

Soal yang menyerupai Cek Paham: minta penutur menjelaskan alasan memilih suatu pendekatan pada tugasnya
sendiri (struktur data, metode penelitian, dsb.). Sengaja sertakan **istilah teknis** (mis. "rekursi",
"hash map", "kompleksitas n log n", "metode kualitatif", "binary search tree") karena itulah yang paling
sering salah dengar dan paling berpengaruh pada penilaian.

## Berkas

```
data/asr_clips/
  manifest.csv
  k01.m4a  k02.webm  k03.wav ...      # nama berkas = clip_id; .wav .webm .ogg .mp4 .m4a .mp3
```

`manifest.csv` (kolom persis seperti ini; contoh di `protocol/asr_manifest.example.csv`):

| Kolom | Isi |
|---|---|
| `clip_id` | pengenal unik, sama dengan nama berkas |
| `language` | `id` atau `en` |
| `device`, `noise`, `style` | nilai dari tabel di atas |
| `duration_s` | durasi audio dalam detik (untuk RTF) |
| `reference_text` | transkrip kata demi kata hasil ketikan manusia; kosong untuk klip `silence` |
| `keyterms` | istilah kunci yang diucapkan, dipisah `|` (untuk recall istilah) |

## Aturan menulis `reference_text`

1. Tulis **persis yang diucapkan**, termasuk kata yang salah ucap. Jangan merapikan tata bahasa.
2. Huruf besar dan tanda baca boleh bebas (dinormalisasi), kata pengisi ("eh", "mmm") **tidak** ditulis.
3. **Angka ditulis sebagai digit** ("5 orang", "n log n" ditulis "n log n"). Skrip tidak mengubah angka
   menjadi kata; menulis "lima" membuat model yang benar menulis "5" terhitung salah.
4. Nama dan istilah asing ditulis sebagaimana lazimnya ("hash map", "binary search tree").
5. Idealnya dua orang mengetik referensi lalu merekonsiliasi; bila satu orang, catat itu di laporan.

## Menjalankan

```bash
cp .env.example .env            # GROQ_API_KEY
```

Lalu jalankan bagian A di `notebooks/06_cekpaham_asr_dan_penilai.ipynb` (`ADAPTERS` memilih model, `LIMIT_KLIP` membatasi jumlah klip).

`faster-whisper-small` butuh `pip install faster-whisper` (model ±460 MB) dan dijalankan di CPU; ia ada
untuk menjawab apakah self-host layak di VPS 2 core / 2 GB. Perkirakan RTF > 1 di CPU kecil, artinya
lebih lambat dari waktu nyata.

## Membaca hasil

- Pilih model dari WER **spontan** berbahasa Indonesia dengan recall istilah yang baik, bukan dari klip `baca`.
- Lihat kolom halusinasi: "mentah → disaring" menunjukkan seberapa besar filter produksi menolong.
- Kelompok dengan klip < 5 tidak punya interval kepercayaan; jangan menarik kesimpulan dari sana.
