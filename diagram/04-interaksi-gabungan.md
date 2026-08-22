# 04 · Interaksi Dosen, Mahasiswa, dan Sistem

Berkas ini menggambarkan alur yang melibatkan **ketiganya sekaligus**, termasuk
titik tempat sistem sengaja berhenti dan menyerahkan keputusan kepada manusia.

---

## 4.1 Siklus penuh satu tugas

```mermaid
sequenceDiagram
    autonumber
    actor DS as Dosen
    participant S as ThinkPath
    actor MH as Mahasiswa

    DS->>S: buat kelas
    S-->>DS: kode gabung 7 karakter
    DS->>MH: bagikan kode (di luar sistem)
    MH->>S: gabung kelas
    DS->>S: buat tugas + target Bloom + tenggat
    S-->>MH: tugas muncul di daftar

    MH->>S: kerjakan, cuplikan kata tiap 30 dtk
    MH->>S: kumpulkan
    S->>S: jalur dasar: skor AI + level Bloom + sinyal proses
    S->>S: detektor eksternal menimpa skor AI saja
    S-->>MH: "berhasil dikumpulkan" (tanpa hasil analisis)
    S-->>DS: submission muncul dengan bukti lengkap

    DS->>S: baca peta kelas, buka submission

    alt Bukti cukup meyakinkan
        DS->>S: beri nilai + umpan balik
    else Perlu diperiksa langsung
        DS->>S: jadwalkan verifikasi verbal
        S-->>DS: masuk antrean
        DS->>MH: ajak bicara (di luar sistem)
        MH->>DS: jelaskan jawabannya sendiri
        DS->>S: catat kesimpulan sesi
        Note over S: ai_score TIDAK berubah
        DS->>S: beri nilai + umpan balik
    end

    S-->>MH: nilai dan umpan balik
    S->>S: perbarui profil kognitif & tren kelas
```

**Perhatikan dua panah yang keluar dari sistem.** Membagikan kode kelas dan
percakapan verifikasi terjadi **di luar** aplikasi. Itu disengaja: ThinkPath
tidak menggantikan percakapan dosen dan mahasiswa, ia hanya memberi tahu
percakapan mana yang paling layak dilakukan lebih dulu.

---

## 4.2 Pembagian wewenang

```mermaid
flowchart TB
    subgraph SIS["Yang dikerjakan sistem"]
        S1["Mengukur sinyal teks"]
        S2["Menaksir level Bloom"]
        S3["Merekam jejak proses"]
        S4["Mengurutkan siapa perlu perhatian"]
        S5["Menyajikan bukti berdampingan"]
    end

    subgraph DOS["Yang tetap milik dosen"]
        D1["Menafsirkan bukti"]
        D2["Memutuskan perlu bicara atau tidak"]
        D3["Menyimpulkan hasil percakapan"]
        D4["Memberi nilai"]
        D5["Menentukan tindak lanjut"]
    end

    subgraph TAK["Yang tidak dilakukan siapa pun di sistem"]
        X1["Menyatakan seseorang menyontek"]
        X2["Menurunkan nilai karena skor AI"]
        X3["Menilai berdasarkan lama mengerjakan"]
    end

    SIS --> DOS
    DOS -.->|"tidak tersedia"| TAK

    classDef sis fill:#E8F4F5,stroke:#0E7C86
    classDef dos fill:#D9F2E6,stroke:#2E7D5B
    classDef tak fill:#FDF0F4,stroke:#C2547A,stroke-dasharray:4 3
    class S1,S2,S3,S4,S5 sis
    class D1,D2,D3,D4,D5 dos
    class X1,X2,X3 tak
```

---

## 4.3 Empat kuadran dan tindak lanjutnya

Peta kelas memisahkan dua pertanyaan yang sering dicampur: *siapa yang mungkin
memakai AI* dan *siapa yang tertinggal*. Keduanya menuntut tindakan berbeda.

```mermaid
flowchart TD
    ST["Satu mahasiswa"] --> Q{"Selisih Bloom<br/>terhadap target"}

    Q -->|"tertinggal ≥ 1 tingkat"| R{"Rata-rata<br/>skor AI"}
    Q -->|"sesuai atau di atas"| T{"Rata-rata<br/>skor AI"}

    R -->|"rendah"| K3["<b>Celah pemahaman</b><br/>Terukur, paling sering luput.<br/>Tindakan: bantu materinya"]
    R -->|"tinggi"| K4["<b>Dua masalah</b><br/>Tindakan: mulai dari percakapan"]

    T -->|"tinggi"| K1["<b>Mampu, proses dipertanyakan</b><br/>Tindakan: verifikasi verbal"]
    T -->|"rendah"| K2["<b>Aman</b><br/>Tidak menuntut tindakan"]

    classDef kritis fill:#FDF0F4,stroke:#C2547A
    classDef perhatian fill:#FDF6E3,stroke:#B8860B
    classDef aman fill:#D9F2E6,stroke:#2E7D5B
    class K4 kritis
    class K3,K1 perhatian
    class K2 aman
```

Pada data demo, **empat mahasiswa tertinggal dari target dan tidak satu pun di
antaranya pernah berskor AI tinggi.** Kedua himpunan itu tidak beririsan, dan
itulah pembenaran paling langsung untuk memakai dua sumbu.

---

## 4.4 Batas kepercayaan pada tiap masukan

