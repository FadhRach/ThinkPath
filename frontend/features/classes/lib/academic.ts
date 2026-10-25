/**
 * Perakit label akademik yang dipakai bersama kartu kelas dan header submission.
 *
 * Prodi boleh kosong (mata kuliah umum atau kelas lintas prodi) dan semester
 * boleh null (kelas yang ditawarkan lintas semester), jadi bagian yang kosong
 * harus hilang tanpa menyisakan pemisah menggantung.
 */
export function academicLabel(input: {
  education_level: string;
  program_studi?: string | null;
  semester?: number | null;
}): string {
  const parts = [input.education_level];
  if (input.program_studi) parts.push(input.program_studi);
  if (typeof input.semester === "number") parts.push(`Semester ${input.semester}`);
  return parts.join(" · ");
}

/**
 * Nama mata kuliah, atau null bila sudah terkandung di nama kelas.
 *
 * Kelas lazim dinamai dari mata kuliahnya ("Metodologi Penelitian A"), dan
 * menulis keduanya berdampingan menghasilkan "Metodologi Penelitian A ·
 * Metodologi Penelitian". Nama kelas yang tidak memuat mata kuliahnya
 * ("Kelas Pagi") tetap disertai mata kuliah.
 *
 * Dicocokkan per kata, bukan potongan huruf: mata kuliah "Seni" tidak boleh
 * hilang hanya karena kelasnya bernama "Kelas Senin".
 */
export function distinctSubject(className: string, subject: string): string | null {
  const name = className.trim().toLowerCase();
  const sub = subject.trim().toLowerCase();
  if (!sub) return null;
  const escaped = sub.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const wholeWords = new RegExp(`(^|[^a-z0-9])${escaped}($|[^a-z0-9])`);
  return wholeWords.test(name) ? null : subject;
}
