import type { Metadata } from "next";

import { Footer } from "@/components/common/Footer";
import {
  Bullets,
  ExternalLink,
  PolicySection,
  PolicyTable,
  Ref,
} from "@/components/privacy/PolicyParts";
import { PublicHeader } from "@/components/privacy/PublicHeader";
import {
  PRIVACY_CONTACT_EMAIL,
  PRIVACY_POLICY_EFFECTIVE_LABEL,
  PRIVACY_POLICY_VERSION,
} from "@/lib/privacy";

export const metadata: Metadata = {
  title: "Kebijakan Privasi · ThinkPath",
  description:
    "Data apa yang diproses ThinkPath, untuk apa, siapa yang dapat melihatnya, dan hak Anda menurut UU No. 27 Tahun 2022.",
};

const UU_PDP_URL = "https://peraturan.bpk.go.id/Details/229798/uu-no-27-tahun-2022";

const SECTIONS = [
  { id: "ringkasan", title: "Ringkasan" },
  { id: "tentang", title: "Tentang dokumen ini" },
  { id: "pengendali", title: "Siapa yang bertanggung jawab" },
  { id: "data-yang-dikumpulkan", title: "Data yang kami proses" },
  { id: "tidak-dikumpulkan", title: "Yang tidak kami kumpulkan" },
  { id: "tujuan", title: "Tujuan dan dasar pemrosesan" },
  { id: "analisis-otomatis", title: "Analisis otomatis dan pemrofilan" },
  { id: "akses", title: "Siapa yang dapat melihat data" },
  { id: "penyedia-layanan", title: "Penyedia layanan dan transfer ke luar negeri" },
  { id: "retensi", title: "Penyimpanan dan penghapusan" },
  { id: "keamanan", title: "Keamanan" },
  { id: "hak", title: "Hak Anda" },
  { id: "anak", title: "Pengguna di bawah 18 tahun" },
  { id: "cookie", title: "Cookie dan penyimpanan di perangkat" },
  { id: "demo", title: "Akun demo" },
  { id: "perubahan", title: "Perubahan kebijakan" },
  { id: "kontak", title: "Kontak dan pengaduan" },
  { id: "rujukan", title: "Rujukan" },
];

function number(id: string): number {
  return SECTIONS.findIndex((section) => section.id === id);
}

function ContactLine() {
  if (PRIVACY_CONTACT_EMAIL) {
    return (
      <>
        Kirim permohonan ke{" "}
        <a
          href={`mailto:${PRIVACY_CONTACT_EMAIL}`}
          className="font-medium text-primary underline-offset-2 hover:underline"
        >
          {PRIVACY_CONTACT_EMAIL}
        </a>{" "}
        dengan subjek &ldquo;Permohonan Data Pribadi&rdquo;, dari alamat email akun Anda.
      </>
    );
  }
  return (
    <>
      Alamat email khusus untuk permohonan data pribadi belum dibuka. Sementara itu,
      sampaikan permohonan secara tertulis kepada dosen pengampu kelas Anda, yang akan
      meneruskannya kepada tim pengelola ThinkPath.
    </>
  );
}

