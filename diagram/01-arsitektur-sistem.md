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

    subgraph FE["Frontend · Next.js 15 App Router · Vercel"]
        MW["middleware.ts<br/>penjaga rute per peran"]
        SC["Komponen server<br/>merender halaman"]
        CC["Komponen klien<br/>formulir dan grafik"]
    end

    subgraph BE["Backend · Django 5.2 + DRF · VPS Jakarta"]
        AUTH["apps/accounts<br/>JWT, profil, persetujuan"]
        API["apps/academics/views/<br/>endpoint per domain"]
        AN["apps/analysis<br/>lapisan analisis"]
    end

    subgraph DB["Data"]
        PG[("PostgreSQL 17<br/>container di VPS yang sama")]
    end

    LLM["Groq<br/>gpt-oss-120b"]
    WIN["Winston AI v4.18<br/>detektor teks"]

    D --> MW
    M --> MW
    MW --> SC
    SC -->|"fetch + Bearer token"| API
    CC -->|"mutasi"| API
    API --> AUTH
    API --> AN
    AN -.->|"Bloom, tenggat 12 dtk<br/>cadangan heuristik"| LLM
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
`require_owned_*` di `apps/academics/selectors.py`, dan tidak ada jalur kedua
yang bisa melewatinya.

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

Keduanya dipanggil **berurutan**, bukan bersamaan: 12 detik untuk Groq lalu 8
detik untuk Winston, sehingga kasus terburuknya 20 detik. Panggilan itu tidak
terjadi di dalam request: submit hanya menyimpan jawaban dan satu job di tabel
`analysis_jobs`, lalu container `worker` (`manage.py run_analysis_worker`)
mengerjakannya. gunicorn (1 worker, 8 thread) tidak pernah menunggu Groq atau
Winston untuk analisis jawaban, jadi dashboard dosen tidak ikut membeku.

---

## 1.3 Lapisan analisis

```mermaid
flowchart LR
    T["Teks jawaban"] --> TF["engines/text_features.py<br/><i>murni deskriptif</i>"]
    P["Metadata proses<br/>durasi · cuplikan kata"] --> PS["engines/process_signals.py"]

    TF --> E1["engines/ai_score.py · E1<br/>5 sinyal teks"]
    TF --> E2["engines/bloom.py · E2<br/>level C1–C6"]
    PS --> E1

    E1 --> ORC["pipeline.py<br/>orkestrator"]
    E2 --> ORC
    GQ["providers/groq.py"] --> ORC
    ORC --> AR[("AnalysisResult")]

    DC["detector_cache.py<br/>tabel DetectorScore"] --> DET["providers/winston.py<br/>Winston AI"]
    DET -->|"menimpa SKOR AI saja"| ORC

    AR --> E4["insights/cognitive.py · E4<br/>tren per kelas"]
    AR --> OV["insights/overview.py<br/>agregasi kelas"]
    AR --> RP["insights/reports.py<br/>laporan lintas kelas"]

    E1 -. "DILARANG" .-x E2
    E2 -. "DILARANG" .-x E1
    DET -. "DILARANG" .-x E2

    classDef larang stroke:#C2547A,stroke-width:2px,stroke-dasharray:4 3
    classDef inti fill:#E8F4F5,stroke:#0E7C86
    classDef luar fill:#FDF0F4,stroke:#C2547A
    class E1,E2 inti
    class DET,DC,GQ luar
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
    subgraph VF["Vercel · proyek frontend"]
        NX["Next.js<br/>thinkpath.vercel.app<br/>iad1, Washington, D.C."]
    end
    subgraph VPS["VPS IDCloudHost · Jakarta · Docker Compose"]
        CD["caddy<br/>:80 / :443<br/>HTTPS otomatis"]
        DJ["api<br/>gunicorn 1 worker x 8 thread<br/>Django 5.2"]
        PG[("db<br/>PostgreSQL 17<br/>volume pgdata")]
    end

    NX -->|"HTTPS + Bearer<br/>API_DOMAIN"| CD
    CD -->|"HTTP + X-Forwarded-For/Proto"| DJ
    DJ -->|"jaringan Docker internal"| PG

    classDef box fill:#E8F4F5,stroke:#0E7C86
    class NX,CD,DJ,PG box
```

Frontend tetap di Vercel; backend dan basis data satu mesin di VPS. Postgres
tidak membuka port ke internet, dan port API hanya terikat ke `127.0.0.1`
(untuk debug lewat SSH tunnel). Satu-satunya pintu publik adalah Caddy, yang
juga mengurus sertifikat Let's Encrypt dan pengalihan HTTP ke HTTPS.

**Migrasi berjalan otomatis** setiap container `api` mulai
(`deploy/entrypoint.sh`), jadi `make deploy` di VPS sudah mencakup migrasi.
Runbook lengkap ada di [backend/README.md](../backend/README.md).

**Jebakan saat menempatkan.** Backend butuh URL frontend untuk
`CORS_ALLOWED_ORIGINS`, sedangkan frontend butuh URL backend untuk
`NEXT_PUBLIC_BACKEND_URL`. Karena domain API sudah diketahui sebelum deploy,
isi keduanya sekaligus; kalau CORS lupa diisi, gejalanya halaman termuat tetapi
semua data kosong.

**Di belakang proxy.** Django membaca `X-Forwarded-Proto` untuk tahu permintaan
asli HTTPS, dan DRF membaca `X-Forwarded-For` (`NUM_PROXIES=1`) untuk throttle
login per IP. Tanpa yang kedua, semua pengguna terhitung satu IP, yaitu IP
container Caddy.
