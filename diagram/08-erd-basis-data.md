# 08 · ERD dan Kamus Data

Skema PostgreSQL ThinkPath setelah migrasi ke VPS (riwayat migrasi direset ke
`0001_initial` per app pada Oktober 2026). Sumber kebenaran tetap
`backend/apps/*/models.py`; bila model berubah, perbarui berkas ini di PR yang
sama.

Konvensi yang berlaku di semua tabel:

- Kunci primer `id` bertipe **UUID** (dibuat aplikasi, bukan sequence), jadi ID
  tidak bisa ditebak berurutan dari URL.
- Waktu disimpan **UTC** (`timestamptz`). Zona tampilan (Asia/Jakarta) urusan
  frontend.
- Semua foreign key `ON DELETE CASCADE`: menghapus akun menghapus seluruh data
  turunannya, sesuai janji penghapusan di Kebijakan Privasi.
- Aturan bisnis yang penting dijaga **di basis data** (unique/check
  constraint), bukan hanya di serializer, karena dua permintaan serentak bisa
  sama-sama lolos validasi aplikasi.

---

## 8.1 Diagram relasi

```mermaid
erDiagram
    profiles ||--o{ consent_records : "memberi persetujuan"
    profiles ||--o{ classes : "dosen pemilik"
    profiles ||--o{ class_memberships : "mahasiswa anggota"
    classes ||--o{ class_memberships : "beranggotakan"
    classes ||--o{ assignments : "memuat"
    classes ||--o{ materials : "memuat"
    classes ||--o{ announcements : "memuat"
    assignments ||--o{ submissions : "dijawab lewat"
    profiles ||--o{ submissions : "mahasiswa penjawab"
    submissions ||--o{ reasoning_events : "jejak proses"
    submissions ||--o| analysis_results : "hasil analisis"
    submissions ||--o| verbal_verifications : "sesi diskusi"
    profiles ||--o{ notifications : "penerima"

    profiles {
        uuid id PK
        varchar email "unik, lowercase"
        varchar password "hash PBKDF2"
        varchar display_name
        varchar role "teacher | student"
        varchar education_level "D3 | S1 | S2 | S3 | kosong"
        timestamptz created_at
    }
    consent_records {
        uuid id PK
        uuid profile_id FK
        varchar action "given | updated | withdrawn"
        varchar policy_version
        jsonb items
        timestamptz created_at
    }
    classes {
        uuid id PK
        uuid owner_id FK "dosen"
        varchar name
        varchar subject
        varchar education_level
        varchar program_studi
        smallint semester "1-14 atau null"
        varchar join_code UK
        timestamptz created_at
    }
    class_memberships {
        uuid id PK
        uuid class_id FK
        uuid student_profile_id FK
        timestamptz joined_at
    }
    assignments {
        uuid id PK
        uuid class_id FK
        varchar title
        text instructions
        timestamptz deadline "null = tanpa tenggat"
        smallint expected_bloom_level "1-6"
        timestamptz created_at
    }
    materials {
        uuid id PK
        uuid class_id FK
        varchar topic
        varchar title
        text description
        varchar url "http/https saja"
        timestamptz created_at
    }
    announcements {
        uuid id PK
        uuid class_id FK
        varchar title
        text body
        timestamptz created_at
    }
    submissions {
        uuid id PK
        uuid assignment_id FK
        uuid student_profile_id FK
        text text_answer
        timestamptz started_at
        timestamptz submitted_at
        integer duration_seconds ">= 0 atau null"
        integer revision_count ">= 0"
        varchar status "draft | submitted | reviewed"
        smallint grade "0-100 atau null"
        text teacher_feedback
        timestamptz created_at
    }
    reasoning_events {
        uuid id PK
        uuid submission_id FK
        varchar event_type "started | progress | revision | submitted"
        jsonb payload
        timestamptz occurred_at
    }
    analysis_results {
        uuid id PK
        uuid submission_id FK "1:1"
        smallint ai_score "0-100"
        varchar ai_band "low | mid | high"
        smallint bloom_level "1-6"
        varchar confidence
        varchar bloom_confidence
        jsonb signals
        jsonb signal_breakdown
        text summary
        text recommendation
        varchar analysis_source "llm | heuristic | detector | seed"
        timestamptz created_at
    }
    verbal_verifications {
        uuid id PK
        uuid submission_id FK "1:1"
        varchar status "scheduled | completed | cancelled"
        timestamptz scheduled_at
        varchar outcome "wajib bila completed"
        text notes
        timestamptz completed_at
        timestamptz created_at
        timestamptz updated_at
    }
    notifications {
        uuid id PK
        uuid recipient_id FK
        varchar kind
        varchar title
        varchar body
        varchar link
        timestamptz event_at
        varchar group_key
        integer count
        timestamptz created_at
        timestamptz read_at "null = belum dibaca"
    }
    detector_scores {
        uuid id PK
        varchar text_hash "SHA-256"
        varchar provider
        varchar model_version
        varchar language
        double ai_probability "0-1, sudah dibalik"
        boolean reliable
        jsonb attack_kinds
        timestamptz created_at
    }
```

