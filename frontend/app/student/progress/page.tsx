import { redirect } from "next/navigation";

/** Alamat lama; progres dan rapor kini ada di Gradebook. */
export default function LegacyProgressPage(): never {
  redirect("/student/gradebook");
}
