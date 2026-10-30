import {
  Bullets,
  ExternalLink,
  PolicySection,
  PolicyTable,
  Ref,
} from "@/features/privacy/components/PolicyParts";
import { PRIVACY_CONTACT_EMAIL, PRIVACY_POLICY_VERSION } from "@/lib/privacy";
import { cn } from "@/lib/utils";

const UU_PDP_URL = "https://peraturan.bpk.go.id/Details/229798/uu-no-27-tahun-2022";

/** Daftar bagian kebijakan; dipakai daftar isi di halaman dan penomoran di sini. */
export const POLICY_SECTIONS = [
  { id: "ringkasan", title: "Ringkasan" },
  { id: "tentang", title: "Tentang dokumen ini" },
  { id: "pengendali", title: "Siapa yang bertanggung jawab" },
  { id: "data-yang-dikumpulkan", title: "Data yang kami proses" },
  { id: "tidak-dikumpulkan", title: "Yang tidak kami kumpulkan" },
  { id: "tujuan", title: "Tujuan dan dasar pemrosesan" },
  { id: "persetujuan", title: "Persetujuan dan buktinya" },
  { id: "analisis-otomatis", title: "Analisis otomatis dan pemrofilan" },
  { id: "cek-paham", title: "Cek Paham (tes lisan)" },
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
  return POLICY_SECTIONS.findIndex((section) => section.id === id);
}

function ContactLine() {
  if (PRIVACY_CONTACT_EMAIL) {
    return (
      <>
        Kirim permohonan ke{" "}
        <a
          href={`mailto:${PRIVACY_CONTACT_EMAIL}`}
          className="font-medium text-brand-ink underline-offset-2 hover:underline"
        >
          {PRIVACY_CONTACT_EMAIL}
        </a>{" "}
        dengan subjek &ldquo;Permohonan Data Pribadi&rdquo;, dari alamat email akun Anda.
      </>
    );
  }
  return (
    <>
      Alamat email khusus untuk permohonan data pribadi belum dibuka. Sementara itu, sampaikan
      permohonan secara tertulis kepada dosen pengampu kelas Anda, yang akan meneruskannya kepada
      tim pengelola ThinkPath.
    </>
  );
}

/**
 * Isi lengkap Kebijakan Privasi (tanpa kepala halaman). Dipakai halaman
 * `/kebijakan-privasi` dan jendela baca di form daftar, supaya yang dibaca
 * pengguna sebelum menyetujui selalu sama dengan yang tampil di halaman.
 */
