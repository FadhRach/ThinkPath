import type { Copy } from "./types";

export const idCopy: Copy = {
  meta: {
    title: "ThinkPath: lihat bagaimana tugas dikerjakan",
    description:
      "Sistem verifikasi pemahaman berbasis proses untuk integritas akademik. Jejak penulisan, level Bloom, dan Cek Paham dalam satu ringkasan bukti untuk dosen.",
  },
  nav: {
    links: [
      { href: "#masalah", label: "Masalah" },
      { href: "#fitur", label: "Fitur" },
      { href: "#cara-kerja", label: "Cara kerja" },
      { href: "#teknologi", label: "Teknologi" },
      { href: "#paket", label: "Paket" },
    ],
    login: "Masuk",
    register: "Daftar",
    toLight: "Ganti ke mode terang",
    toDark: "Ganti ke mode gelap",
    languageLabel: "Bahasa",
  },
  hero: {
    title: "Nilainya bisa sama. Cara mengerjakannya belum tentu sama.",
    lead: "ThinkPath merekam proses menulis mahasiswa, memetakan level berpikirnya, lalu menyajikan semuanya sebagai bukti yang bisa ditinjau dosen. Keputusan tetap di tangan dosen.",
    primary: "Coba sekarang",
    secondary: "Lihat cara kerja",
    tagline:
      "ThinkPath: Sistem Verifikasi Pemahaman Berbasis Proses untuk Integritas Akademik Mahasiswa",
  },
  sheet: {
    document: "Esai Lingkungan Alam, draf 3",
    excerpt:
      "Pusat data AI menyedot jutaan liter air bersih untuk pendinginan dan menambah emisi karbon, sehingga laju pembangunannya perlu dibatasi izin air dan target energi terbarukan.",
    chartLabel: "Jumlah kata dari waktu ke waktu",
    started: "Mulai 19:42",
    duration: "47 menit",
    revisions: "6 revisi",
    level: "L4 Menganalisis",
    note: "Tanya: apa dasarmu menyebut dampaknya sampai ke iklim global?",
  },
  problem: {
    title: "Detektor AI saja tidak cukup",
    lead: "Model bahasa terus berubah, sedangkan detektor hanya melihat teks akhir. Dosen akhirnya memegang angka yang sulit dipertanggungjawabkan.",
    beforeHeading: "Hanya detektor AI",
    afterHeading: "Dengan ThinkPath",
    rows: [
      {
        aspect: "Yang diperiksa",
        before: "Hanya teks akhir, tanpa tahu bagaimana teks itu dibuat",
        after:
          "Jejak proses: kapan mulai, berapa lama, berapa kali direvisi, ditambah level Bloom L1 sampai L6",
      },
      {
        aspect: "Menghadapi AI baru",
        before: "Harus terus mengejar model AI yang makin pintar",
        after:
          "Tidak bertumpu pada satu tebakan: proses, level berpikir, dan Cek Paham saling melengkapi",
      },
      {
        aspect: "Mahasiswa yang jujur",
        before: "Bisa ikut ditandai tanpa penjelasan",
        after: "Indikasi AI hanya satu petunjuk dan tampil terpisah dari pola pengerjaan",
      },
      {
        aspect: "Hasil untuk dosen",
        before: "Satu angka yang terasa seperti vonis",
        after: "Ringkasan Bukti dan Cek Paham lisan, keputusan tetap di tangan dosen",
      },
    ],
    punchline: "Detektor memberi tebakan. ThinkPath memberi bukti yang bisa ditinjau.",
  },
  features: {
    title: "Satu tugas, bukti dari banyak sisi",
    lead: "Setiap fitur menjawab satu pertanyaan dosen: apakah mahasiswa ini benar-benar memahami yang ia tulis?",
    items: [
      {
        key: "process",
        title: "Jejak proses",
        body: "Draf tersimpan otomatis di server. Dosen melihat kapan penulisan dimulai, berapa lama, dan bagaimana jumlah kata tumbuh.",
      },
      {
        key: "bloom",
        title: "Level berpikir Bloom",
        body: "Jawaban dipetakan ke L1 sampai L6, dari mengingat sampai mencipta, lalu dibandingkan dengan target tugas.",
      },
      {
        key: "cekpaham",
        title: "Cek Paham",
        body: "Tes lisan singkat: mahasiswa menjelaskan jawabannya dengan suara. Skornya hanya saran dan belum dikalibrasi.",
      },
      {
        key: "ai",
        title: "Indikasi AI, terpisah",
        body: "Dihitung dari teks saja dan tidak digabung dengan pola pengerjaan. Mahasiswa tidak melihat skor ini.",
      },
      {
        key: "summary",
        title: "Ringkasan Bukti",
        body: "Satu halaman per jawaban yang menunjukkan apa yang perlu diperhatikan lebih dulu, bukan vonis lulus atau gagal.",
      },
      {
        key: "import",
        title: "Impor dokumen",
        body: "Mahasiswa bisa mengunggah PDF, DOCX, atau foto. Teks dibaca otomatis dan jawabannya ditandai sebagai impor.",
      },
    ],
  },
  how: {
    title: "Cara kerja",
    lead: "Empat langkah dari kelas sampai bukti, tanpa pengaturan rumit.",
    steps: [
      {
        role: "Dosen",
        title: "Buat kelas dan tugas",
        body: "Tentukan tenggat dan target level Bloom, lalu bagikan kode kelas.",
      },
      {
        role: "Mahasiswa",
        title: "Tulis jawaban",
        body: "Draf tersimpan otomatis. Tidak ada langkah tambahan.",
      },
      {
        role: "ThinkPath",
        title: "Analisis berjalan",
        body: "Proses, level Bloom, dan indikasi AI dihitung di latar belakang.",
      },
      {
        role: "Dosen",
        title: "Tinjau bukti",
        body: "Baca Ringkasan Bukti, lalu ajak bicara atau jalankan Cek Paham bila perlu.",
      },
    ],
  },
  proof: {
    title: "Teknologi di balik ThinkPath",
    lead: "Dibangun dari komponen yang bisa diperiksa. Analisis memakai Winston AI dan Groq, data disimpan di server Jakarta.",
    stackNote:
      "Daftar teknologi yang dipakai ThinkPath, bukan klaim kemitraan atau dukungan resmi.",
    stack: [
      { name: "Next.js", role: "Antarmuka" },
      { name: "Django", role: "API" },
      { name: "PostgreSQL", role: "Basis data" },
      { name: "Groq", role: "Bloom dan Cek Paham" },
      { name: "Winston AI", role: "Detektor AI" },
      { name: "IDCloudHost", role: "Server Jakarta" },
      { name: "Vercel", role: "Hosting web" },
      { name: "Docker", role: "Kontainer" },
    ],
    principles: [
      {
        title: "Data di Jakarta",
        body: "Basis data dan berkas jawaban disimpan di server IDCloudHost, Jakarta.",
      },
      { title: "Skor tidak dilihat mahasiswa", body: "Skor indikasi AI hanya tampil untuk dosen." },
      {
        title: "Bisa dihapus kapan saja",
        body: "Pengguna dapat menghapus akun dan datanya sendiri dari Pengaturan.",
      },
    ],
  },
  pricing: {
    title: "Paket",
    lead: "ThinkPath gratis dipakai sekarang, termasuk membuat beberapa kelas. Paket berbayar menambah detektor AI yang lebih kuat dan fitur untuk lembaga.",
    note: "Isi paket berbayar masih rencana dan dapat berubah.",
    unavailable: "Segera hadir",
    waitlistSubject: "Daftar tunggu ThinkPath",
    plans: [
      {
        state: "now",
        name: "Perorangan",
        audience: "Dosen dan mahasiswa",
        badge: "Tersedia sekarang",
        price: "Gratis",
        blurb: "Semua fitur inti untuk dosen dan kelasnya.",
        detector: "Detektor standar",
        features: [
          "Beberapa kelas dan tugas",
          "Jejak proses dan level Bloom",
          "Cek Paham",
          "Ringkasan Bukti",
        ],
        cta: "Coba sekarang",
      },
      {
        state: "soon",
        name: "Kelas Plus",
        audience: "Dosen yang butuh detektor lebih kuat",
        badge: "Segera hadir",
        price: "Segera hadir",
        blurb: "Pilihan detektor premium untuk kelas tertentu.",
        detector: "Detektor premium (rencana)",
        features: [
          "Integrasi detektor premium seperti Turnitin atau Copyleaks (rencana)",
          "Dipilih per kelas",
          "Semua fitur Perorangan",
        ],
        cta: "Masuk daftar tunggu",
      },
      {
        state: "contact",
        name: "Institusi dan Bimbel",
        audience: "Perguruan tinggi dan tempat les",
        badge: "Untuk lembaga",
        price: "Hubungi kami",
        blurb: "Untuk banyak kelas dan banyak pengajar.",
        detector: "Sesuai kebutuhan lembaga",
        features: [
          "Satu akun lembaga untuk banyak pengajar",
          "Login terpusat (SSO)",
          "Laporan lintas kelas",
          "Data tetap di server Indonesia",
        ],
        cta: "Hubungi tim",
      },
    ],
  },
  footer: {
    tagline: "Sistem verifikasi pemahaman berbasis proses untuk integritas akademik.",
    productHeading: "Produk",
    infoHeading: "Informasi",
    contactHeading: "Kontak",
    privacy: "Kebijakan Privasi",
    login: "Masuk",
    register: "Daftar",
    contact: "Hubungi tim",
    rights: "© 2026 Tim DataDigger",
  },
};
