# ThinkPath — Backend

Django 5 + Django REST Framework. **Satu-satunya API** untuk seluruh data ThinkPath (profil, kelas, tugas, submission, analisis). Frontend tidak pernah menyentuh database langsung.

> Panduan menyeluruh proyek ada di [README utama](../README.md).

---

## Menjalankan Lokal

```bash
python -m venv venv
venv\Scripts\activate            # macOS/Linux: source venv/bin/activate
pip install -r requirements.txt

cp .env.example .env             # isi minimal DJANGO_SECRET_KEY
python manage.py migrate
python manage.py seed_demo_data  # akun + data demo (idempotent)
python manage.py runserver 0.0.0.0:7860
```

Cek: `curl http://localhost:7860/health` harus mengembalikan `{"status":"ok"}`.

**Akun demo** (password `thinkpath123`):
`dosen@thinkpath.local` · `mhs01@thinkpath.local` s.d. `mhs08@thinkpath.local`

**Tanpa Supabase:** kosongkan `DATABASE_URL` di `.env`, backend otomatis memakai SQLite lokal (`db.sqlite3`).

**Menjalankan tes:**

```bash
python manage.py test            # 177 tes (analisis, auth, detektor, ambang, bukti proses, materi, jadwal, notifikasi)
```

---

## Arsitektur

**Dua app:** `core` (identitas + autentikasi) dan `academics` (kelas, tugas, submission, analisis). `thinkpath` adalah package settings/urls.

**Identitas dikelola sendiri.** Bukan `django.contrib.auth.User`, melainkan tabel `profiles` (`core.models.Profile`) dengan password ter-hash. Login menerbitkan **JWT HS256** yang ditandatangani `DJANGO_SECRET_KEY`, berisi klaim `sub` (UUID profil), `email`, dan `role`. Verifikasi token murni di memori — nol query database per request.

**Analisis dijalankan sinkron** saat submit lewat `academics.llm.run_analysis`:

```
Skor AI     : Winston (detector.py) -> Groq (ai_probability) -> heuristik (ai_score.py)
Level Bloom :                          Groq                  -> heuristik (bloom.py)
```

Kunci yang kosong atau API yang gagal cukup menjatuhkan ke lapisan berikutnya — tidak pernah menggagalkan pengumpulan tugas. **Level Bloom tidak pernah menyentuh detektor**, dan itu dijaga uji AST, bukan sekadar konvensi.

Dua jebakan yang dikunci tes:

- **Winston mengembalikan _human score_** (0 = AI, 100 = manusia). Pembalikannya dikerjakan **tepat sekali** di `detector.py`. Kalau hilang atau terjadi dua kali, mahasiswa yang menulis sendiri justru mendapat skor AI tertinggi — dan angkanya tetap terlihat masuk akal.
- **Detektor berbayar per kata**, jadi skornya disimpan di tabel `detector_scores` (`detector_cache.py`). Kunci cache memuat versi model, sehingga menaikkan versi otomatis membatalkan skor lama.

---

## Model Data

| Model | Tabel | Catatan |
|---|---|---|
| `Profile` | `profiles` | email unik, password hash, `role` teacher/student |
| `Class` | `classes` | milik dosen, `join_code` unik, `education_level`, `program_studi`, `semester` |
| `ClassMembership` | `class_memberships` | keanggotaan mahasiswa (unik per kelas) |
| `Assignment` | `assignments` | `deadline`, `expected_bloom_level` (1–6). Jenjang diwarisi dari kelas |
| `Submission` | `submissions` | `status` draft/submitted/reviewed, `revision_count`, `grade` |
| `ReasoningEvent` | `reasoning_events` | jejak proses: started/progress/revision/submitted (paste hanya di baris lama, tidak lagi ditulis) |
| `Material` | `materials` | materi kelas: `topic` (topik/pertemuan, kosong = umum), judul, ringkasan, tautan http/https |
| `Notification` | `notifications` | notifikasi per penerima; `group_key` menggabungkan yang sejenis, `read_at` status dibaca |
| `AnalysisResult` | `analysis_results` | OneToOne submission: `ai_score`, `ai_band`, `bloom_level`, `signals` |
| `VerbalVerification` | `verbal_verifications` | jadwal & hasil sesi tanya jawab |
| `DetectorScore` | `detector_scores` | cache skor detektor eksternal per hash teks |