export default function PrivacyPolicyPage() {
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <PublicHeader />

      <main className="mx-auto w-full max-w-[1120px] flex-1 px-4 py-10 sm:px-6">
        <div className="max-w-3xl space-y-3">
          <p className="caption-eyebrow text-primary">Pelindungan data pribadi</p>
          <h1 className="text-display-2 font-extrabold tracking-tight">Kebijakan Privasi ThinkPath</h1>
          <p className="text-body-lg text-muted-foreground">
            Dokumen ini menjelaskan data apa yang diproses ThinkPath, untuk apa, siapa yang
            dapat melihatnya, di mana data disimpan, dan apa hak Anda menurut Undang-Undang
            Nomor 27 Tahun 2022 tentang Pelindungan Data Pribadi (UU PDP).
          </p>
          <p className="text-body-sm text-muted-foreground">
            Versi {PRIVACY_POLICY_VERSION} · Berlaku sejak {PRIVACY_POLICY_EFFECTIVE_LABEL}
          </p>
        </div>

        <div className="mt-10 grid grid-cols-1 gap-10 lg:grid-cols-[15rem_minmax(0,1fr)] lg:items-start">
          <nav aria-label="Daftar isi" className="lg:sticky lg:top-6">
            <details className="group rounded-xl border border-border bg-card p-4 lg:hidden">
              <summary className="cursor-pointer font-semibold text-foreground">Daftar isi</summary>
              <TocList />
            </details>
            <div className="hidden lg:block">
              <p className="caption-eyebrow mb-2 px-3">Daftar isi</p>
              <TocList />
            </div>
          </nav>

          <article className="min-w-0 max-w-3xl space-y-12">
            <section
              id="ringkasan"
              className="scroll-mt-6 rounded-2xl border border-brand-mint bg-secondary/40 p-5 sm:p-6"
            >
              <h2 className="text-xl font-bold tracking-tight">Ringkasan</h2>
              <div className="mt-3 text-body leading-relaxed text-foreground/90">
                <Bullets
                  items={[
                    "Saat mengerjakan tugas, yang dicatat hanya jumlah kata setiap 30 detik, waktu mulai dan kumpul, serta jumlah revisi. Isi ketikan per detik, tindakan menempel, layar, kamera, dan lokasi tidak direkam.",
                    "Jawaban dianalisis otomatis untuk level Bloom dan indikasi penggunaan AI. Hasilnya bahan tinjau dosen, bukan vonis: ThinkPath tidak memberi nilai, tidak menjatuhkan sanksi, dan tidak menyimpulkan kecurangan.",
                    "Skor indikasi AI hanya terlihat oleh dosen pengampu kelas Anda. Dosen hanya melihat data dari kelasnya sendiri.",
                    "Teks jawaban hanya dikirim ke penyedia analisis di luar negeri (Groq dan Winston AI) bila Anda mengizinkannya, dan izin itu bisa dicabut kapan saja.",
                    "Data disimpan pada penyedia cloud di luar Indonesia. Data Anda tidak dipakai untuk iklan, tidak dijual, dan tidak dipakai untuk melatih model AI.",
                    "Anda berhak mengakses, memperbaiki, menghapus, menarik persetujuan, dan mengajukan keberatan. Caranya dijelaskan di bagian Hak Anda.",
                  ]}
                />
              </div>
            </section>

            <PolicySection id="tentang" number={number("tentang")} title="Tentang dokumen ini">
              <p>
                Kebijakan ini berlaku untuk aplikasi web ThinkPath di thinkpath.vercel.app
                beserta API yang melayaninya. Istilahnya mengikuti UU PDP: <b>Data Pribadi</b>{" "}
                adalah data tentang orang perseorangan yang teridentifikasi atau dapat
                diidentifikasi; <b>Pengendali Data Pribadi</b> adalah pihak yang menentukan
                tujuan dan mengendalikan pemrosesan; <b>Prosesor Data Pribadi</b> memproses
                data atas nama Pengendali; dan <b>Subjek Data Pribadi</b> adalah orang yang
                datanya diproses, yaitu Anda. <Ref>Pasal 1 angka 1, 4, 5, dan 6</Ref>
              </p>
              <p>
                Setiap pernyataan tentang cara kerja ThinkPath di sini disusun dari kode
                sumber versi yang berlaku, bukan dari rencana. Pemetaan setiap pasal ke
                bagian kode yang melaksanakannya tercatat di dokumentasi proyek, berkas{" "}
                <code className="rounded bg-muted px-1.5 py-0.5 text-body-sm">
                  diagram/07-privasi-dan-persetujuan.md
                </code>
                .
              </p>
            </PolicySection>

            <PolicySection
              id="pengendali"
              number={number("pengendali")}
              title="Siapa yang bertanggung jawab"
            >
              <p>
                ThinkPath dikembangkan dan dioperasikan oleh Tim DataDigger, Universitas Bina
                Nusantara, sebagai prototipe untuk GEMASTIK XIX 2026. Untuk layanan di alamat
                ini, Tim DataDigger adalah Pengendali Data Pribadi.
              </p>
              <p>
                Bila sebuah perguruan tinggi memakai ThinkPath untuk perkuliahan resminya,
                perguruan tinggi itulah Pengendali, dan pengelola teknis ThinkPath menjadi
                Prosesor yang memproses data atas namanya. Kebijakan privasi perguruan tinggi
                tersebut berlaku berdampingan dengan dokumen ini.
              </p>
              <p>
                Dosen yang membuat kelas memakai data mahasiswa di kelasnya untuk perkuliahan.
                Saat pertama masuk, setiap dosen menyatakan akan menjaga kerahasiaan data itu
                dan tidak menjatuhkan sanksi hanya berdasarkan skor.
              </p>
              <p>
                <ContactLine />
              </p>
            </PolicySection>

            <PolicySection
              id="data-yang-dikumpulkan"
              number={number("data-yang-dikumpulkan")}
              title="Data yang kami proses"
            >
              <PolicyTable
                columns={["Jenis data", "Rinciannya", "Asalnya", "Catatan"]}
                rows={[
                  [
                    "Akun",
                    "Email, nama tampilan, peran (dosen atau mahasiswa), jenjang studi bila diisi, tanggal pendaftaran.",
                    "Anda, saat mendaftar dan di Pengaturan.",
                    "Kata sandi hanya disimpan sebagai hash PBKDF2-SHA256, tidak pernah dalam bentuk aslinya.",
                  ],
                  [
                    "Kelas",
                    "Kelas yang Anda ikuti atau buat dan waktu bergabung. Untuk dosen: nama kelas, mata kuliah, jenjang, program studi, semester, dan kode gabung.",
                    "Anda dan dosen.",
                    "",
                  ],
                  [
                    "Tugas dan materi",
                    "Judul, instruksi, tenggat, dan target level Bloom tugas; judul, topik, ringkasan, dan tautan materi.",
                    "Dosen.",
                    "",
                  ],
                  [
                    "Jawaban",
                    "Teks jawaban, waktu mulai, waktu kumpul, durasi, jumlah revisi setelah dikumpulkan, dan status.",
                    "Mahasiswa. Waktu mulai dikirim peramban.",
                    "",
                  ],
                  [
                    "Jejak proses menulis",
                    "Jumlah kata dalam jawaban setiap 30 detik selama form terbuka, paling banyak 240 cuplikan (sekitar dua jam).",
                    "Peramban mahasiswa.",
                    "Hanya angka jumlah kata, bukan teksnya. Cuplikan di luar rentang mulai sampai kumpul dibuang server.",
                  ],
                  [
                    "Hasil analisis",
                    "Level Bloom beserta keyakinan dan buktinya; skor indikasi AI 0-100, band, rincian sinyal dan buktinya; ringkasan dan rekomendasi untuk dosen; sumber analisis.",
                    "Dihitung sistem.",
                    "Lihat bagian Analisis otomatis.",
                  ],
                  ["Penilaian", "Nilai dan umpan balik.", "Dosen.", ""],
                  [
                    "Sesi diskusi jawaban",
                    "Jadwal, status, kesimpulan, dan catatan dosen.",
                    "Dosen.",
                    "Kesimpulan dan catatan tidak ditampilkan kepada mahasiswa.",
                  ],
                  [
                    "Notifikasi",
                    "Judul, isi singkat, tautan, waktu, dan status dibaca.",
                    "Dihitung sistem.",
                    "",
                  ],
                  [
                    "Persetujuan",
                    "Versi kebijakan, butir yang disetujui, pilihan opsional, dan waktu memberi, mengubah, atau menarik persetujuan.",
                    "Anda.",
                    "Bukti persetujuan yang wajib dapat ditunjukkan (Pasal 24).",
                  ],
                  [
                    "Sidik jari teks",
                    "Hash SHA-256 dari teks jawaban beserta skor detektor untuk teks itu.",
                    "Dihitung sistem.",
                    "Teksnya sendiri tidak disimpan di sini dan tidak terhubung ke akun. Gunanya agar teks yang sama tidak dikirim dua kali ke detektor.",
                  ],
                  [
                    "Data teknis",
                    "Token login di cookie; alamat IP saat Anda masuk atau mendaftar.",
                    "Peramban Anda.",
                    "Alamat IP hanya diproses sementara di memori server untuk membatasi percobaan masuk dan pendaftaran, tidak disimpan di basis data.",
                  ],
                ]}
              />
              <p>
                Data di atas tergolong Data Pribadi yang bersifat umum. ThinkPath tidak meminta
                data yang bersifat spesifik seperti data kesehatan, biometrik, genetika, catatan
                kejahatan, atau keuangan pribadi. <Ref>Pasal 4 ayat (2) dan (3)</Ref> Bila Anda
                belum berusia 18 tahun, data Anda termasuk data anak yang bersifat spesifik;
                lihat bagian Pengguna di bawah 18 tahun.
              </p>
              <p>
                Jawaban esai bisa saja memuat cerita atau informasi pribadi yang Anda tulis
                sendiri. Tulislah hanya yang diperlukan tugas, dan hindari menulis data orang
                lain.
              </p>
            </PolicySection>

            <PolicySection
              id="tidak-dikumpulkan"
              number={number("tidak-dikumpulkan")}
              title="Yang tidak kami kumpulkan"
            >
              <Bullets
                items={[
                  "Isi ketikan per detik atau urutan tombol yang ditekan.",
                  "Tindakan menempel (copy-paste) maupun isi papan klip. Menempel kutipan dari sumber yang Anda rujuk adalah hal wajar dalam menulis akademik.",
                  "Rekaman layar, kamera, mikrofon, atau lokasi.",
                  "Riwayat penelusuran, daftar kontak, atau data lain dari perangkat Anda.",
                  "NIK, NIM, nomor telepon, atau alamat rumah.",
                  "Cookie iklan, pelacak, atau analitik pihak ketiga.",
                ]}
              />
            </PolicySection>

            <PolicySection id="tujuan" number={number("tujuan")} title="Tujuan dan dasar pemrosesan">
              <p>
                Setiap pemrosesan wajib memiliki dasar yang sah. <Ref>Pasal 20</Ref> Berikut
                tujuan pemrosesan di ThinkPath beserta dasarnya.
              </p>
              <PolicyTable
                columns={["Tujuan", "Data yang dipakai", "Dasar (Pasal 20 ayat (2))"]}
                rows={[
                  [
                    "Membuat akun dan menjaga Anda tetap masuk",
                    "Akun, token login",
                    "Persetujuan (huruf a) dan permintaan Anda saat mendaftar (huruf b)",
                  ],
                  [
                    "Menjalankan perkuliahan: kelas, tugas, pengumpulan, nilai, umpan balik, materi, jadwal, dan notifikasi",
                    "Kelas, tugas, materi, jawaban, penilaian, notifikasi",
                    "Persetujuan (huruf a)",
                  ],
                  [
                    "Merekam proses menulis dan menganalisis jawaban secara otomatis sebagai bahan tinjau dosen",
                    "Jejak proses, jawaban, hasil analisis",
                    "Persetujuan (huruf a)",
                  ],
                  [
                    "Analisis tambahan oleh penyedia di luar negeri",
                    "Teks jawaban dan jenjang studi",
                    "Persetujuan terpisah yang boleh ditolak (huruf a), sekaligus dasar transfer ke luar negeri (Pasal 56 ayat (4))",
                  ],
                  [
                    "Menjaga keamanan layanan: membatasi percobaan masuk dan pendaftaran, mencatat galat",
                    "Alamat IP sementara, log galat server",
                    "Kepentingan yang sah (huruf f)",
                  ],
                  [
                    "Menyimpan bukti persetujuan",
                    "Catatan persetujuan",
                    "Kewajiban hukum (huruf c), karena Pasal 24 mewajibkan bukti persetujuan",
                  ],
                ]}
              />
              <p>
                Data Anda tidak dipakai untuk iklan, tidak dijual, dan tidak dipakai untuk
                melatih model AI. Kalibrasi model ThinkPath memakai abstrak jurnal ilmiah yang
                terbuka untuk publik dari OpenAlex, bukan jawaban mahasiswa.
              </p>
            </PolicySection>

            <PolicySection
              id="analisis-otomatis"
              number={number("analisis-otomatis")}
              title="Analisis otomatis dan pemrofilan"
            >
              <p>Setiap jawaban yang dikumpulkan dianalisis otomatis menjadi dua hasil yang terpisah:</p>
              <Bullets
                items={[
                  <>
                    <b>Level Bloom (L1-L6)</b>, yaitu taksiran level penalaran yang ditunjukkan
                    jawaban, dibandingkan dengan target yang ditetapkan dosen. Mahasiswa dapat
                    melihat level dan perkembangannya sendiri di halaman Progres.
                  </>,
                  <>
                    <b>Indikasi penggunaan AI (0-100)</b>, yaitu gabungan lima sinyal gaya teks
                    dan satu sinyal proses, yakni bentuk kurva pertumbuhan kata. Bila Anda
                    mengizinkan, skor teks berasal dari detektor Winston AI atau model Groq; bila
                    tidak, dari heuristik di server ThinkPath.
                  </>,
                ]}
              />
              <p>
                Menurut UU PDP, kegiatan ini termasuk pemrofilan dan penskoran yang sistematis.{" "}
                <Ref>Penjelasan Pasal 10 ayat (1); Pasal 34 ayat (2) huruf d</Ref>
              </p>
              <p>
                <b>Bagaimana hasilnya dipakai.</b> Hasil analisis hanya ditampilkan kepada dosen
                pengampu sebagai bahan tinjau. ThinkPath tidak memberi nilai, tidak menjatuhkan
                sanksi, dan tidak menyimpulkan kecurangan; pilihan kesimpulan sesi diskusi
                jawaban pun sengaja tidak memuat &ldquo;terbukti menyontek&rdquo;. Setiap tindak
                lanjut adalah keputusan dosen, misalnya mengundang Anda ke sesi diskusi jawaban
                untuk menjelaskan jawaban Anda sendiri. Jadi tidak ada keputusan yang hanya
                didasarkan pada pemrosesan otomatis. <Ref>Pasal 10 ayat (1)</Ref>
              </p>
              <p>
                Skor indikasi AI tidak ditampilkan di layar mahasiswa. Anda tetap berhak meminta
                salinannya beserta rinciannya. <Ref>Pasal 7</Ref>
              </p>
              <p>
                <b>Keterbatasan yang perlu Anda ketahui.</b> Angka-angka ini belum sempurna, dan
                kami menyebutkannya apa adanya:
              </p>
              <Bullets
                items={[
                  "Heuristik ThinkPath terukur ROC-AUC 0,900 pada 999 abstrak jurnal ilmiah, bukan pada esai mahasiswa. Ketepatannya pada esai mahasiswa belum diukur.",
                  "Ambang band tinggi (70) belum terukur, karena tidak ada sampel data kalibrasi yang mencapainya.",
                  "Detektor Winston AI belum diukur pada teks berbahasa Indonesia, sehingga keyakinan atas skornya sengaja dibatasi.",
                  "Level Bloom belum divalidasi oleh penilai manusia.",
                  "Jawaban di bawah 120 kata berada di luar rentang panjang data kalibrasi.",
                  "Jawaban yang seluruhnya muncul sekaligus menaikkan skor proses. Satu kutipan 60 kata di tengah esai yang ditulis bertahap hanya menambah sekitar 4 poin.",
                ]}
              />
              <p>
                <b>Hak Anda atas analisis ini.</b> Anda dapat mengajukan keberatan atas hasil
                analisis, meminta penjelasan, dan meminta dosen meninjau ulang dengan mendengar
                penjelasan Anda. <Ref>Pasal 10 ayat (1)</Ref>
              </p>
              <p>
                <b>Penilaian dampak.</b> Karena termasuk penskoran yang sistematis, pemrosesan
                ini memerlukan penilaian dampak pelindungan data pribadi. <Ref>Pasal 34</Ref>{" "}
                Penilaian dampak awal tim untuk prototipe ini dicatat di dokumentasi proyek.
                Perguruan tinggi yang memakai ThinkPath secara resmi perlu melakukan penilaian
                dampaknya sendiri sebelum penggunaan.
              </p>
            </PolicySection>

            <PolicySection id="akses" number={number("akses")} title="Siapa yang dapat melihat data">
              <PolicyTable
                columns={["Pihak", "Dapat melihat", "Tidak dapat melihat"]}
                rows={[
                  [
                    "Anda sendiri (mahasiswa)",
                    "Akun, jawaban, status, nilai, umpan balik, level Bloom dan perkembangannya, jadwal, materi, notifikasi, dan riwayat persetujuan Anda.",
                    "Skor indikasi AI, serta kesimpulan dan catatan sesi diskusi.",
                  ],
                  [
                    "Dosen pengampu kelas",
                    "Nama tampilan (atau email bila nama tampilan dikosongkan), jawaban, jejak proses, hasil analisis lengkap, dan profil kognitif dari kelasnya sendiri.",
                    "Data Anda di kelas dosen lain.",
                  ],
                  ["Mahasiswa lain", "Tidak ada.", "Jawaban, nilai, dan hasil analisis Anda."],
                  [
                    "Tim pengelola ThinkPath",
                    "Akses teknis ke basis data untuk pemeliharaan dan untuk menangani permohonan Anda, dengan kewajiban menjaga kerahasiaan (Pasal 36).",
                    "",
                  ],
                  ["Penyedia layanan", "Lihat bagian berikut.", ""],
                  [
                    "Pihak lain",
                    "Tidak kami berikan, kecuali diwajibkan peraturan perundang-undangan.",
                    "",
                  ],
                ]}
              />
            </PolicySection>

            <PolicySection
              id="penyedia-layanan"
              number={number("penyedia-layanan")}
              title="Penyedia layanan dan transfer ke luar negeri"
            >
              <p>
                ThinkPath memakai penyedia berikut untuk memproses data. Semuanya berkedudukan
                atau menyimpan data di luar Indonesia.
              </p>
              <PolicyTable
                columns={["Penyedia", "Peran", "Data yang diterima", "Lokasi dan catatan"]}
                rows={[
                  [
                    "Vercel Inc.",
                    "Menyajikan antarmuka web.",
                    "Halaman yang Anda buka beserta cookie token login.",
                    <>
                      Perusahaan Amerika Serikat.{" "}
                      <ExternalLink href="https://vercel.com/legal/privacy-policy">
                        Kebijakan privasi Vercel
                      </ExternalLink>
                    </>,
                  ],
                  [
                    "Hugging Face, Inc.",
                    "Menjalankan server API.",
                    "Seluruh data yang dikirim ke dan dari API.",
                    <>
                      Perusahaan Amerika Serikat.{" "}
                      <ExternalLink href="https://huggingface.co/privacy">
                        Kebijakan privasi Hugging Face
                      </ExternalLink>
                    </>,
                  ],
                  [
                    "Supabase, Inc.",
                    "Basis data PostgreSQL.",
                    "Seluruh data yang disimpan ThinkPath.",
                    <>
                      Server basis data di Singapura.{" "}
                      <ExternalLink href="https://supabase.com/privacy">
                        Kebijakan privasi Supabase
                      </ExternalLink>
                    </>,
                  ],
                  [
                    "Groq, Inc. (hanya bila Anda mengizinkan)",
                    "Analisis teks: taksiran level Bloom dan indikasi AI.",
                    "Teks jawaban dan jenjang studi, tanpa nama atau email.",
                    <>
                      Amerika Serikat. Menurut dokumentasinya, Groq secara bawaan tidak menyimpan
                      data permintaan; log untuk menangani galat atau penyalahgunaan disimpan
                      paling lama 30 hari. Perjanjian layanannya melarang pemakaian input dan
                      output untuk melatih model.{" "}
                      <ExternalLink href="https://console.groq.com/docs/your-data">
                        Data di GroqCloud
                      </ExternalLink>
                    </>,
                  ],
                  [
                    "Winston AI Inc. (hanya bila Anda mengizinkan)",
                    "Deteksi teks buatan AI.",
                    "Teks jawaban sepanjang 300 sampai 150.000 karakter, tanpa nama atau email.",
                    <>
                      Kanada. Menurut kebijakan privasinya, teks yang dinilai disimpan sebagai
                      laporan di dasbor akun ThinkPath sampai laporan itu dihapus, cadangan
                      terenkripsi disimpan hingga 90 hari setelahnya, dan konten yang dapat
                      diidentifikasi secara individual tidak dipakai melatih model tanpa
                      persetujuan eksplisit.{" "}
                      <ExternalLink href="https://gowinston.ai/privacy-policy/">
                        Kebijakan privasi Winston AI
                      </ExternalLink>
                    </>,
                  ],
                ]}
              />
              <p>
                UU PDP membolehkan transfer ke luar negeri bila negara penerima memiliki
                pelindungan yang setara atau lebih tinggi, atau bila ada pelindungan yang memadai
                dan mengikat. Bila keduanya tidak terpenuhi, transfer wajib atas persetujuan
                Subjek Data Pribadi. <Ref>Pasal 56 ayat (2) sampai (4)</Ref> Kami belum menilai
                kesetaraan itu secara formal, sehingga seluruh transfer di atas kami dasarkan
                pada persetujuan Anda: persetujuan wajib untuk penyimpanan dan server aplikasi,
                serta persetujuan terpisah yang boleh Anda tolak untuk Groq dan Winston AI.
              </p>
            </PolicySection>

            <PolicySection id="retensi" number={number("retensi")} title="Penyimpanan dan penghapusan">
              <Bullets
                items={[
                  "Data disimpan selama akun Anda dan kelas terkait masih ada. ThinkPath belum menghapus data secara otomatis menurut jadwal; penghapusan dilakukan atas permintaan.",
                  "Bila Anda meminta penghapusan, tim pengelola menghapus akun beserta jawaban, hasil analisis, notifikasi, dan catatan persetujuan yang terkait, lalu memberitahukannya kepada Anda (Pasal 43 dan 45). Jawaban dan nilai di kelas dosen ikut terhapus; beri tahu dosen Anda bila nilainya masih diperlukan untuk catatan akademik.",
                  "Untuk akun dosen, penghapusan ikut menghapus kelas, tugas, materi, dan seluruh jawaban mahasiswa di dalam kelas itu. Karena menyangkut data orang lain, kami mengonfirmasi dulu kepada dosen sebelum melaksanakannya.",
                  "Menarik persetujuan tidak otomatis menghapus data yang sudah ada. Pemrosesan baru berhenti seketika, sedangkan data lama tetap tersimpan sampai Anda meminta penghapusan.",
                  "Laporan di dasbor Winston AI dapat kami hapus atas permintaan Anda; cadangannya terhapus dalam 90 hari sesuai kebijakan Winston AI. Log Groq terhapus sendiri paling lama 30 hari.",
                  "Sidik jari SHA-256 di cache detektor tidak terhubung ke akun, sehingga tidak ikut terhapus. Teks jawaban tidak dapat dipulihkan dari sidik jari itu.",
                ]}
              />
            </PolicySection>

            <PolicySection id="keamanan" number={number("keamanan")} title="Keamanan">
              <p>
                Kami wajib melindungi data dari akses dan pemrosesan yang tidak sah.{" "}
                <Ref>Pasal 35 sampai 39</Ref> Langkah yang sudah berjalan:
              </p>
              <Bullets
                items={[
                  "Kata sandi disimpan sebagai hash PBKDF2-SHA256 bawaan Django, tidak pernah dalam bentuk aslinya.",
                  "Token login ditandatangani server (JWT HS256) dan berlaku 7 hari. Cookie-nya memakai SameSite=Lax dan Secure di HTTPS.",
                  "Koneksi produksi wajib HTTPS, dengan HSTS selama satu tahun.",
                  "Setiap permintaan data diperiksa kepemilikannya: dosen hanya ke kelasnya sendiri, mahasiswa hanya ke datanya sendiri.",
                  "Percobaan masuk dibatasi 20 per menit dan pendaftaran 30 per jam untuk setiap alamat IP.",
                  "Data yang dikirim ke penyedia analisis tidak menyertakan nama atau email.",
                ]}
              />
              <p>
                <b>Keterbatasan yang kami ketahui.</b> Cookie token login belum berstatus
                HttpOnly, sehingga dapat dibaca skrip di halaman; bila suatu saat ada celah
                XSS, token bisa dicuri. Perbaikannya, yaitu memindahkan sesi ke sisi server,
                sudah direncanakan. Batas percobaan masuk dihitung per proses server, sehingga
                pada dua proses batas efektifnya dua kali lipat.
              </p>
              <p>
                Bila terjadi kegagalan pelindungan data, kami memberitahu Anda dan lembaga
                secara tertulis paling lambat 3 × 24 jam. Pemberitahuan itu memuat data yang
                terungkap, kapan dan bagaimana data terungkap, serta upaya penanganan dan
                pemulihannya. <Ref>Pasal 46</Ref>
              </p>
            </PolicySection>

            <PolicySection id="hak" number={number("hak")} title="Hak Anda">
              <PolicyTable
                columns={["Hak", "Dasar", "Cara menggunakannya", "Waktu tanggapan"]}
                rows={[
                  ["Mendapat informasi yang jelas", "Pasal 5", "Dokumen ini.", "-"],
                  [
                    "Memperbarui atau memperbaiki data",
                    "Pasal 6 dan 30",
                    "Ubah nama tampilan dan jenjang di Pengaturan. Data lain lewat permohonan.",
                    "Paling lambat 3 × 24 jam (Pasal 30)",
                  ],
                  [
                    "Mengakses dan memperoleh salinan",
                    "Pasal 7 dan 32",
                    "Sebagian terlihat langsung di aplikasi. Salinan lengkap, termasuk hasil analisis dan jejak proses, lewat permohonan tanpa biaya (Penjelasan Pasal 7).",
                    "Paling lambat 3 × 24 jam (Pasal 32)",
                  ],
                  [
                    "Mengakhiri pemrosesan, menghapus, atau memusnahkan data",
                    "Pasal 8, 43, dan 44",
                    "Lewat permohonan.",
                    "Hasilnya diberitahukan kepada Anda (Pasal 45)",
                  ],
                  [
                    "Menarik persetujuan",
                    "Pasal 9 dan 40",
                    "Pengaturan, bagian Privasi dan persetujuan, tombol Tarik persetujuan.",
                    "Seketika untuk pemrosesan baru; batas UU paling lambat 3 × 24 jam (Pasal 40)",
                  ],
                  [
                    "Mengajukan keberatan atas hasil analisis otomatis",
                    "Pasal 10",
                    "Langsung kepada dosen pengampu, atau lewat permohonan.",
                    "-",
                  ],
                  [
                    "Menunda atau membatasi pemrosesan",
                    "Pasal 11 dan 41",
                    "Lewat permohonan. Pengiriman ke penyedia di luar negeri bisa Anda hentikan sendiri di Pengaturan.",
                    "Paling lambat 3 × 24 jam (Pasal 41)",
                  ],
                  [
                    "Menggugat dan menerima ganti rugi",
                    "Pasal 12",
                    "Sesuai peraturan perundang-undangan.",
                    "-",
                  ],
                  [
                    "Mendapatkan dan memindahkan data",
                    "Pasal 13",
                    "Salinan dalam format yang dapat dibaca sistem (JSON), lewat permohonan.",
                    "-",
                  ],
                ]}
              />
              <p>
                Permohonan diajukan secara tercatat, secara elektronik atau nonelektronik.{" "}
                <Ref>Pasal 14</Ref> <ContactLine />
              </p>
              <p>
                Beberapa hak dapat dikecualikan untuk kepentingan tertentu yang diatur
                undang-undang, misalnya penegakan hukum. <Ref>Pasal 15</Ref> Kami juga wajib
                menolak akses yang akan mengungkap data pribadi orang lain, sehingga salinan
                data Anda tidak memuat data mahasiswa lain. <Ref>Pasal 33</Ref>
              </p>
            </PolicySection>

            <PolicySection id="anak" number={number("anak")} title="Pengguna di bawah 18 tahun">
              <p>
                Pemrosesan data anak wajib mendapat persetujuan orang tua dan/atau wali.{" "}
                <Ref>Pasal 25</Ref> Anak adalah seseorang yang belum berusia 18 tahun.{" "}
                <Ref>UU No. 35 Tahun 2014 tentang Perubahan atas UU No. 23 Tahun 2002 tentang
                Perlindungan Anak, Pasal 1 angka 1</Ref>
              </p>
              <p>
                Saat menyetujui kebijakan ini, mahasiswa menyatakan berusia 18 tahun atau lebih,
                atau telah mendapat persetujuan orang tua atau wali. Bila kami mengetahui data
                anak diproses tanpa persetujuan tersebut, kami menghentikan pemrosesannya dan
                menghapus datanya.
              </p>
            </PolicySection>

            <PolicySection
              id="cookie"
              number={number("cookie")}
              title="Cookie dan penyimpanan di perangkat"
            >
              <p>
                ThinkPath hanya memakai satu cookie, <code className="rounded bg-muted px-1.5 py-0.5 text-body-sm">thinkpath_token</code>,
                yang berisi token login: id akun, email, peran, versi kebijakan yang Anda
                setujui, serta waktu terbit dan kedaluwarsanya. Cookie ini berlaku 7 hari dan
                dihapus saat Anda keluar.
              </p>
              <p>
                Tidak ada cookie iklan, pelacak, atau analitik, dan ThinkPath tidak menyimpan
                apa pun di localStorage atau sessionStorage peramban. Huruf pada halaman
                disajikan dari server ThinkPath sendiri, bukan diunduh dari Google saat halaman
                dibuka.
              </p>
            </PolicySection>

            <PolicySection id="demo" number={number("demo")} title="Akun demo">
              <p>
                Akun demo (dosen@thinkpath.local serta mhs01@thinkpath.local sampai
                mhs08@thinkpath.local) berisi data fiktif, dan kata sandinya diumumkan di README
                proyek. Siapa pun dapat masuk ke akun tersebut, jadi jangan menulis data pribadi
                sungguhan saat memakainya. Data demo dapat diatur ulang kapan saja.
              </p>
            </PolicySection>

            <PolicySection id="perubahan" number={number("perubahan")} title="Perubahan kebijakan">
              <p>
                Setiap versi kebijakan diberi tanggal. Bila isinya berubah, Anda akan diminta
                membaca dan menyetujui versi baru sebelum dapat melanjutkan memakai ThinkPath.{" "}
                <Ref>Pasal 21 ayat (2)</Ref>
              </p>
              <PolicyTable
                columns={["Versi", "Perubahan"]}
                rows={[[PRIVACY_POLICY_VERSION, "Versi pertama."]]}
              />
            </PolicySection>

            <PolicySection id="kontak" number={number("kontak")} title="Kontak dan pengaduan">
              <p>
                <ContactLine />
              </p>
              <p>
                Bila tanggapan kami tidak memuaskan, Anda dapat mengadu kepada lembaga
                penyelenggara pelindungan data pribadi yang ditetapkan Presiden. Lembaga ini
                antara lain bertugas mengawasi penyelenggaraan pelindungan data pribadi dan
                memfasilitasi penyelesaian sengketa di luar pengadilan.{" "}
                <Ref>Pasal 58 dan 59</Ref>
              </p>
            </PolicySection>

            <PolicySection id="rujukan" number={number("rujukan")} title="Rujukan">
              <Bullets
                items={[
                  <ExternalLink key="uu" href={UU_PDP_URL}>
                    Undang-Undang Nomor 27 Tahun 2022 tentang Pelindungan Data Pribadi, JDIH BPK
                  </ExternalLink>,
                  <ExternalLink key="groq-data" href="https://console.groq.com/docs/your-data">
                    Groq: Your Data in GroqCloud
                  </ExternalLink>,
                  <ExternalLink
                    key="groq-agreement"
                    href="https://console.groq.com/docs/legal/services-agreement"
                  >
                    Groq: Services Agreement, bagian 4.2
                  </ExternalLink>,
                  <ExternalLink key="winston" href="https://gowinston.ai/privacy-policy/">
                    Winston AI: Privacy Policy
                  </ExternalLink>,
                  <ExternalLink key="supabase" href="https://supabase.com/privacy">
                    Supabase: Privacy Policy
                  </ExternalLink>,
                  <ExternalLink key="vercel" href="https://vercel.com/legal/privacy-policy">
                    Vercel: Privacy Policy
                  </ExternalLink>,
                  <ExternalLink key="hf" href="https://huggingface.co/privacy">
                    Hugging Face: Privacy Policy
                  </ExternalLink>,
                ]}
              />
            </PolicySection>
          </article>
        </div>
      </main>

      <Footer />
    </div>
  );
}

function TocList() {
  return (
    <ol className="mt-2 space-y-0.5 text-body-sm">
      {SECTIONS.map((section, index) => (
        <li key={section.id}>
          <a
            href={`#${section.id}`}
            className="flex gap-2 rounded-lg px-3 py-1.5 text-muted-foreground transition hover:bg-muted hover:text-foreground"
          >
            <span className="w-5 shrink-0 tabular-nums text-muted-foreground/70">
              {index === 0 ? "" : index}
            </span>
            <span>{section.title}</span>
          </a>
        </li>
      ))}
    </ol>
  );
}
