# 03 · Interaksi Sistem dengan Mahasiswa

Aturan yang mengikat seluruh layar di berkas ini: **mahasiswa tidak pernah
melihat dugaan AI tentang dirinya**. Dugaan yang belum diverifikasi tidak pantas
disajikan sebagai penilaian.

---

## 3.1 Peta perjalanan mahasiswa

```mermaid
flowchart TD
    L["Masuk"] --> BR["/student<br/><b>Beranda</b>"]

    BR --> GB["Gabung kelas<br/>lewat kode 7 karakter"]
    BR --> KRT["Kartu kelas<br/>beserta tugasnya"]
    BR --> NL["Grafik nilai tugas terakhir"]

    BR --> TGS["/student/tugas<br/>Daftar tugas, tenggat terdekat di atas"]
    TGS --> KRJ["/student/submit/:id<br/><b>Mengerjakan</b>"]
    KRT --> KRJ

    KRJ --> KUM["Kumpulkan"]
    KUM --> HSL["Lihat status, nilai,<br/>umpan balik dosen"]
    KUM -->|"sebelum tenggat<br/>dan belum dinilai"| REV["Revisi jawaban"]
    REV --> KUM

    BR --> PRG["/student/progres<br/><b>Progres Belajar</b>"]
    PRG --> TRN["Tren level Bloom per kelas"]
    PRG --> TGT["Garis target tugas"]

    BR --> PGT["/student/pengaturan"]

    classDef utama fill:#E8F4F5,stroke:#0E7C86,stroke-width:2px
    classDef biasa fill:#F4FAFA,stroke:#9AB8BB
    classDef larang fill:#FDF0F4,stroke:#C2547A,stroke-dasharray:4 3
    class BR,KRJ,PRG utama
    class GB,KRT,NL,TGS,KUM,HSL,REV,TRN,TGT,PGT biasa
```

Tidak ada satu pun simpul di peta ini yang menampilkan skor AI.

---

## 3.2 Apa yang dilihat mahasiswa dan apa yang tidak

```mermaid
flowchart LR
    subgraph T["Ditampilkan"]
        A1["Level Bloom jawabannya"]
        A2["Target level tugas"]
        A3["Tren perkembangan"]
        A4["Nilai dan umpan balik dosen"]
        A5["Status pengerjaan"]
    end

    subgraph X["Sengaja disembunyikan"]
        B1["Skor AI"]
        B2["Band indikasi"]
        B3["Rincian sinyal"]
        B4["Jejak forensik proses"]
    end

    classDef ada fill:#D9F2E6,stroke:#2E7D5B,color:#1F2933
    classDef tidak fill:#FDF0F4,stroke:#C2547A,color:#1F2933
    class A1,A2,A3,A4,A5 ada
    class B1,B2,B3,B4 tidak
```

Pemisahan ini dijaga di lapisan API, bukan hanya di tampilan.
`StudentSubmissionStatusSerializer` memang tidak memuat `ai_score`, dan endpoint
`/api/student/progress` membuang `ai_band` dari tiap titik sebelum dikirim.
Menyembunyikannya hanya di CSS akan bocor pada permintaan jaringan pertama.

---

## 3.3 Alur mengerjakan tugas, beserta jejak yang terekam

```mermaid
sequenceDiagram
    autonumber
    actor MH as Mahasiswa
    participant F as Form pengerjaan
    participant API as Backend
    participant AN as Lapisan analisis

    MH->>F: buka halaman tugas
    F->>F: catat started_at
    F->>F: cuplikan dasar jumlah kata

    loop tiap 30 detik selama mengerjakan
        F->>F: cuplik jumlah kata saat ini
    end

    MH->>F: tekan Kumpulkan
    F->>F: cuplikan terakhir
    F->>API: POST jawaban + started_at + deret cuplikan

    API->>API: buang cuplikan di luar<br/>rentang mulai sampai kumpul
    API->>AN: teks + konteks proses
    AN->>AN: E1 lima sinyal teks
    AN->>AN: E2 level Bloom
    AN->>AN: sinyal proses dari bentuk kurva
    AN-->>API: hasil analisis
    API->>API: simpan submission + cuplikan + hasil
    API-->>F: 201
    F-->>MH: "Jawabanmu berhasil dikumpulkan"

    Note over MH,F: Mahasiswa tidak melihat hasil analisis apa pun
```

**Cuplikan dasar diambil seketika**, bukan menunggu selang pertama. Tanpa itu,
menempel dalam tiga puluh detik pertama membuat pengamatan perdana sudah memuat
teks penuh, dan jejaknya terbaca datar sejak awal.

Pada mode **revisi** cuplikan tidak dikirim sama sekali, karena kotak sudah
terisi jawaban sebelumnya sehingga cuplikan dasar akan mencatat ratusan kata
sejak detik nol.

---

## 3.4 Bentuk kurva yang membedakan

```mermaid
flowchart LR
    subgraph A["Menulis sungguhan"]
        A1["0 kata"] --> A2["naik bertahap"] --> A3["sesekali datar<br/>saat berpikir"] --> A4["naik lagi"] --> A5["selesai"]
    end
    subgraph B["Tempel lalu tunggu"]
        B1["0 kata"] --> B2["<b>lonjakan tegak</b><br/>seluruh jawaban"] --> B3["datar 40 menit"] --> B4["kumpul"]
    end

    classDef ok fill:#D9F2E6,stroke:#2E7D5B
    classDef bad fill:#FDF0F4,stroke:#C2547A
    class A1,A2,A3,A4,A5 ok
    class B1,B2,B3,B4 bad
```

Menunggu tidak menolong, karena menunggu justru **memperpanjang garis datarnya**.
Diukur pada uji sintetis 400 kata, siasat tempel-lalu-tunggu naik dari 0,30 ke
0,75, dan memecah tempelan jadi empat potong tetap tertangkap di 0,45 karena
seluruh lonjakan dijumlahkan, bukan diambil yang terbesar.

---

## 3.5 Daur hidup satu submission

```mermaid
stateDiagram-v2
    [*] --> Draf: buka form
    Draf --> Terkumpul: kumpulkan
    Terkumpul --> Terkumpul: revisi<br/>(sebelum tenggat, belum dinilai)
    Terkumpul --> Dinilai: dosen memberi nilai
    Terkumpul --> Diverifikasi: dosen menjadwalkan sesi
    Diverifikasi --> Dinilai
    Dinilai --> [*]

    note right of Terkumpul
        Tiap revisi menaikkan revision_count
        dan memicu analisis ulang
    end note
    note right of Diverifikasi
        Kesimpulan sesi tidak pernah
        mengubah skor AI
    end note
```

Setelah tenggat berakhir, pengumpulan ditutup dan revisi tidak lagi mungkin.
Penjagaannya di sisi server, bukan hanya menyembunyikan tombol.
