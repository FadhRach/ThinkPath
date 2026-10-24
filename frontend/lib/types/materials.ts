/** Materi yang dibagikan dosen ke satu kelas: judul, ringkasan, dan tautan. */
export interface Material {
  id: string;
  class_id: string;
  class_name: string;
  /** Topik atau pertemuan, misalnya "Pertemuan 3: Desain kualitatif". Kosong
   *  berarti materi umum seperti silabus. */
  topic: string;
  title: string;
  description: string;
  /** Kosong bila materinya berupa ringkasan tanpa tautan. */
  url: string;
  created_at: string;
}
