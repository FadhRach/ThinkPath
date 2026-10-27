import { redirect } from "next/navigation";

/** Tidak ada daftar Cek Paham tersendiri; permintaan yang terbuka tampil di Beranda. */
export default function StudentCekPahamIndexPage(): never {
  redirect("/student");
}