export function PolicyArticle({ className }: { className?: string }) {
  return (
    <article className={cn("min-w-0 max-w-3xl space-y-12", className)}>
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
              "Skor indikasi AI hanya terlihat oleh dosen pengampu kelas Anda. Dosen hanya melihat data dari kelasnya sendiri. Dosen juga dapat melihat penanda gaya teks dan membandingkan jawaban Anda dengan jawaban mahasiswa lain pada tugas yang sama; mahasiswa lain tidak pernah melihatnya.",
              "Dokumen yang Anda kumpulkan disimpan selama akun Anda ada. Hanya rekaman suara Cek Paham yang dihapus otomatis, yaitu setelah 30 hari.",
              "Teman sekelas dapat melihat nama tampilan Anda di daftar anggota dan tulisan Anda di forum kelas. Jawaban, nilai, dan to-do Anda tidak terlihat oleh mahasiswa lain.",
              "Cek Paham (tes lisan) merekam suara Anda hanya selama sesi yang Anda mulai sendiri. Audio dihapus setelah 30 hari; transkrip dan hasil penilaiannya tetap tersimpan sebagai bahan tinjau dosen, bukan nilai dan bukan sanksi.",
              "Teks jawaban, gambar halaman dokumen scan atau foto yang Anda unggah, dan audio Cek Paham dikirim ke penyedia di luar negeri (Groq dan Winston AI) untuk dianalisis. Itu bagian dari persetujuan yang Anda berikan.",
              "Anda menyetujui kebijakan ini satu kali, dengan satu centang saat mendaftar. Bukti persetujuan (versi, waktu, dan tujuan) bisa dilihat di Pengaturan, dan persetujuan bisa ditarik kapan saja.",
              "Data disimpan di server di Jakarta, Indonesia. Halaman web disajikan oleh Vercel di Amerika Serikat, sehingga data yang Anda buka ikut melewati server Vercel. Data Anda tidak dipakai untuk iklan, tidak dijual, dan tidak dipakai untuk melatih model AI.",
              "Anda berhak mengakses, memperbaiki, menghapus, menarik persetujuan, dan mengajukan keberatan. Caranya dijelaskan di bagian Hak Anda.",
            ]}
          />
        </div>
      </section>

      <PolicySection id="tentang" number={number("tentang")} title="Tentang dokumen ini">
        <p>
          Kebijakan ini berlaku untuk aplikasi web ThinkPath di thinkpath.vercel.app beserta API
          yang melayaninya. Istilahnya mengikuti UU PDP: <b>Data Pribadi</b> adalah data tentang
          orang perseorangan yang teridentifikasi atau dapat diidentifikasi;{" "}
          <b>Pengendali Data Pribadi</b> adalah pihak yang menentukan tujuan dan mengendalikan
          pemrosesan; <b>Prosesor Data Pribadi</b> memproses data atas nama Pengendali; dan{" "}
          <b>Subjek Data Pribadi</b> adalah orang yang datanya diproses, yaitu Anda.{" "}
          <Ref>Pasal 1 angka 1, 4, 5, dan 6</Ref>
        </p>
        <p>
          Setiap pernyataan tentang cara kerja ThinkPath di sini disusun dari kode sumber versi yang
          berlaku, bukan dari rencana. Pemetaan setiap pasal ke bagian kode yang melaksanakannya
          tercatat di dokumentasi proyek, berkas{" "}
          <span className="rounded bg-muted px-1.5 py-0.5 text-body-sm font-semibold">
            diagram/07-privasi-dan-persetujuan.md
          </span>
          .
        </p>
      </PolicySection>

      <PolicySection
        id="pengendali"
        number={number("pengendali")}
        title="Siapa yang bertanggung jawab"
      >
        <p>
          ThinkPath dikembangkan dan dioperasikan oleh Tim DataDigger, Universitas Bina Nusantara,
          sebagai prototipe untuk GEMASTIK XIX 2026. Untuk layanan di alamat ini, Tim DataDigger
          adalah Pengendali Data Pribadi.
        </p>
        <p>
          Bila sebuah perguruan tinggi memakai ThinkPath untuk perkuliahan resminya, perguruan
          tinggi itulah Pengendali, dan pengelola teknis ThinkPath menjadi Prosesor yang memproses
          data atas namanya. Kebijakan privasi perguruan tinggi tersebut berlaku berdampingan dengan
          dokumen ini.
        </p>
        <p>
          Dosen yang membuat kelas memakai data mahasiswa di kelasnya untuk perkuliahan. Saat
          mendaftar, setiap dosen menyatakan akan menjaga kerahasiaan data itu dan tidak menjatuhkan
          sanksi hanya berdasarkan skor.
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
              "Judul, instruksi (boleh berformat: gambar kecil dan tautan), tenggat, dan target level Bloom tugas; judul, topik, ringkasan, dan tautan materi.",
              "Dosen.",
              "",
            ],
            [
              "Jawaban",
              "Teks jawaban beserta formatnya (judul, daftar, tabel, kode, rumus, tautan) dan gambar yang Anda sisipkan, waktu mulai, waktu kumpul, durasi, jumlah revisi setelah dikumpulkan, dan status.",
              "Mahasiswa. Waktu mulai dicatat server dari draf yang tersimpan otomatis.",
              "Gambar dikecilkan di peramban dan disimpan di dalam jawaban itu sendiri (maksimal 6 gambar), sehingga ikut terhapus bersama jawabannya. Hanya teks polos yang dianalisis; gambar, rumus, dan format tidak dikirim ke penyedia mana pun.",
            ],
            [
              "Dokumen unggahan",
              "Berkas PDF, DOCX, PNG, atau JPG (maksimal 10 MB) yang Anda unggah untuk mengisi jawaban, beserta teks hasil pembacaannya.",
              "Mahasiswa.",
              "Disimpan di server Jakarta selama akun Anda ada, supaya dosen dapat membuka berkas aslinya. Teks hasil pembacaan digabung dengan apa pun yang Anda tulis di kotak jawaban (misalnya nama atau NIM), dan gabungan itulah yang dianalisis. DOCX dan PDF berlapis teks dibaca di server; halaman gambar dikirim ke Groq hanya dengan izin Anda. Jawaban dari dokumen ditandai bagi dosen. Berkas yang tidak pernah dikumpulkan dibuang setelah 24 jam.",
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
              "Forum kelas",
              "Judul, isi, jenis (pengumuman atau diskusi), balasan, nama penulis, dan waktu.",
              "Dosen dan mahasiswa anggota kelas.",
              "Hanya dosen dan mahasiswa kelas itu yang melihatnya. Tulisan mahasiswa dihapus bersama akunnya; tulisan dosen tetap ada sebagai arsip kelas.",
            ],
            [
              "Daftar anggota kelas",
              "Nama tampilan dosen dan mahasiswa kelas itu.",
              "Anda, saat mendaftar dan di Pengaturan.",
              'Terlihat oleh anggota kelas yang sama. Email dan data lain tidak ditampilkan; akun tanpa nama tampil ditulis sebagai "Mahasiswa".',
            ],
            [
              "To-do pribadi",
              "Judul catatan, tenggat bila diisi, dan status selesai.",
              "Mahasiswa.",
              "Hanya terlihat oleh pemiliknya, tidak oleh dosen maupun mahasiswa lain.",
            ],
            [
              "Cek Paham: soal dan jadwal",
              "Soal konfirmasi, bahasa, batas waktu menjawab, jendela waktu pengerjaan, dan status.",
              "Dosen.",
              "",
            ],
            [
              "Cek Paham: jawaban lisan",
              "Rekaman audio jawaban, transkrip hasil pengenalan suara, serta jumlah pindah tab atau jendela, kesalahan mikrofon, dan lama hening selama sesi.",
              "Mahasiswa. Transkrip dihitung penyedia pengenalan suara.",
              "Audio dihapus otomatis setelah 30 hari. Audio uji mikrofon dan potongan caption langsung tidak disimpan di server ThinkPath. Transkrip tetap tersimpan.",
            ],
            [
              "Cek Paham: hasil penilaian",
              "Level tiap dimensi pemahaman, skor saran 0-100, ringkasan dan penanda untuk dosen, serta versi rubrik dan model yang dipakai.",
              "Dihitung sistem.",
              "Hanya terlihat oleh dosen pengampu; tidak ditampilkan kepada mahasiswa. Lihat bagian Cek Paham.",
            ],
            [
              "Cek Paham: laporan kendala",
              "Kategori kendala, catatan mahasiswa, dan tanggapan dosen.",
              "Mahasiswa dan dosen.",
              "",
            ],
            [
              "Notifikasi",
              "Judul, isi singkat, tautan, waktu, dan status dibaca.",
              "Dihitung sistem.",
              "",
            ],
            [
              "Persetujuan",
              "Versi kebijakan, butir yang disetujui, asal catatan (daftar, persetujuan ulang, atau penarikan), nomor bukti, dan waktu memberi atau menarik persetujuan.",
              "Anda.",
              "Bukti persetujuan wajib dapat ditunjukkan (Pasal 24). Alamat IP tidak dicatat.",
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
          Data di atas tergolong Data Pribadi yang bersifat umum. ThinkPath tidak meminta data yang
          bersifat spesifik seperti data kesehatan, biometrik, genetika, catatan kejahatan, atau
          keuangan pribadi. <Ref>Pasal 4 ayat (2) dan (3)</Ref> Bila Anda belum berusia 18 tahun,
          data Anda termasuk data anak yang bersifat spesifik; lihat bagian Pengguna di bawah 18
          tahun.
        </p>
        <p>
          Jawaban esai bisa saja memuat cerita atau informasi pribadi yang Anda tulis sendiri.
          Tulislah hanya yang diperlukan tugas, dan hindari menulis data orang lain.
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
            "Rekaman layar, kamera, atau lokasi. Mikrofon hanya aktif selama sesi Cek Paham yang Anda mulai sendiri.",
            "Riwayat penelusuran, daftar kontak, atau data lain dari perangkat Anda.",
            "NIK, NIM, nomor telepon, atau alamat rumah. Bila Anda sendiri menuliskan nama atau NIM di kotak jawaban atau di dokumen, itu menjadi bagian dari jawaban Anda.",
            "Cookie iklan, pelacak, atau analitik pihak ketiga.",
          ]}
        />
      </PolicySection>

      <PolicySection id="tujuan" number={number("tujuan")} title="Tujuan dan dasar pemrosesan">
        <p>
          Setiap pemrosesan wajib memiliki dasar yang sah. <Ref>Pasal 20</Ref> Berikut tujuan
          pemrosesan di ThinkPath beserta dasarnya.
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
              "Menganalisis jawaban dan membaca dokumen scan dengan penyedia di luar negeri",
              "Teks jawaban, jenjang studi, dan gambar halaman dokumen unggahan",
              "Persetujuan (huruf a), sekaligus dasar transfer ke luar negeri (Pasal 56 ayat (4))",
            ],
            [
              "Cek Paham: merekam jawaban lisan, mentranskripsikannya, dan menilainya sebagai bahan tinjau dosen",
              "Audio, transkrip, catatan perilaku sesi, hasil penilaian",
              "Persetujuan (huruf a), sekaligus dasar transfer audio ke luar negeri (Pasal 56 ayat (4))",
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
          Data Anda tidak dipakai untuk iklan, tidak dijual, dan tidak dipakai untuk melatih model
          AI. Kalibrasi model ThinkPath memakai abstrak jurnal ilmiah yang terbuka untuk publik dari
          OpenAlex, bukan jawaban mahasiswa.
        </p>
      </PolicySection>

      <PolicySection
        id="persetujuan"
        number={number("persetujuan")}
        title="Persetujuan dan buktinya"
      >
        <p>
          Anda menyetujui kebijakan ini satu kali, dengan mencentang kotak persetujuan di form
          pendaftaran sebelum akun dibuat. Persetujuan itu adalah syarat memakai ThinkPath: tanpa
          persetujuan, akun tidak dibuat, karena seluruh fitur bergantung pada pemrosesan data yang
          dijelaskan di sini.
        </p>
        <p>
          Satu centang itu mencakup tujuan berikut. Tiap tujuan dijelaskan di bagiannya
          masing-masing dan dicatat sebagai butir tersendiri pada bukti persetujuan, agar tujuan
          yang berbeda tetap dapat dibedakan. <Ref>Pasal 22 ayat (4)</Ref>
        </p>
        <Bullets
          items={[
            <>
              <b>Mahasiswa:</b> data akun dan perkuliahan; perekaman proses menulis dan analisis
              otomatis; analisis oleh penyedia di luar negeri; rekaman suara untuk Cek Paham; dan
              pernyataan usia 18 tahun atau lebih (atau persetujuan orang tua atau wali).
            </>,
            <>
              <b>Dosen:</b> data akun dan kelas; serta tanggung jawab menjaga kerahasiaan data
              mahasiswa dan tidak menjatuhkan sanksi hanya berdasarkan skor.
            </>,
          ]}
        />
        <p>
          <b>Bukti yang kami simpan.</b> Setiap kali Anda menyetujui, menyetujui ulang, atau menarik
          persetujuan, ThinkPath menambahkan satu catatan berisi: versi kebijakan, butir yang
          disetujui, waktu, asal catatan (daftar, persetujuan ulang, atau penarikan), dan nomor
          bukti. Catatan hanya ditambah, tidak pernah diubah atau ditimpa, dan alamat IP tidak
          dicatat. <Ref>Pasal 22 ayat (1) dan Pasal 24</Ref>
        </p>
        <p>
          <b>Melihat bukti.</b> Buka Pengaturan, bagian Kebijakan dan persetujuan: di sana tampil
          bukti yang berlaku, riwayatnya, dan tautan ke halaman ini. Halaman ini juga selalu dapat
          dibuka, tanpa masuk, di alamat yang sama.
        </p>
        <p>
          <b>Menarik dan menyetujui ulang.</b> Anda dapat menarik persetujuan kapan saja di
          Pengaturan; pemrosesan baru berhenti seketika dan Anda tidak dapat memakai ThinkPath
          sampai menyetujui kembali. <Ref>Pasal 9 dan 40</Ref> Bila versi kebijakan berubah, Anda
          diminta membaca dan menyetujui versi baru sebelum melanjutkan.
        </p>
      </PolicySection>

      <PolicySection
        id="analisis-otomatis"
        number={number("analisis-otomatis")}
        title="Analisis otomatis dan pemrofilan"
      >
        <p>Setiap jawaban yang dikumpulkan dianalisis otomatis menjadi tiga hasil yang terpisah:</p>
        <Bullets
          items={[
            <>
              <b>Level Bloom (L1-L6)</b>, yaitu taksiran level penalaran yang ditunjukkan jawaban,
              dibandingkan dengan target yang ditetapkan dosen. Mahasiswa dapat melihat level dan
              perkembangannya sendiri di halaman Gradebook.
            </>,
            <>
              <b>Indikasi penggunaan AI (0-100)</b>, yang dihitung dari teks polos jawaban saja;
              gambar, rumus, dan format tidak ikut dianalisis. Skor ini berasal dari detektor
              Winston AI; bila layanan itu tidak tersedia, dari heuristik di server ThinkPath. Model
              Groq hanya menaksir level Bloom.
            </>,
            <>
              <b>Pola pengerjaan</b>, yang ditampilkan terpisah dari skor dan tidak mengubahnya:
              kapan Anda mulai mengetik, berapa lama, dan bentuk kurva pertumbuhan kata yang dicatat
              server dari draf yang tersimpan otomatis selama Anda menulis. Pencatatan baru dimulai
              saat Anda mengetik, bukan saat halaman dibuka. Jawaban yang diimpor dari dokumen tidak
              punya jejak mengetik, sehingga dosen melihat tandanya.
            </>,
          ]}
        />
        <p>
          Selain itu, dosen pengampu dapat melihat bahan pendukung berikut. Ketiganya tidak mengubah
          skor di atas:
        </p>
        <Bullets
          items={[
            <>
              <b>Penanda gaya teks</b>: sisa salinan dari antarmuka obrolan (simbol poin, sintaks
              markdown, kalimat penutup seperti &ldquo;beri tahu saya&rdquo;, karakter tak terlihat)
              dan kebiasaan gaya yang juga dipakai penulis manusia. Ini dihitung di server ThinkPath
              dari teks jawaban; tidak ada layanan luar yang terlibat.
            </>,
            <>
              <b>Kemiripan antar jawaban</b>: irisan potongan lima kata berurutan antara jawaban
              Anda dan jawaban mahasiswa lain pada tugas yang sama, dihitung di server ThinkPath.
              Dosen dapat membuka dua jawaban berdampingan untuk membandingkannya. Kutipan dari soal
              atau bacaan yang sama ikut mirip, sehingga hasilnya hanya petunjuk untuk bertanya.
            </>,
            <>
              <b>Saran satu klik untuk dosen</b>: ringkasan apakah jawaban sudah baik, perlu Cek
              Paham, atau perlu dibandingkan. Saran dasarnya dibuat dengan aturan di server
              ThinkPath. Uraian naratifnya dibuat Groq hanya bila dosen menekan tombolnya dan Anda
              telah menyetujui analisis oleh penyedia di luar negeri; teks jawaban, judul dan
              instruksi tugas, serta ringkasan hasil analisisnya dikirim tanpa nama atau email.
            </>,
          ]}
        />
        <p>
          Menurut UU PDP, kegiatan ini termasuk pemrofilan dan penskoran yang sistematis.{" "}
          <Ref>Penjelasan Pasal 10 ayat (1); Pasal 34 ayat (2) huruf d</Ref>
        </p>
        <p>
          <b>Bagaimana hasilnya dipakai.</b> Hasil analisis hanya ditampilkan kepada dosen pengampu
          sebagai bahan tinjau. ThinkPath tidak memberi nilai, tidak menjatuhkan sanksi, dan tidak
          menyimpulkan kecurangan; Setiap tindak lanjut adalah keputusan dosen, misalnya mengajak
          Anda berdiskusi atau memberi Cek Paham untuk menjelaskan jawaban Anda sendiri. Jadi tidak
          ada keputusan yang hanya didasarkan pada pemrosesan otomatis. <Ref>Pasal 10 ayat (1)</Ref>
        </p>
        <p>
          Skor indikasi AI tidak ditampilkan di layar mahasiswa. Anda tetap berhak meminta
          salinannya beserta rinciannya. <Ref>Pasal 7</Ref>
        </p>
        <p>
          <b>Keterbatasan yang perlu Anda ketahui.</b> Angka-angka ini belum sempurna, dan kami
          menyebutkannya apa adanya:
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
          <b>Hak Anda atas analisis ini.</b> Anda dapat mengajukan keberatan atas hasil analisis,
          meminta penjelasan, dan meminta dosen meninjau ulang dengan mendengar penjelasan Anda.{" "}
          <Ref>Pasal 10 ayat (1)</Ref>
        </p>
        <p>
          <b>Penilaian dampak.</b> Karena termasuk penskoran yang sistematis, pemrosesan ini
          memerlukan penilaian dampak pelindungan data pribadi. <Ref>Pasal 34</Ref> Penilaian dampak
          awal tim untuk prototipe ini dicatat di dokumentasi proyek. Perguruan tinggi yang memakai
          ThinkPath secara resmi perlu melakukan penilaian dampaknya sendiri sebelum penggunaan.
        </p>
      </PolicySection>

      <PolicySection id="cek-paham" number={number("cek-paham")} title="Cek Paham (tes lisan)">
        <p>
          Cek Paham adalah satu pertanyaan konfirmasi tentang jawaban tertulis Anda. Dosen
          membuatnya, dan mahasiswa menjawab dengan suara dalam batas waktu yang ditetapkan dosen.
          Tujuannya membantu dosen memastikan mahasiswa memahami jawabannya sendiri, tanpa sesi
          tatap muka yang harus dijadwalkan.
        </p>
        <p>Yang terjadi pada data Anda:</p>
        <Bullets
          items={[
            "Mikrofon aktif hanya setelah Anda menekan mulai, pada uji mikrofon dan saat menjawab. Peramban juga meminta izin mikrofon sendiri, terpisah dari persetujuan di sini.",
            "Selama merekam, potongan audio pendek (sekitar 4 detik) dikirim ke Groq untuk menampilkan teks sementara di layar. Potongan itu dan audio uji mikrofon tidak disimpan di server ThinkPath.",
            "Setelah Anda selesai, rekaman penuh dikirim ke server ThinkPath dan ke Groq untuk diubah menjadi transkrip resmi. Audio disimpan di server Jakarta, hanya dapat diputar oleh dosen pemilik kelas lewat tautan yang mewajibkan login, dan dihapus otomatis setelah 30 hari.",
            "Transkrip dan jawaban tertulis Anda dikirim ke model bahasa Groq untuk dinilai pada empat dimensi: ketepatan konsep, konsistensi dengan jawaban tertulis, kedalaman penjelasan, dan keakraban dengan isi jawaban. ThinkPath menghitung skor 0-100 dari level tiap dimensi.",
            "ThinkPath mencatat jumlah pindah tab atau jendela, kesalahan mikrofon, dan lama hening selama sesi sebagai konteks bagi dosen. Angka itu tidak ikut menentukan skor.",
          ]}
        />
        <p>
          <b>Bagaimana hasilnya dipakai.</b> Skor Cek Paham hanyalah saran bagi dosen. Skor itu
          belum dikalibrasi terhadap penilai manusia, tidak mengubah nilai maupun skor indikasi AI,
          dan tidak ditampilkan kepada mahasiswa. Setiap tindak lanjut adalah keputusan dosen, yang
          tetap memberi Anda kesempatan menjelaskan. <Ref>Pasal 10 ayat (1)</Ref>
        </p>
        <p>
          <b>Keterbatasan.</b> Pengenalan suara dapat keliru pada aksen, derau, atau istilah teknis,
          dan penilai bahasa dapat salah menafsirkan jawaban singkat. Bila transkrip tidak sesuai
          ucapan Anda atau ada kendala lain, laporkan setelah sesi selesai (kategori dan keterangan
          boleh dikosongkan). Dosen dapat memeriksa rekaman dan mengizinkan Anda mengulang.
        </p>
      </PolicySection>

      <PolicySection id="akses" number={number("akses")} title="Siapa yang dapat melihat data">
        <PolicyTable
          columns={["Pihak", "Dapat melihat", "Tidak dapat melihat"]}
          rows={[
            [
              "Anda sendiri (mahasiswa)",
              "Akun, jawaban, status, nilai, umpan balik, level Bloom dan perkembangannya, jadwal, materi, notifikasi, to-do pribadi, tulisan forum Anda, dan riwayat persetujuan Anda.",
              "Skor indikasi AI, serta skor dan penilaian Cek Paham.",
            ],
            [
              "Dosen pengampu kelas",
              "Nama tampilan (atau email bila nama tampilan dikosongkan), jawaban dan dokumen aslinya, jejak proses, hasil analisis lengkap, penanda gaya teks, kemiripan dengan jawaban mahasiswa lain pada tugas yang sama, profil kognitif, tulisan forum, daftar anggota, serta audio, transkrip, dan hasil Cek Paham dari kelasnya sendiri.",
              "Data Anda di kelas dosen lain.",
            ],
            [
              "Mahasiswa lain di kelas yang sama",
              "Nama tampilan Anda di daftar anggota, serta tulisan Anda di forum kelas (judul, isi, balasan, dan nama).",
              "Jawaban, nilai, hasil analisis, to-do, dan email Anda.",
            ],
            [
              "Mahasiswa di kelas lain",
              "Tidak ada.",
              "Jawaban, nilai, hasil analisis, dan tulisan forum Anda.",
            ],
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
          ThinkPath memakai penyedia berikut untuk memproses data. Data disimpan di Indonesia;
          Vercel, Groq, dan Winston AI berkedudukan di luar Indonesia.
        </p>
        <PolicyTable
          columns={["Penyedia", "Peran", "Data yang diterima", "Lokasi dan catatan"]}
          rows={[
            [
              "Vercel Inc.",
              "Menyajikan antarmuka web dan merender halaman di server.",
              "Halaman yang Anda buka, cookie token login, dan data yang ditampilkan atau dikirim lewat halaman, saat diteruskan ke dan dari server API.",
              <>
                Perusahaan Amerika Serikat. Server tampilan berjalan di Washington, D.C., Amerika
                Serikat. Basis data tidak berada di Vercel.{" "}
                <ExternalLink href="https://vercel.com/legal/privacy-policy">
                  Kebijakan privasi Vercel
                </ExternalLink>
              </>,
            ],
            [
              "PT Cloud Hosting Indonesia (IDCloudHost)",
              "Server virtual (VPS) yang menjalankan server API dan basis data PostgreSQL.",
              "Seluruh data yang disimpan ThinkPath.",
              "Jakarta, Indonesia. Basis data tidak dapat diakses langsung dari internet; hanya server API di mesin yang sama yang terhubung ke sana.",
            ],
            [
              "Penyedia email (SMTP)",
              "Mengirim email tautan atur ulang kata sandi atas permintaan Anda.",
              "Alamat email Anda dan tautan sekali pakai yang berlaku 30 menit. Tidak berisi data akademik.",
              "Penyedia dan lokasinya ditetapkan pengelola saat layanan email diaktifkan, dan dicantumkan di baris ini pada versi kebijakan berikutnya bila berubah.",
            ],
            [
              "Groq, Inc.",
              "Analisis teks (taksiran level Bloom), pembacaan teks dari gambar halaman dokumen, serta pengenalan suara dan penilaian jawaban Cek Paham.",
              "Teks jawaban dan jenjang studi, gambar halaman dokumen scan atau foto yang Anda unggah, audio jawaban Cek Paham beserta transkripnya, dan, bila dosen meminta saran, judul dan instruksi tugas serta ringkasan hasil analisis jawaban Anda, tanpa nama atau email.",
              <>
                Amerika Serikat. Menurut dokumentasinya, Groq secara bawaan tidak menyimpan data
                permintaan; log untuk menangani galat atau penyalahgunaan disimpan paling lama 30
                hari. Perjanjian layanannya melarang pemakaian input dan output untuk melatih model.{" "}
                <ExternalLink href="https://console.groq.com/docs/your-data">
                  Data di GroqCloud
                </ExternalLink>
              </>,
            ],
            [
              "Winston AI Inc.",
              "Deteksi teks buatan AI.",
              "Teks jawaban sepanjang 300 sampai 150.000 karakter, tanpa nama atau email.",
              <>
                Kanada. Menurut kebijakan privasinya, teks yang dinilai disimpan sebagai laporan di
                dasbor akun ThinkPath sampai laporan itu dihapus, cadangan terenkripsi disimpan
                hingga 90 hari setelahnya, dan konten yang dapat diidentifikasi secara individual
                tidak dipakai melatih model tanpa persetujuan eksplisit.{" "}
                <ExternalLink href="https://gowinston.ai/privacy-policy/">
                  Kebijakan privasi Winston AI
                </ExternalLink>
              </>,
            ],
          ]}
        />
        <p>
          UU PDP membolehkan transfer ke luar negeri bila negara penerima memiliki pelindungan yang
          setara atau lebih tinggi, atau bila ada pelindungan yang memadai dan mengikat. Bila
          keduanya tidak terpenuhi, transfer wajib atas persetujuan Subjek Data Pribadi.{" "}
          <Ref>Pasal 56 ayat (2) sampai (4)</Ref> Kami belum menilai kesetaraan itu secara formal,
          sehingga seluruh transfer di atas kami dasarkan pada persetujuan yang Anda berikan saat
          mendaftar. Tujuan transfer ke Groq dan Winston AI dicatat sebagai butir tersendiri pada
          bukti persetujuan. Bila Anda tidak menyetujuinya, akun tidak dapat dibuat; bila Anda
          menarik persetujuan, pengiriman data baru ke penyedia berhenti.
        </p>
      </PolicySection>

      <PolicySection id="retensi" number={number("retensi")} title="Penyimpanan dan penghapusan">
        <Bullets
          items={[
            "Data disimpan selama akun Anda masih ada, termasuk jawaban dan dokumen yang sudah dikumpulkan; keduanya tidak dibuang otomatis. Yang dibuang otomatis hanya berkas unggahan yang tidak pernah dikumpulkan (setelah 24 jam), rekaman suara Cek Paham (setelah 30 hari), notifikasi (setelah 90 hari), dan riwayat tugas analisis (setelah 30 hari).",
            "Anda dapat menghapus akun sendiri di Pengaturan (kata sandi dan ketikan HAPUS diperlukan). Akun beserta jawaban, dokumen unggahan, rekaman suara, hasil analisis, tulisan forum, to-do, notifikasi, sesi, dan catatan persetujuan Anda langsung dihapus dari basis data dan dari disk. Yang tersisa hanya catatan anonim bahwa sebuah akun dihapus (peran, versi kebijakan, jumlah data), tanpa identitas (Pasal 43 dan 45). Salinan cadangan memuat data sampai berkas cadangan kedaluwarsa (7 hari). Jawaban dan nilai Anda tidak lagi tersedia bagi dosen setelah akun dihapus.",
            'Bila akun dosen dihapus, kelasnya tidak ikut dihapus. Kelas, tugas, materi, pengumuman, forum, dan jawaban mahasiswa tetap tersimpan sebagai arsip yang hanya bisa dibaca, dengan keterangan bahwa dosennya telah menghapus akun, karena data itu juga milik mahasiswa. Tulisan dosen di forum tampil sebagai "Dosen (akun telah dihapus)". Mahasiswa dapat menghapus jawabannya dengan menghapus akunnya sendiri.',
            "Audio jawaban Cek Paham dihapus otomatis setelah 30 hari oleh tugas terjadwal di server. Transkrip dan hasil penilaiannya tetap tersimpan selama akun dan kelas terkait ada, atau sampai Anda meminta penghapusan.",
            "Menarik persetujuan tidak otomatis menghapus data yang sudah ada. Pemrosesan baru berhenti seketika, sedangkan data lama tetap tersimpan sampai Anda menghapus akun.",
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
          <b>Keterbatasan yang kami ketahui.</b> Cookie token login belum berstatus HttpOnly,
          sehingga dapat dibaca skrip di halaman; bila suatu saat ada celah XSS, token bisa dicuri.
          Perbaikannya, yaitu memindahkan sesi ke sisi server, sudah direncanakan. Batas percobaan
          masuk disimpan di memori server API dan mulai menghitung dari nol setiap kali server
          dimulai ulang, sehingga batas itu meredam percobaan otomatis tetapi bukan penjaga yang
          ketat.
        </p>
        <p>
          Bila terjadi kegagalan pelindungan data, kami memberitahu Anda dan lembaga secara tertulis
          paling lambat 3 × 24 jam. Pemberitahuan itu memuat data yang terungkap, kapan dan
          bagaimana data terungkap, serta upaya penanganan dan pemulihannya. <Ref>Pasal 46</Ref>
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
              "Pengaturan, bagian Kebijakan dan persetujuan, tombol Tarik persetujuan. Setelah ditarik, Anda tidak dapat memakai ThinkPath sampai menyetujui kembali.",
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
              "Lewat permohonan. Menarik persetujuan menghentikan seluruh pemrosesan baru.",
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
          Beberapa hak dapat dikecualikan untuk kepentingan tertentu yang diatur undang-undang,
          misalnya penegakan hukum. <Ref>Pasal 15</Ref> Kami juga wajib menolak akses yang akan
          mengungkap data pribadi orang lain, sehingga salinan data Anda tidak memuat data mahasiswa
          lain. <Ref>Pasal 33</Ref>
        </p>
      </PolicySection>

      <PolicySection id="anak" number={number("anak")} title="Pengguna di bawah 18 tahun">
        <p>
          Pemrosesan data anak wajib mendapat persetujuan orang tua dan/atau wali.{" "}
          <Ref>Pasal 25</Ref> Anak adalah seseorang yang belum berusia 18 tahun.{" "}
          <Ref>
            UU No. 35 Tahun 2014 tentang Perubahan atas UU No. 23 Tahun 2002 tentang Perlindungan
            Anak, Pasal 1 angka 1
          </Ref>
        </p>
        <p>
          Saat menyetujui kebijakan ini, mahasiswa menyatakan berusia 18 tahun atau lebih, atau
          telah mendapat persetujuan orang tua atau wali. Bila kami mengetahui data anak diproses
          tanpa persetujuan tersebut, kami menghentikan pemrosesannya dan menghapus datanya.
        </p>
      </PolicySection>

      <PolicySection
        id="cookie"
        number={number("cookie")}
        title="Cookie dan penyimpanan di perangkat"
      >
        <p>
          ThinkPath hanya memakai satu cookie,{" "}
          <span className="rounded bg-muted px-1.5 py-0.5 text-body-sm font-semibold">
            thinkpath_token
          </span>
          , yang berisi token login: id akun, email, peran, versi kebijakan yang Anda setujui, id
          sesi, serta waktu terbit dan kedaluwarsanya. Cookie ini HttpOnly (tidak dapat dibaca skrip
          di halaman), berlaku 7 hari, dan saat Anda keluar sesinya dicabut di server sehingga token
          itu tidak berlaku lagi.
        </p>
        <p>
          Tidak ada cookie iklan, pelacak, atau analitik, dan ThinkPath tidak menyimpan apa pun di
          localStorage atau sessionStorage peramban. Huruf pada halaman disajikan dari server
          ThinkPath sendiri, bukan diunduh dari Google saat halaman dibuka.
        </p>
      </PolicySection>

      <PolicySection id="demo" number={number("demo")} title="Akun demo">
        <p>
          Akun demo (dosen@thinkpath.local, dosen2@thinkpath.local, serta mhs01@thinkpath.local
          sampai mhs20@thinkpath.local) berisi data fiktif, dan kata sandinya diumumkan di README
          proyek. Siapa pun dapat masuk ke akun tersebut, jadi jangan menulis data pribadi sungguhan
          saat memakainya. Persetujuan akun demo dicatat oleh pengelola saat data demo dibuat,
          sehingga akun itu langsung bisa dipakai. Data demo dapat diatur ulang kapan saja.
        </p>
      </PolicySection>

      <PolicySection id="perubahan" number={number("perubahan")} title="Perubahan kebijakan">
        <p>
          Setiap versi kebijakan diberi tanggal. Bila isinya berubah, Anda akan diminta membaca dan
          menyetujui versi baru sebelum dapat melanjutkan memakai ThinkPath.{" "}
          <Ref>Pasal 21 ayat (2)</Ref>
        </p>
        <PolicyTable
          columns={["Versi", "Perubahan"]}
          rows={[
            [
              PRIVACY_POLICY_VERSION,
              "Dosen kini dapat menulis instruksi tugas berformat (gambar kecil dan tautan). Dosen melihat penanda gaya teks dan kemiripan jawaban Anda dengan mahasiswa lain pada tugas yang sama, serta dapat meminta saran satu klik; narasi sarannya dibuat Groq hanya dengan persetujuan analisis luar negeri. Mahasiswa yang mengunggah dokumen tetap dapat menulis nama atau NIM di kotak jawaban, dan teks keduanya dianalisis bersama. Dokumen yang dikumpulkan disimpan selama akun ada; hanya rekaman suara Cek Paham yang dihapus otomatis (30 hari).",
            ],
            [
              "2026-10-25",
              "Forum kelas menggantikan pengumuman: dosen dan mahasiswa menulis dan membalas topik, dan nama penulis terlihat oleh anggota kelas. Daftar anggota kelas menampilkan nama tampilan dosen dan teman sekelas (tanpa email). To-do pribadi mahasiswa disimpan di server dan hanya terlihat oleh pemiliknya. Jawaban kini berformat kaya (tabel, rumus, tautan, gambar kecil yang disimpan di dalam jawaban); yang dianalisis tetap teks polos, dan waktu mulai dicatat server dari draf. Penghapusan akun kini juga menghapus tulisan forum dan to-do mahasiswa.",
            ],
            [
              "2026-10-23",
              "Penghapusan akun mandiri di Pengaturan (baris basis data dan berkas di disk); kelas dosen yang menghapus akun menjadi arsip, bukan ikut terhapus. Atur ulang kata sandi lewat email, sehingga penyedia email ditambahkan ke daftar penyedia. Skor indikasi AI kini dihitung dari teks saja, dan pola pengerjaan (waktu mulai, durasi, kurva kata) ditampilkan terpisah serta dicatat server dari draf yang tersimpan otomatis. Keterangan cookie disesuaikan: HttpOnly dan sesi yang bisa dicabut.",
            ],
            [
              "2026-10-22",
              "Satu persetujuan saat mendaftar. Mahasiswa dan dosen menyetujui seluruh kebijakan dengan satu centang di form pendaftaran; tiap tujuan tetap dicatat sebagai butir tersendiri, dan buktinya (versi, waktu, tujuan, nomor bukti) dapat dilihat di Pengaturan. Rekaman suara untuk Cek Paham dan analisis oleh penyedia di luar negeri menjadi bagian dari persetujuan itu, bukan lagi pilihan terpisah. Ditambahkan penjelasan Cek Paham (tes lisan). Sesi diskusi jawaban (verifikasi verbal) dihapus dari aplikasi.",
            ],
            [
              "2026-10-17",
              "Unggah dokumen jawaban. Mahasiswa dapat mengunggah PDF, DOCX, atau gambar untuk mengisi jawaban. Berkas dan teks hasil pembacaannya disimpan di server Jakarta; halaman gambar dikirim ke Groq (Amerika Serikat) hanya bila mahasiswa mengizinkan analisis di luar negeri. Jawaban yang diimpor dari dokumen dilewati sinyal prosesnya dan ditandai bagi dosen.",
            ],
            [
              "2026-10-12",
              "Perpindahan server. Server API dan basis data dipindahkan dari Vercel (Washington, D.C., Amerika Serikat) dan Supabase (Sydney, Australia) ke VPS IDCloudHost di Jakarta, Indonesia, sehingga Supabase dihapus dari daftar penyedia. Vercel tetap menyajikan halaman web. Keterangan batas percobaan masuk disesuaikan dengan server baru.",
            ],
            [
              "2026-09-28",
              "Koreksi lokasi dan penyedia. Basis data berada di Sydney, Australia, bukan di Singapura seperti tertulis pada versi sebelumnya. Server API dijalankan Vercel di Washington, D.C., Amerika Serikat, bukan Hugging Face, sehingga Hugging Face dihapus dari daftar penyedia. Keterangan batas percobaan masuk disesuaikan dengan cara server berjalan di Vercel.",
            ],
            ["2026-09-25", "Versi pertama."],
          ]}
        />
      </PolicySection>

      <PolicySection id="kontak" number={number("kontak")} title="Kontak dan pengaduan">
        <p>
          <ContactLine />
        </p>
        <p>
          Bila tanggapan kami tidak memuaskan, Anda dapat mengadu kepada lembaga penyelenggara
          pelindungan data pribadi yang ditetapkan Presiden. Lembaga ini antara lain bertugas
          mengawasi penyelenggaraan pelindungan data pribadi dan memfasilitasi penyelesaian sengketa
          di luar pengadilan. <Ref>Pasal 58 dan 59</Ref>
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
            <ExternalLink key="vercel" href="https://vercel.com/legal/privacy-policy">
              Vercel: Privacy Policy
            </ExternalLink>,
          ]}
        />
      </PolicySection>
    </article>
  );
}
