# 01 · Arsitektur Sistem

Diagram di berkas ini menggambarkan susunan sistem, bukan alur pemakaian. Untuk
alur per peran lihat [02](./02-alur-dosen.md), [03](./03-alur-mahasiswa.md), dan
[04](./04-interaksi-gabungan.md).

---

## 1.1 Peta lapisan

Pola yang dipakai adalah **satu pintu API**. Frontend tidak pernah menyentuh
basis data secara langsung; seluruh kueri, autentikasi, dan logika bisnis
terpusat di Django.

```mermaid
flowchart TB
    subgraph K["Klien"]
        D["Dosen<br/>peramban"]
        M["Mahasiswa<br/>peramban"]
    end

    subgraph FE["Frontend · Next.js 14 App Router · Vercel"]
        MW["middleware.ts<br/>penjaga rute per peran"]
        SC["Komponen server<br/>merender halaman"]
        CC["Komponen klien<br/>formulir dan grafik"]
    end

    subgraph BE["Backend · Django 5 + DRF · Hugging Face Spaces"]
        AUTH["core/<br/>JWT, profil, izin akses"]
        API["academics/views.py<br/>15 endpoint"]
        AN["Lapisan analisis"]
    end

    subgraph DB["Data"]
        PG[("PostgreSQL<br/>Supabase")]
    end

    LLM["Groq<br/>llama-3.3-70b"]
    WIN["Winston AI v4.18<br/>detektor teks"]

    D --> MW
    M --> MW
    MW --> SC
    SC -->|"fetch + Bearer token"| API
    CC -->|"mutasi"| API
    API --> AUTH
    API --> AN
    AN -.->|"tenggat 12 dtk<br/>cadangan heuristik"| LLM
    AN -.->|"tenggat 8 dtk<br/>lewat cache DetectorScore"| WIN
    API --> PG

    classDef fe fill:#E8F4F5,stroke:#0E7C86,color:#1F2933
    classDef be fill:#D9F2E6,stroke:#2E7D5B,color:#1F2933
    classDef ext fill:#FDF0F4,stroke:#C2547A,color:#1F2933
    class MW,SC,CC fe
    class AUTH,API,AN be
    class LLM,WIN,PG ext
```

**Kenapa satu pintu.** Kepemilikan data dan izin akses hanya perlu dijaga di
satu tempat. Setiap endpoint menyaring berdasarkan pemilik lewat helper
`_require_owned_*`, dan tidak ada jalur kedua yang bisa melewatinya.

---

## 1.2 Perjalanan satu permintaan

```mermaid
sequenceDiagram
    autonumber
    participant B as Peramban
    participant MW as middleware.ts
    participant RSC as Komponen server
    participant API as Django + DRF
    participant DB as PostgreSQL

    B->>MW: GET /dashboard
    MW->>MW: baca cookie thinkpath_token
    alt tanpa token
        MW-->>B: alihkan ke /login
    else ada token
        MW->>RSC: teruskan
        RSC->>API: GET /api/overview<br/>Authorization Bearer
        API->>API: verifikasi JWT lokal (PyJWT)
        API->>API: saring berdasarkan owner_id
        API->>DB: kueri ter-select_related
        DB-->>API: baris
        API-->>RSC: JSON agregat
        RSC-->>B: HTML terender
    end
```

Verifikasi token terjadi **di proses yang sama**, tanpa panggilan ke layanan
pihak ketiga. Dua layanan luar yang dipakai, Groq dan Winston, keduanya hanya
disentuh saat menganalisis tugas, dan keduanya punya jalur cadangan. Tidak ada
satu pun permintaan halaman yang bergantung pada layanan luar.

Keduanya dipanggil **berurutan**, bukan bersamaan: 8 detik untuk Winston lalu 12
detik untuk Groq, sehingga kasus terburuknya 20 detik. Angka itu sengaja ditahan
jauh di bawah tenggat gunicorn 60 detik supaya worker tidak pernah dibunuh tepat
saat salah satu API hendak menjawab.

---

## 1.3 Lapisan analisis

```mermaid
flowchart LR
    T["Teks jawaban"] --> TF["text_features.py<br/><i>murni deskriptif</i>"]
    P["Metadata proses<br/>durasi · revisi · cuplikan kata"] --> PS["process_signals.py"]

    TF --> E1["ai_score.py · E1<br/>5 sinyal teks"]
    TF --> E2["bloom.py · E2<br/>level C1–C6"]
    PS --> E1

    E1 --> ORC["llm.py<br/>orkestrator"]
    E2 --> ORC
    ORC --> AR[("AnalysisResult")]

    DC["detector_cache.py<br/>tabel DetectorScore"] --> DET["detector.py<br/>Winston AI"]
    DET -->|"menimpa SKOR AI saja"| ORC

    AR --> E4["cognitive.py · E4<br/>tren per kelas"]
    AR --> OV["overview.py<br/>agregasi kelas"]
    AR --> RP["reports.py<br/>laporan lintas kelas"]

    E1 -. "DILARANG" .-x E2
    E2 -. "DILARANG" .-x E1
    DET -. "DILARANG" .-x E2

    classDef larang stroke:#C2547A,stroke-width:2px,stroke-dasharray:4 3
    classDef inti fill:#E8F4F5,stroke:#0E7C86
    classDef luar fill:#FDF0F4,stroke:#C2547A
    class E1,E2 inti
    class DET,DC luar
```

Tiga panah putus-putus itu **dijaga uji otomatis** yang membaca kode lewat AST,
bukan pencocokan teks. Menambahkan `import` terlarang akan langsung
menggagalkan tes, sehingga pemisahan ini tidak bisa runtuh tanpa disadari.

Alasannya: level kognitif dan dugaan penggunaan AI adalah dua hal berbeda.
Mahasiswa bisa menulis analisis tajam dengan bantuan AI, dan bisa juga menulis
jawaban lemah sepenuhnya sendiri.

Detektor eksternal masuk sebagai **penimpa di atas hasil yang sudah jadi**, bukan
cabang di tengah alur. Karena skor Bloom sudah selesai dihitung sebelum detektor
dipanggil, tidak ada jalur kode yang bisa membawa skor detektor ke sana. Bentuk
itu membuat pemisahannya berdiri sendiri, bukan bergantung pada kedisiplinan
siapa pun yang menyunting berkas ini nanti.

---

## 1.4 Susunan penempatan

```mermaid
flowchart LR
    subgraph V["Vercel"]
        NX["Next.js<br/>NEXT_PUBLIC_BACKEND_URL"]
    end
    subgraph H["Hugging Face Spaces"]
        DK["Docker python:3.11-slim<br/>gunicorn · 2 worker · 4 thread<br/>port 7860"]
    end
    subgraph S["Supabase"]
        PG[("PostgreSQL")]
    end

    NX -->|"HTTPS + Bearer"| DK
    DK -->|"psycopg 3"| PG
    DK -.->|"X-Forwarded-Proto: https"| DK

    classDef box fill:#E8F4F5,stroke:#0E7C86
    class NX,DK,PG box
```

**Jebakan saat menempatkan.** HF butuh URL Vercel untuk `CORS_ALLOWED_ORIGINS`,
sedangkan Vercel butuh URL HF untuk `NEXT_PUBLIC_BACKEND_URL`. Melingkar. Urutan
yang bekerja: tempatkan backend lebih dulu dengan CORS sementara, tempatkan
frontend, lalu kembali membetulkan CORS di HF.

`DJANGO_ALLOWED_HOSTS` wajib diisi nama Space. Kalau tetap `localhost`, seluruh
permintaan ditolak `400` dengan penyebab yang sulit ditebak.