Jenjang, program studi, dan semester **melekat di kelas**, bukan di profil mahasiswa (semester mahasiswa berubah tiap enam bulan, sedangkan kelas permanen berstatus "semester 3") dan bukan di tugas (duplikasi kolom pernah memungkinkan tugas S2 tersimpan di kelas S1).

---

## Endpoint

Semua di bawah `/api` dan butuh `Authorization: Bearer <token>`, kecuali yang ditandai publik.

| Method | Path | Akses | Fungsi |
|---|---|---|---|
| GET | `/health` | publik | health check |
| POST | `/api/auth/register` | publik | daftar, balikan token + profil |
| POST | `/api/auth/login` | publik | login, balikan token + profil |
| GET/PATCH | `/api/me` | login | profil sendiri |
| GET/POST | `/api/classes` | dosen | daftar / buat kelas |
| GET/POST | `/api/classes/<id>/assignments` | dosen pemilik | daftar / buat tugas |
| GET | `/api/assignments` | dosen | seluruh tugas lintas kelas |
| GET | `/api/overview` | dosen | agregat layar Overview |
| GET | `/api/reports/overview` | dosen | laporan per kelas, prodi, semester |
| GET | `/api/students/<id>/profile` | dosen pengampu | profil kognitif mahasiswa |
| GET | `/api/verifications` | dosen | antrean verifikasi verbal |
| POST | `/api/join` | mahasiswa | gabung kelas via join code |
| GET | `/api/student/classes` | mahasiswa | kelas diikuti + status tiap tugas |
| GET | `/api/student/progress` | mahasiswa | perkembangan kognitif sendiri |
| GET | `/api/student/assignments/<id>` | mahasiswa anggota | detail tugas + submission sendiri |
| GET/POST | `/api/assignments/<id>/submissions` | GET dosen, POST mahasiswa | daftar / **submit atau revisi** |
| GET/PATCH | `/api/submissions/<id>` | dosen pemilik | detail / beri nilai + umpan balik |
| POST | `/api/submissions/<id>/reanalyze` | dosen pemilik | analisis ulang |
| PUT/DELETE | `/api/submissions/<id>/verification` | dosen pemilik | jadwalkan / catat / hapus verifikasi |
| GET/POST | `/api/classes/<id>/materials` | dosen pemilik | daftar / bagikan materi |
| PATCH/DELETE | `/api/materials/<id>` | dosen pemilik | ubah (tanpa notifikasi ulang) / hapus materi |
| GET | `/api/student/materials` | mahasiswa | materi dari seluruh kelas yang diikuti |
| GET | `/api/student/schedule` | mahasiswa | agenda yang akan datang; dengan `start` & `end`, seluruh agenda di rentang itu |
| GET | `/api/notifications` | login | 30 notifikasi terbaru + jumlah belum dibaca |
| POST | `/api/notifications/read` | login | tandai dibaca (`ids`, atau semua bila kosong) |

### Submit & revisi

`POST /api/assignments/<id>/submissions` bersifat **upsert per mahasiswa**:

- Submission pertama membuat baris baru (`revision_count = 0`). Body: `text_answer`, `started_at`, dan `progress` (cuplikan jumlah kata). Tindakan menempel tidak direkam; kolom `pastes` dari form lama diabaikan.
- Submission berikutnya, selama tenggat belum lewat dan belum dinilai, **memperbarui jawaban yang sama**: `revision_count += 1`, menambah `ReasoningEvent(revision)`, dan memicu analisis ulang yang **memakai ulang cuplikan tersimpan**. Jumlah revisi ditampilkan di bukti, tidak diskor.
- Setelah tenggat lewat atau setelah dinilai dosen, ditolak dengan `400`.

**Skor AI dan sinyal tidak pernah diekspos ke mahasiswa** (`StudentSubmissionStatusSerializer`). Daftar tugas mahasiswa juga tidak mengirim `text_answer` demi menekan ukuran respons — teks lengkap hanya ada di endpoint detail.

### Materi dan jadwal

`topic` adalah teks bebas seperti topik Google Classroom, misalnya "Pertemuan 3: Desain kualitatif". Spasi berlebih dirapikan supaya satu topik tidak terpecah menjadi dua kelompok. Pengurutan dan pengelompokan dilakukan frontend (materi umum dulu, lalu urutan alami: Pertemuan 2 sebelum Pertemuan 10).