```mermaid
flowchart LR
    subgraph K["Sulit dipalsukan"]
        A["revision_count<br/><i>dihitung server</i>"]
    end
    subgraph S["Menaikkan biaya kecurangan"]
        B["Kurva pertumbuhan kata<br/><i>telemetri klien</i>"]
        C["started_at<br/><i>dikirim klien</i>"]
    end
    subgraph L["Bisa dihapus dengan menulis ulang"]
        D["Lima sinyal teks<br/><i>statistik dan penanda</i>"]
        E["Detektor eksternal Winston<br/><i>membaca teks juga</i>"]
    end

    classDef kuat fill:#D9F2E6,stroke:#2E7D5B
    classDef sedang fill:#FDF6E3,stroke:#B8860B
    classDef lemah fill:#FDF0F4,stroke:#C2547A
    class A kuat
    class B,C sedang
    class D,E lemah
```

Telemetri sisi klien **tetap bisa dipalsukan** oleh orang yang menyusun
permintaannya sendiri lewat devtools. Yang tertutup adalah kecurangan santai
seperti tempel-lalu-tunggu, dan itu memang mayoritas kasusnya. Menyatakan batas
ini terbuka lebih berguna daripada mengklaim sistem yang tidak bisa diakali.

**Detektor eksternal tidak menaikkan tingkat kepercayaan, ia hanya memperbaiki
tebakan di lapisan terlemah.** Winston dilatih untuk tugas ini dan mengaku
mendukung bahasa Indonesia, jadi tebakannya lebih baik daripada lima sinyal
statistik. Tetapi ia tetap membaca teks, dan apa pun yang membaca teks bisa
dikalahkan parafrase. Itulah sebabnya bobot forensik proses tidak diturunkan
sedikit pun ketika detektor dipasang.

Satu pengecualian yang pantas dicatat: Winston juga melaporkan penyisipan
karakter lebar nol dan penggantian huruf dengan karakter mirip. Berbeda dari
sinyal gaya bahasa, keduanya tidak punya penjelasan polos, karena tidak ada
mahasiswa yang tanpa sengaja menempelkan karakter tak terlihat ke dalam esainya.
Temuan itu ditulis sebagai bukti di layar dosen, bukan ditambahkan diam-diam ke
angkanya.

---

## 4.5 Alur data lintas peran

> Entitas `Class` ditulis **`Kelas`** di diagram karena `Class` adalah kata
> kunci yang direbut parser Mermaid. Nama model Django sebenarnya tetap `Class`.

```mermaid
erDiagram
    Profile ||--o{ Kelas : "memiliki sebagai dosen"
    Profile ||--o{ ClassMembership : "mengikuti sebagai mahasiswa"
    Kelas ||--o{ ClassMembership : "beranggotakan"
    Kelas ||--o{ Assignment : "memuat"
    Assignment ||--o{ Submission : "menerima"
    Profile ||--o{ Submission : "mengumpulkan"
    Submission ||--|| AnalysisResult : "menghasilkan"
    Submission ||--o{ ReasoningEvent : "meninggalkan jejak"
    Submission ||--o| VerbalVerification : "dapat diverifikasi"

    Kelas {
        string name
        string subject
        string education_level "D3 S1 S2 S3"
        string program_studi
        int semester "1-14"
        string join_code "unik"
    }
    Assignment {
        string title
        int expected_bloom_level "1-6"
        datetime deadline
    }
    Submission {
        text text_answer
        datetime started_at
        datetime submitted_at
        int duration_seconds
        int revision_count
        int grade
    }
    AnalysisResult {
        int ai_score "0-100"
        string ai_band "low mid high"
        int bloom_level "1-6"
        json signal_breakdown
        string analysis_source "detector llm heuristic"
    }
    DetectorScore {
        string text_hash "SHA-256, teksnya sendiri tidak disimpan"
        string provider
        string model_version
        string language
        float ai_probability "0-1, SUDAH dibalik"
        bool reliable
        json attack_kinds
    }
    ReasoningEvent {
        string event_type "started revision paste submitted progress"
        json payload
        datetime occurred_at
    }
    VerbalVerification {
        string status "scheduled completed cancelled"
        string outcome "tanpa nilai terbukti menyontek"
        text notes
    }
```

Jenjang, program studi, dan semester melekat pada **Class**. Bukan pada
`Profile`, karena semester mahasiswa berubah tiap enam bulan sehingga datanya
akan basi terus. Bukan pada `Assignment`, karena duplikasi memungkinkan tugas S2
tersimpan di dalam kelas S1.

`DetectorScore` sengaja **tidak** punya relasi ke `Submission`, dan itu bukan
kelalaian. Kuncinya adalah hash teks, bukan identitas submission, supaya dua
submission dengan teks yang persis sama hanya dibayar sekali ke penyedia yang
menagih per kata. Kalau kuncinya diikat ke submission, tombol Analisis Ulang
pada teks yang tidak berubah akan membayar penuh lagi, dan dosen menekan tombol
itu justru ketika ia ragu pada angkanya.

Teks jawabannya sendiri tidak ikut disalin ke tabel itu, hanya SHA-256 nya.
Jawabannya sudah ada di `Submission.text_answer`, dan menyalinnya ke tabel kedua
hanya menggandakan data pribadi mahasiswa tanpa menambah apa pun.

Provider, versi model, dan bahasa ikut menjadi kunci, bukan sekadar catatan.
Menaikkan versi model otomatis membatalkan seluruh cache lama tanpa ada yang
perlu ingat menghapusnya, karena skor lama berasal dari model yang berbeda.
