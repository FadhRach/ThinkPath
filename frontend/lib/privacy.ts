import type { Role } from "@/lib/types";

/**
 * Versi Kebijakan Privasi yang sedang berlaku.
 *
 * Wajib sama dengan PRIVACY_POLICY_VERSION di backend/apps/accounts/privacy.py; tes
 * backend membaca berkas ini dan gagal bila keduanya berbeda. Mengubah versi
 * membuat setiap pengguna diminta menyetujui ulang sebelum melanjutkan, sesuai
 * Pasal 21 ayat (2) UU No. 27 Tahun 2022: perubahan informasi diberitahukan
 * sebelum terjadi.
 */
export const PRIVACY_POLICY_VERSION = "2026-10-23";
export const PRIVACY_POLICY_EFFECTIVE_LABEL = "22 Oktober 2026";

/**
 * Surel untuk permohonan hak subjek data (Pasal 14: permohonan tercatat).
 * Diisi lewat lingkungan deploy, bukan ditanam di kode, supaya alamat pribadi
 * anggota tim tidak ikut terpublikasi tanpa keputusan tim.
 */
export const PRIVACY_CONTACT_EMAIL = process.env.NEXT_PUBLIC_PRIVACY_CONTACT_EMAIL?.trim() || null;

export type ConsentItemKey =
  | "data_perkuliahan"
  | "analisis_proses"
  | "usia_atau_izin_wali"
  | "analisis_luar_negeri"
  | "rekaman_suara_cekpaham"
  | "tanggung_jawab_dosen";

export interface ConsentItem {
  key: ConsentItemKey;
  title: string;
  body: string;
  /** Bagian Kebijakan Privasi yang menjelaskan butir ini lebih rinci. */
  anchor: string;
}

/**
 * Tujuan yang disetujui lewat satu centang, per peran. Setiap tujuan tetap
 * ditulis terpisah (dan dicatat sebagai butir sendiri di server) karena
 * Pasal 22 ayat (4) UU No. 27 Tahun 2022 mewajibkan tujuan yang berbeda dapat
 * dibedakan secara jelas. Kuncinya sama dengan REQUIRED_ITEMS di backend; tes
 * backend memeriksanya.
 */
export const CONSENT_ITEMS: Record<Role, ConsentItem[]> = {
  student: [
    {
      key: "data_perkuliahan",
      title: "Data akun dan perkuliahan",
      body: "ThinkPath menyimpan akunmu, kelas yang kamu ikuti, jawaban tugas (termasuk dokumen yang kamu unggah), nilai, dan umpan balik dosen untuk menjalankan perkuliahan. Datanya disimpan di server ThinkPath milik IDCloudHost di Jakarta, Indonesia. Halaman web disajikan oleh Vercel (Washington, D.C., Amerika Serikat), sehingga data yang kamu buka atau kirim lewat halaman ikut melewati server Vercel.",
      anchor: "data-yang-dikumpulkan",
    },
    {
      key: "analisis_proses",
      title: "Perekaman proses menulis dan analisis otomatis",
      body: "Selama form jawaban terbuka, ThinkPath mencatat jumlah kata setiap 30 detik, waktu mulai dan kumpul, serta berapa kali kamu merevisi, bukan isi ketikanmu. Jawabanmu lalu dianalisis otomatis untuk level Bloom dan indikasi penggunaan AI. Hasilnya bahan tinjau dosen pengampu kelasmu, bukan keputusan, dan tidak pernah memicu sanksi otomatis.",
      anchor: "analisis-otomatis",
    },
    {
      key: "analisis_luar_negeri",
      title: "Analisis oleh penyedia di luar negeri",
      body: "Teks jawabanmu dikirim ke Groq (Amerika Serikat) dan Winston AI (Kanada) untuk analisis, ditambah jenjang studi untuk Groq, tanpa nama atau email. Bila kamu mengunggah dokumen scan atau foto, gambar halamannya juga dikirim ke Groq agar bisa dibaca. Winston menyimpan teks yang dinilai sebagai laporan sampai laporan itu dihapus.",
      anchor: "penyedia-layanan",
    },
    {
      key: "rekaman_suara_cekpaham",
      title: "Rekaman suara untuk Cek Paham",
      body: "Saat kamu mengerjakan Cek Paham, mikrofon merekam suaramu hanya selama sesi yang kamu mulai sendiri. Audio disimpan di server Jakarta selama 30 hari lalu dihapus, dan dikirim ke Groq (Amerika Serikat) untuk diubah menjadi teks. Transkrip dan hasil penilaiannya disimpan dan dibaca dosen pengampu sebagai bahan tinjau, bukan nilai dan bukan sanksi.",
      anchor: "cek-paham",
    },
    {
      key: "usia_atau_izin_wali",
      title: "Usia",
      body: "Saya berusia 18 tahun atau lebih. Kalau belum, orang tua atau wali saya sudah menyetujui pemrosesan ini.",
      anchor: "anak",
    },
  ],
  teacher: [
    {
      key: "data_perkuliahan",
      title: "Data akun dan kelas",
      body: "ThinkPath menyimpan akun Anda, kelas, tugas, materi, dan penilaian yang Anda berikan. Datanya disimpan di server ThinkPath milik IDCloudHost di Jakarta, Indonesia. Halaman web disajikan oleh Vercel (Washington, D.C., Amerika Serikat), sehingga data yang Anda buka atau kirim lewat halaman ikut melewati server Vercel.",
      anchor: "data-yang-dikumpulkan",
    },
    {
      key: "tanggung_jawab_dosen",
      title: "Tanggung jawab atas data mahasiswa",
      body: "Saya memakai data mahasiswa hanya untuk perkuliahan di kelas saya dan menjaga kerahasiaannya. Skor indikasi AI, level Bloom, dan hasil Cek Paham adalah bahan tinjau dengan keterbatasan yang dijelaskan di Kebijakan Privasi. Saya tidak menjatuhkan sanksi akademik hanya berdasarkan skor, dan memberi mahasiswa kesempatan menjelaskan jawabannya.",
      anchor: "analisis-otomatis",
    },
  ],
};
