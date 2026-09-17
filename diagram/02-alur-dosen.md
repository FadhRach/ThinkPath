# 02 · Interaksi Sistem dengan Dosen

Seluruh alur di sini bertumpu pada satu prinsip: sistem menyodorkan **bukti**,
keputusan tetap di tangan dosen.

---

## 2.1 Peta perjalanan dosen

```mermaid
flowchart TD
    L["Masuk"] --> OV["/dashboard<br/><b>Overview</b>"]

    OV --> PK["Peta kelas dua sumbu"]
    OV --> SB["Sebaran level Bloom"]
    OV --> TK["Tren kohort"]
    OV --> PP["Daftar perlu perhatian"]

    PK -->|"klik satu titik"| PROF["/dashboard/students/:id<br/>Profil kognitif"]
    PP -->|"klik nama"| PROF

    OV --> KLS["/dashboard/classes"]
    KLS --> DET["Detail kelas<br/>pemilih tugas"]
    DET --> TBL["Tabel submission"]
    TBL -->|"klik baris"| SUB["/dashboard/submission/:id<br/><b>Bukti lengkap</b>"]
    TBL -->|"klik Tren"| PROF

    SUB --> VER["Jadwalkan verifikasi verbal"]
    VER --> ANT["/dashboard/verifikasi<br/>Antrean sesi"]

    OV --> TGS["/dashboard/tugas<br/>Seluruh tugas lintas kelas"]
    OV --> LAP["/dashboard/laporan<br/>Agregat prodi & semester"]

    classDef utama fill:#E8F4F5,stroke:#0E7C86,stroke-width:2px
    classDef biasa fill:#F4FAFA,stroke:#9AB8BB
    class OV,SUB utama
    class PK,SB,TK,PP,KLS,DET,TBL,PROF,VER,ANT,TGS,LAP biasa
```

---

## 2.2 Membaca peta kelas

Peta memakai **dua sumbu, bukan peringkat**. Peringkat satu sumbu memaksa dosen
membaca kelasnya sebagai antrean tersangka, dan menyembunyikan kuadran yang
paling sering luput.

```mermaid
quadrantChart
    title Peta kelas, sumbu X rata-rata skor AI, sumbu Y selisih Bloom
    x-axis "Dugaan AI rendah" --> "Dugaan AI tinggi"
    y-axis "Tertinggal dari target" --> "Sesuai target"
    quadrant-1 "Mampu, proses perlu ditanya"
    quadrant-2 "Tidak menuntut tindakan"
    quadrant-3 "Celah pemahaman, paling sering luput"
    quadrant-4 "Dua masalah sekaligus"
    "Mahasiswa 02": [0.30, 0.08]
    "Mahasiswa 04": [0.22, 0.16]
    "Mahasiswa 05": [0.48, 0.22]
    "Mahasiswa 01": [0.18, 0.62]
    "Mahasiswa 03": [0.18, 0.63]
    "Mahasiswa 08": [0.70, 0.61]
    "Mahasiswa 07": [0.77, 0.72]
```

**Kuadran kiri bawah adalah alasan peta ini ada.** Mahasiswa dengan skor AI
rendah yang tertinggal jauh dari target: jujur, dan tidak tertolong. Alat yang
hanya memberi satu skor kecurigaan tidak akan pernah menunjukkannya.

Pada data demo, himpunan "perlu bantuan" dan himpunan "dicurigai" memang tidak
beririsan sama sekali.

---

## 2.3 Alur meninjau satu submission

```mermaid
sequenceDiagram
    autonumber
    actor DS as Dosen
    participant UI as Halaman submission
    participant API as Backend

    DS->>UI: buka submission
    UI->>API: GET /api/submissions/:id
    API-->>UI: skor, rincian sinyal, jejak proses, teks

    Note over UI: Yang ditampilkan berdampingan
    UI-->>DS: cincin skor AI + band
    UI-->>DS: rincian tiap sinyal, bobot, buktinya
    UI-->>DS: level Bloom + keyakinan sendiri
    UI-->>DS: linimasa & kurva pertumbuhan kata
    UI-->>DS: ritme kalimat pada teks jawaban

    alt Dosen ingin menindaklanjuti
        DS->>UI: jadwalkan verifikasi verbal
        UI->>API: PUT /api/submissions/:id/verification
        Note right of API: status = scheduled<br/>kesimpulan BELUM boleh diisi
        DS->>DS: bicara langsung dengan mahasiswa
        DS->>UI: catat kesimpulan
        UI->>API: PUT status = completed + outcome
        Note right of API: ai_score TIDAK berubah
    else Tidak perlu
        DS->>UI: langsung nilai
        UI->>API: PATCH nilai + umpan balik
    end
```

**Dua penjagaan yang disengaja.** Kesimpulan tidak bisa diisi sebelum status
`completed`, karena membiarkan dosen menyimpulkan saat baru menjadwalkan berarti
menyimpulkan sebelum berbicara. Dan hasil percakapan **tidak pernah** menulis
balik ke `ai_score`: skor yang keliru tidak boleh membenarkan dirinya sendiri
lewat percakapan yang ia picu sendiri.

---

## 2.4 Pilihan kesimpulan verifikasi

```mermaid
flowchart LR
    S["Sesi selesai"] --> A["Dapat menjelaskan"]
    S --> B["Sebagian dapat dijelaskan"]
    S --> C["Tidak dapat menjelaskan"]
    S --> D["Belum konklusif"]
    S -.-x E["✗ Terbukti menyontek"]

    classDef ada fill:#D9F2E6,stroke:#2E7D5B
    classDef tidak fill:#FDF0F4,stroke:#C2547A,stroke-dasharray:4 3
    class A,B,C,D ada
    class E tidak
```

Nilai "terbukti menyontek" **sengaja tidak disediakan**. Satu percakapan tidak
menghasilkan kepastian itu, dan menyediakan tombolnya berarti mengundang
kesimpulan yang tidak ditopang bukti apa pun yang dimiliki sistem.

---

## 2.5 Membuat kelas dan tugas

```mermaid
stateDiagram-v2
    [*] --> BuatKelas
    BuatKelas --> KodeGabung: sistem membuat<br/>kode unik 7 karakter
    KodeGabung --> BuatTugas: bagikan ke mahasiswa
    BuatTugas --> TargetBloom: tetapkan target C1–C6<br/>dan tenggat
    TargetBloom --> Menunggu
    Menunggu --> Terkumpul: mahasiswa submit
    Terkumpul --> Dianalisis: E1 + E2 otomatis
    Dianalisis --> Ditinjau: dosen membaca bukti
    Ditinjau --> Dinilai
    Ditinjau --> Verifikasi: bila perlu percakapan
    Verifikasi --> Dinilai
    Dinilai --> [*]
```

Jenjang, program studi, dan semester melekat pada **kelas**, bukan pada tugas
maupun profil. Tugas mewarisinya dari kelas tempat ia dibuat, sehingga tidak
mungkin ada tugas S2 tersimpan di dalam kelas S1.
