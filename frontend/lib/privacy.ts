import type { Role } from "@/lib/types";

/**
 * Versi Kebijakan Privasi yang sedang berlaku.
 *
 * Wajib sama dengan PRIVACY_POLICY_VERSION di backend/core/privacy.py; tes
 * backend membaca berkas ini dan gagal bila keduanya berbeda. Mengubah versi
 * membuat setiap pengguna diminta menyetujui ulang sebelum melanjutkan, sesuai
 * Pasal 21 ayat (2) UU No. 27 Tahun 2022: perubahan informasi diberitahukan
 * sebelum terjadi.
 */
export const PRIVACY_POLICY_VERSION = "2026-09-25";
export const PRIVACY_POLICY_EFFECTIVE_LABEL = "25 September 2026";

/**
 * Surel untuk permohonan hak subjek data (Pasal 14: permohonan tercatat).
 * Diisi lewat lingkungan deploy, bukan ditanam di kode, supaya alamat pribadi
 * anggota tim tidak ikut terpublikasi tanpa keputusan tim.
 */
export const PRIVACY_CONTACT_EMAIL =
  process.env.NEXT_PUBLIC_PRIVACY_CONTACT_EMAIL?.trim() || null;

export type ConsentItemKey =
  | "data_perkuliahan"
  | "analisis_proses"
  | "usia_atau_izin_wali"
  | "tanggung_jawab_dosen"
  | "analisis_luar_negeri";

export interface ConsentItem {
  key: ConsentItemKey;
  title: string;
  body: string;
  required: boolean;
  /** Bagian Kebijakan Privasi yang menjelaskan butir ini lebih rinci. */
  anchor: string;
}

/**
 * Butir persetujuan per peran. Dipisah per tujuan karena Pasal 22 ayat (4)
 * mewajibkan tujuan yang berbeda dapat dibedakan secara jelas, dalam format
 * yang mudah dipahami dan bahasa yang sederhana. Kuncinya sama dengan
 * REQUIRED_ITEMS dan OPTIONAL_ITEMS di backend.
 */
export const CONSENT_ITEMS: Record<Role, ConsentItem[]> = {
  student: [
    {
      key: "data_perkuliahan",
      title: "Data akun dan perkuliahan",
      body: "ThinkPath menyimpan akunmu, kelas yang kamu ikuti, jawaban tugas, nilai, dan umpan balik dosen untuk menjalankan perkuliahan. Datanya disimpan dan diproses oleh penyedia cloud di luar Indonesia: Supabase untuk basis data (Singapura), serta Hugging Face dan Vercel untuk server aplikasi (perusahaan Amerika Serikat).",
      required: true,
      anchor: "data-yang-dikumpulkan",
    },
    {
      key: "analisis_proses",
      title: "Perekaman proses menulis dan analisis otomatis",
      body: "Selama form jawaban terbuka, ThinkPath mencatat jumlah kata setiap 30 detik, waktu mulai dan kumpul, serta berapa kali kamu merevisi, bukan isi ketikanmu. Jawabanmu lalu dianalisis otomatis untuk level Bloom dan indikasi penggunaan AI. Hasilnya bahan tinjau dosen pengampu kelasmu, bukan keputusan, dan tidak pernah memicu sanksi otomatis.",
      required: true,
      anchor: "analisis-otomatis",
    },
    {
      key: "usia_atau_izin_wali",
      title: "Usia",
      body: "Saya berusia 18 tahun atau lebih. Kalau belum, orang tua atau wali saya sudah menyetujui pemrosesan ini.",
      required: true,
      anchor: "anak",
    },
    {
      key: "analisis_luar_negeri",
      title: "Analisis tambahan oleh penyedia di luar negeri",
      body: "Izinkan teks jawabanmu dikirim ke Groq (Amerika Serikat) dan Winston AI (Kanada) untuk analisis yang lebih lengkap. Yang dikirim hanya teks jawaban, ditambah jenjang studi untuk Groq, tanpa nama atau email. Winston menyimpan teks yang dinilai sebagai laporan sampai laporan itu dihapus. Tanpa izin ini, jawabanmu tetap dianalisis, tetapi hanya dengan metode heuristik di server ThinkPath; hasilnya bisa kurang akurat, dan dosen melihat bahwa skornya berasal dari heuristik.",
      required: false,
      anchor: "penyedia-layanan",
    },
  ],
  teacher: [
    {
      key: "data_perkuliahan",
      title: "Data akun dan kelas",
      body: "ThinkPath menyimpan akun Anda, kelas, tugas, materi, dan penilaian yang Anda berikan. Datanya disimpan dan diproses oleh penyedia cloud di luar Indonesia: Supabase untuk basis data (Singapura), serta Hugging Face dan Vercel untuk server aplikasi (perusahaan Amerika Serikat).",
      required: true,
      anchor: "data-yang-dikumpulkan",
    },
    {
      key: "tanggung_jawab_dosen",
      title: "Tanggung jawab atas data mahasiswa",
      body: "Saya memakai data mahasiswa hanya untuk perkuliahan di kelas saya dan menjaga kerahasiaannya. Skor indikasi AI dan level Bloom adalah bahan tinjau dengan keterbatasan yang dijelaskan di Kebijakan Privasi. Saya tidak menjatuhkan sanksi akademik hanya berdasarkan skor, dan memberi mahasiswa kesempatan menjelaskan jawabannya, misalnya lewat sesi diskusi jawaban.",
      required: true,
      anchor: "analisis-otomatis",
    },
  ],
};