`detector_scores` sengaja **tidak berelasi** ke tabel mana pun. Isinya cache
skor detektor berbayar yang dikunci oleh hash teks, sehingga dua jawaban dengan
teks identik berbagi satu skor, dan tidak ada data pribadi yang tersimpan di
sana.

---

## 8.2 Pembagian per app Django

| App | Tabel | Tanggung jawab |
|---|---|---|
| `apps.accounts` | `profiles`, `consent_records` | Identitas, JWT, persetujuan UU PDP |
| `apps.academics` | `classes`, `class_memberships`, `assignments`, `materials`, `announcements`, `submissions`, `reasoning_events`, `verbal_verifications` | Perkuliahan dan pengumpulan |
| `apps.analysis` | `analysis_results`, `detector_scores` | Hasil analisis dan cache detektor |
| `apps.notifications` | `notifications` | Notifikasi per penerima |

Tidak ada tabel bawaan Django (`auth_*`, `django_content_type`, `django_session`).
Identitas dikelola sendiri lewat `profiles`, dan app bawaan itu dilepas dari
`INSTALLED_APPS`. Satu-satunya tabel tambahan adalah `django_migrations`.

---

## 8.3 Constraint dan index

| Tabel | Nama | Jenis | Menjaga apa |
|---|---|---|---|
| `profiles` | `profile_email_ci_unique` | UNIQUE `lower(email)` | Satu akun per email tanpa peduli huruf besar; email juga disimpan lowercase |
| `classes` | `join_code` | UNIQUE | Kode gabung kelas tidak bentrok |
| `classes` | `class_semester_range` | CHECK | Semester 1–14 atau kosong |
| `classes` | `classes_owner_recent_idx` | INDEX `(owner, created_at desc)` | Daftar kelas dosen |
| `class_memberships` | `membership_unique_per_class` | UNIQUE `(class, student)` | Mahasiswa tidak tergabung dua kali |
| `assignments` | `assignment_bloom_level_range` | CHECK | Target Bloom 1–6 |
| `assignments` | `assign_class_recent_idx` | INDEX | Daftar tugas per kelas |
| `submissions` | `submission_unique_per_student` | UNIQUE `(assignment, student)` | **Satu jawaban per mahasiswa per tugas.** Pengumpulan ulang memperbarui baris yang sama; klik ganda tidak lagi membuat baris kembar |
| `submissions` | `submission_grade_range` | CHECK | Nilai 0–100 atau kosong |
| `submissions` | `submission_revision_count_positive`, `submission_duration_positive` | CHECK | Angka proses tidak negatif |
| `submissions` | `sub_assign_recent_idx`, `sub_student_recent_idx`, `sub_assign_status_idx` | INDEX | Daftar per tugas, per mahasiswa, dan antrean "perlu dinilai" |
| `reasoning_events` | `reason_sub_time_idx` | INDEX `(submission, occurred_at)` | Linimasa proses berurutan |
| `verbal_verifications` | `verification_outcome_matches_status` | CHECK | Kesimpulan hanya ada setelah sesi selesai, dan sesi selesai wajib punya kesimpulan |
| `analysis_results` | `analysis_ai_score_range`, `analysis_bloom_level_range` | CHECK | Skor 0–100, Bloom 1–6 |
| `detector_scores` | `detector_score_unique_key` | UNIQUE `(text_hash, provider, model_version, language)` | Teks yang sama tidak dibayar dua kali; menaikkan versi model otomatis membatalkan cache lama |
| `detector_scores` | `detector_probability_range` | CHECK | Probabilitas 0–1 |
| `notifications` | `notif_deadline_once` | UNIQUE parsial `(recipient, group_key) WHERE kind='deadline_soon'` | Pengingat tenggat hanya sekali walau lonceng dimuat serentak |
| `notifications` | `notif_unread_idx` | INDEX parsial `(recipient) WHERE read_at IS NULL` | Hitung "belum dibaca" di setiap halaman tetap murah |
| `consent_records` | `consent_profile_recent_idx` | INDEX `(profile, created_at desc)` | Persetujuan yang berlaku = baris terbaru |

