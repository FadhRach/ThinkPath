# ai_experiment

Ruang kerja validasi dan kalibrasi model ThinkPath. **Bukan** untuk melatih detektor dari nol: riset
lintas-dataset menunjukkan model terlatih anjlok di konteks baru, dan tidak ada korpus jawaban esai Indonesia
berlabel Bloom. Produksi tetap memakai rantai LLM dan heuristik; folder ini mengukur seberapa benar
bobot dan ambang di `backend/apps/analysis/engines/`.

Seluruh eksperimen disajikan sebagai **notebook bertahap** di [`notebooks/`](./notebooks). Urutannya
adalah alurnya: tiap notebook menjawab satu pertanyaan, dan hasilnya menjadi masukan notebook berikutnya.

| Notebook | Pertanyaan |
|---|---|
| [`00_ringkasan_dan_alur`](./notebooks/00_ringkasan_dan_alur.ipynb) | Gambaran alur, status prasyarat tiap tahap, hasil yang pernah tercatat |
| [`01_gold_set`](./notebooks/01_gold_set.ipynb) | Label manusia vs AI tanpa anotator, dan empat jebakan kebocoran |
| [`02_baseline_heuristik`](./notebooks/02_baseline_heuristik.ipynb) | ROC-AUC, mahasiswa jujur yang tertuduh (FPR), ambang aman, sinyal mati/terbalik |
| [`03_tuning_bobot`](./notebooks/03_tuning_bobot.ipynb) | Bobot sinyal dari data, tanpa membocorkan test |
| [`04_rantai_llm_dan_detektor`](./notebooks/04_rantai_llm_dan_detektor.ipynb) | Apakah lapisan Groq dan detektor berbayar mengungguli heuristik? |
| [`05_validasi_bloom`](./notebooks/05_validasi_bloom.ipynb) | Kesepakatan antar penilai (langit-langit) lalu akurasi E2 |
| [`06_cekpaham_asr_dan_penilai`](./notebooks/06_cekpaham_asr_dan_penilai.ipynb) | Model ASR dan penilai jawaban lisan terhadap manusia |

Tahap yang butuh data, kunci API, atau label manusia melewati dirinya sendiri dengan pesan jelas bila
prasyaratnya belum ada; `00` menampilkan statusnya.

## Memulai

```bash
cd ai_experiment
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env          # OPENALEX_MAILTO (opsional), GROQ_API_KEY, WINSTON_API_KEY
jupyter lab notebooks         # atau buka .ipynb di VS Code
python -m unittest discover -s tests
```

Mulai dari `01_gold_set`. Sisi manusia hanya butuh internet; sisi AI butuh `GROQ_API_KEY`.

## Isi folder

```
notebooks/   alur eksperimen (sumber utama; keluaran terakhir ikut tersimpan)
src/         pustaka yang dipanggil notebook: config, openalex, generate, build_gold_set,
             evaluation (cache, sampel seimbang), metrics, agreement, viz, evaluate_*, tune_weights, asr/
tests/       tes alat ukur: metrics, agreement (kappa), WER, cache dan sampel, pembersih generator,
             penilai Cek Paham, percobaan ulang Groq
protocol/    rubrik Bloom, SOP pelabelan, protokol rekaman klip ASR, pelabelan penilai Cek Paham
tools/       label.html: antarmuka pelabelan luring (klik ganda, tanpa server)
data/        gold set, cache skor, label, rekaman (tidak masuk git)
```

`src/` memanggil kode produksi asli dari `backend/apps/analysis` (lewat `bootstrap_backend()`), bukan
salinannya, jadi angka tidak pernah basi diam-diam. Hasil panggilan berbayar disimpan di `data/cache/`
berkunci nama model dan versi; menjalankan ulang tidak membayar dua kali dan aman dihentikan di tengah.

## Aturan yang dijaga

* Perbandingan antar-mesin hanya pada **subset yang sama persis**.
* Test tidak disentuh saat mencari bobot atau ambang; hanya angka test yang boleh dikutip.
* FPR (mahasiswa jujur yang tertuduh) lebih penting daripada recall.
* Bila sebuah lapisan tidak mengungguli heuristik, **cabut lapisannya**; jangan menggeser ambang.
* Abstrak ilmiah bukan esai mahasiswa: angka di sini sah untuk membandingkan sinyal pada teks akademik
  Indonesia, bukan sebagai klaim akurasi pada jawaban tugas.
* Rekaman suara, sesi berlabel, dan label penilai memuat data pribadi; tidak masuk git.
