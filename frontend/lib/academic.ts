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
