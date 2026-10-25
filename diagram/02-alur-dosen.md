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

    SUB --> VER["Minta Cek Paham"]
    VER --> ANT["/dashboard/cekpaham<br/>Daftar & hasil"]

    OV --> TGS["/dashboard/tugas<br/>Seluruh tugas lintas kelas"]
    OV --> LAP["/dashboard/analitik<br/>Per kelas + lintas kelas (prodi, semester)"]

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
        DS->>UI: minta Cek Paham (soal, bahasa, durasi, jendela waktu)
        UI->>API: POST /api/submissions/:id/cekpaham
        Note right of API: mahasiswa diberi tahu secara netral,<br/>tanpa alasan atau skor
        API-->>UI: setelah mahasiswa menjawab: audio, transkrip, saran skor + bukti
        DS->>UI: baca hasil, putuskan sendiri
        Note right of API: ai_score dan nilai TIDAK berubah
    else Tidak perlu
        DS->>UI: langsung nilai
        UI->>API: PATCH nilai + umpan balik
    end
```

**Penjagaan yang disengaja.** Hasil Cek Paham **tidak pernah** menulis balik
ke `ai_score`, level Bloom, atau nilai: skor yang keliru tidak boleh
membenarkan dirinya sendiri lewat tes yang ia picu sendiri. Skor Cek Paham
sendiri hanya saran dan belum dikalibrasi, sehingga selalu berlabel demikian.

---

## 2.4 Yang dosen terima dari Cek Paham

```mermaid
flowchart LR
    S["Mahasiswa selesai menjawab"] --> A["Audio + transkrip server"]
    S --> B["Saran skor 4 dimensi<br/>+ kutipan bukti"]
    S --> C["Konteks: pindah tab,<br/>ganti mikrofon (tidak diskor)"]
    S --> D["Laporan kendala mahasiswa<br/>(opsional)"]
    S -.-x E["✗ Vonis menyontek"]

    classDef ada fill:#D9F2E6,stroke:#2E7D5B
    classDef tidak fill:#FDF0F4,stroke:#C2547A,stroke-dasharray:4 3
    class A,B,C,D ada
    class E tidak
```

Sistem tidak menyediakan vonis. Skor hanya saran, kutipan buktinya diperiksa
harus benar-benar ada di transkrip, dan mahasiswa yang merasa transkripnya
keliru dapat melapor sehingga dosen bisa mengizinkan percobaan ulang.

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
    Ditinjau --> CekPaham: bila perlu
    CekPaham --> Dinilai
    Dinilai --> [*]
```

Jenjang, program studi, dan semester melekat pada **kelas**, bukan pada tugas
maupun profil. Tugas mewarisinya dari kelas tempat ia dibuat, sehingga tidak
mungkin ada tugas S2 tersimpan di dalam kelas S1.