`GET /api/student/schedule?start=<ISO>&end=<ISO>` dipakai kalender. Kedua waktu wajib berzona, rentangnya paling panjang 62 hari (satu tampilan bulan paling banyak enam pekan). Batas hari dihitung frontend pada zona tampilan, jadi backend tetap tidak perlu tahu zona kampus. Rentang ini ikut memuat tenggat yang sudah lewat dan sesi yang sudah berlangsung (`status: "done"`, tanpa kesimpulannya); sesi yang dibatalkan tidak dimuat. Tiap agenda membawa `class_id` untuk saringan per kelas.

### Notifikasi

Dikirim setelah aksi utamanya tersimpan, dan kegagalannya tidak pernah menggagalkan aksi itu (`notifications.services.safe`). Pengumpulan untuk tugas yang sama digabung selama belum dibaca. Pengingat tenggat 24 jam dibuat saat mahasiswa membuka lonceng, bukan oleh penjadwal, karena backend tidak punya cron; tiap tugas hanya diingatkan sekali, dan constraint unik `notif_deadline_once` menjaganya walau dua permintaan lonceng tiba bersamaan. Notifikasi ke mahasiswa tidak pernah menyebut indikasi AI, termasuk undangan sesi diskusi. Notifikasi materi baru menaut langsung ke materinya (`/student/materi/<kelas>#materi-<id>`).

---

## Environment

| Var | Wajib | Default | Keterangan |
|---|---|---|---|
| `DJANGO_SECRET_KEY` | ya (prod) | fallback dev saat DEBUG | menandatangani JWT |
| `DJANGO_DEBUG` | – | `0` | set `1` untuk dev |
| `DJANGO_ALLOWED_HOSTS` | ya (prod) | `localhost,127.0.0.1` | host yang diizinkan |
| `CORS_ALLOWED_ORIGINS` | ya (prod) | `http://localhost:3000` | origin frontend |
| `DATABASE_URL` | – | SQLite kalau kosong | connection string Postgres |
| `DB_CONN_MAX_AGE` | – | `0` | **set `60`** agar koneksi dipakai ulang; ke DB remote, tiap koneksi baru membayar handshake TCP+TLS ~150–400 ms |
| `GROQ_API_KEY` | – | kosong = heuristik | kunci analisis LLM |
| `GROQ_MODEL` | – | `llama-3.3-70b-versatile` | model Groq |
| `WINSTON_API_KEY` | – | kosong = jalur Groq | kunci detektor eksternal, memengaruhi skor AI saja |
| `AUTH_TOKEN_LIFETIME_DAYS` | – | `7` | umur token |

---

## Deploy: Hugging Face Spaces (Docker)

`Dockerfile` sudah siap (`python:3.11-slim`, `EXPOSE 7860`, gunicorn). `.dockerignore` mencegah `.env` dan `db.sqlite3` ikut ter-bake ke image.

1. Buat Space bertipe **Docker**, push folder `backend/`.
2. Isi **Secrets** (jangan di Dockerfile): `DJANGO_SECRET_KEY`, `DJANGO_DEBUG=0`, `DJANGO_ALLOWED_HOSTS=<space>.hf.space`, `CORS_ALLOWED_ORIGINS=https://<app>.vercel.app`, `DATABASE_URL`, `DB_CONN_MAX_AGE=60`, `GROQ_API_KEY`, `WINSTON_API_KEY`.
3. Saat `DEBUG=0`, `DJANGO_SECRET_KEY` wajib (boot gagal keras kalau kosong) dan flag keamanan (SSL redirect, HSTS, secure cookie, proxy SSL header) aktif otomatis.
4. HF free tier tidur setelah ~48 jam idle — pasang cron eksternal yang ping `/health` kalau perlu selalu hidup.

**Urutan deploy yang menjegal.** Backend butuh URL Vercel di `CORS_ALLOWED_ORIGINS`, sementara Vercel butuh URL Space di `NEXT_PUBLIC_BACKEND_URL`. Ketergantungannya melingkar, jadi lakukan tiga langkah: deploy backend dulu dengan `CORS_ALLOWED_ORIGINS=http://localhost:3000` sementara, deploy frontend memakai URL Space, lalu kembali ke Space dan isi `CORS_ALLOWED_ORIGINS` dengan URL Vercel. Tanpa langkah ketiga, gejalanya menyesatkan: halaman termuat tetapi semua data kosong, seolah backend mati padahal ia menolak dengan sengaja.

**Catatan yang diketahui:** analisis berjalan sinkron di dalam request dan bisa memakan ±20 detik pada kasus terburuk (Winston 8s + Groq 12s). `gunicorn --timeout 60` sudah disesuaikan untuk itu. Memindahkannya ke background job adalah pekerjaan berikutnya yang belum dikerjakan.