Foreign key juga otomatis mendapat index dari Django.

---

## 8.4 Normalisasi dan denormalisasi yang disengaja

Skema berada di **3NF**, dengan empat pengecualian yang disengaja. Semuanya
dicatat di sini agar tidak "dirapikan" tanpa sadar:

| Kolom | Kenapa tidak dinormalisasi |
|---|---|
| `analysis_results.ai_band` | Bisa diturunkan dari `ai_score`, tetapi ambangnya **berbeda per sumber** (heuristik 42/70, detektor 35/70). Menghitung ulang dari angka saja bisa memberi band yang berbeda dari yang dilihat dosen saat itu. |
| `classes.program_studi`, `materials.topic` | Teks bebas, bukan tabel referensi. Ada kelas lintas prodi dan mata kuliah umum, dan topik hanya dipakai untuk mengelompokkan. Mengubahnya menjadi tabel mengubah kontrak API. |
| `profiles.education_level` | Jenjang yang diisi pengguna di Pengaturan. **Analisis tidak memakainya**; analisis memakai `classes.education_level`. Jenjang melekat di kelas karena semester mahasiswa berubah tiap enam bulan, sedangkan kelas permanen berstatus "semester 3". |
| `reasoning_events.payload`, `analysis_results.signals`/`signal_breakdown` | JSON karena isinya berbeda per jenis event atau per sumber analisis, dan selalu dibaca utuh bersama barisnya. Tidak pernah difilter di SQL. |

Yang **dihapus** saat reset migrasi:

- `assignments.education_level`: duplikat jenjang kelas yang pernah membuat
  tugas S2 tersimpan di kelas S1. Kolom ini sudah lama dibuang dan tidak muncul
  lagi di `0001_initial`.
- Tabel bawaan `auth_*` dan `django_content_type` yang tidak pernah diisi.

---

## 8.5 Siklus hidup satu submission

```mermaid
stateDiagram-v2
    [*] --> submitted: POST pertama\n(revision_count = 0)
    submitted --> submitted: POST ulang sebelum tenggat\n(revision_count + 1, analisis ulang)
    submitted --> reviewed: dosen memberi nilai
    reviewed --> [*]
    note right of reviewed
        Revisi ditolak 400.
        Dicek ulang di dalam transaksi
        (SELECT ... FOR UPDATE), jadi nilai
        yang masuk selama analisis berjalan
        tetap menang.
    end note
```

`draft` ada di pilihan status untuk kompatibilitas tipe frontend, tetapi tidak
pernah ditulis backend.
