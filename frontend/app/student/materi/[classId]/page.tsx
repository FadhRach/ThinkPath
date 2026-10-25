import { redirect } from "next/navigation";

/** Alamat lama yang masih ada di notifikasi lama; materi kini tab di halaman kelas. */
export default async function LegacyMaterialsPage({
  params,
}: {
  params: Promise<{ classId: string }>;
}): Promise<never> {
  const { classId } = await params;
  redirect(`/student/kelas/${classId}?tab=materi`);
}
