import { cookies } from "next/headers";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { NextResponse } from "next/server";

import { fetchApi, resolveJson } from "@/lib/api-shared";
import { AUTH_COOKIE_NAME } from "@/lib/auth-token";
import type { Profile } from "@/lib/types";

/**
 * Menerbitkan token upload langsung-ke-Blob untuk mahasiswa yang sedang
 * login. Berkas jawaban tidak pernah lewat fungsi Django (batas payload
 * Vercel Function 4,5 MB akan menolak scan multi-halaman/foto HP yang
 * realistis) - route ini hanya mengeluarkan izin unggah, ekstraksi teks
 * dilakukan endpoint Django terpisah setelah berkas sampai di Blob.
 *
 * Otorisasi memakai /api/me yang sudah ada di backend, BUKAN memverifikasi
 * tanda tangan JWT sendiri di sini. Memverifikasi sendiri berarti
 * menduplikasi DJANGO_SECRET_KEY sebagai secret baru di proyek Vercel
 * frontend, plus risiko keduanya tidak sinkron saat kuncinya dirotasi.
 * Backend Django tetap satu satunya sumber kebenaran identitas.
 */
export async function POST(request: Request) {
  const token = cookies().get(AUTH_COOKIE_NAME)?.value ?? null;
  if (!token) {
    return NextResponse.json({ detail: "Belum masuk." }, { status: 401 });
  }

  let profile: Profile;
  try {
    const response = await fetchApi("/api/me", { cache: "no-store" }, token);
    profile = await resolveJson<Profile>(response);
  } catch {
    return NextResponse.json({ detail: "Sesi tidak valid." }, { status: 401 });
  }

  if (profile.role !== "student") {
    return NextResponse.json(
      { detail: "Hanya mahasiswa yang bisa mengunggah dokumen jawaban." },
      { status: 403 },
    );
  }

  const body = (await request.json()) as HandleUploadBody;

  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async () => ({
        allowedContentTypes: [
          "application/pdf",
          "image/png",
          "image/jpeg",
          "image/webp",
        ],
        // Harus sama dengan document_extraction.MAX_FILE_SIZE_BYTES di
        // backend - batas di sini murni UX (gagal cepat sebelum unggah
        // selesai), backend tetap memvalidasi ulang secara independen.
        maximumSizeInBytes: 15 * 1024 * 1024,
        addRandomSuffix: true,
        // allowOverwrite/ifMatch sengaja tidak diisi - setiap unggahan punya
        // nama berbeda (timestamp di pathname, lihat DocumentUploadField),
        // jadi tidak pernah ada tabrakan yang perlu ditangani.
        tokenPayload: JSON.stringify({ studentId: profile.id }),
      }),
      onUploadCompleted: async () => {
        // Tidak ada yang perlu ditulis ke basis data di sini - endpoint
        // ekstraksi Django yang memproses berkasnya begitu mahasiswa
        // memicunya, bukan callback ini.
      },
    });
    return NextResponse.json(jsonResponse);
  } catch (error) {
    // @vercel/blob/client selalu melempar pesan generik "Failed to retrieve
    // the client token" ke sisi browser apa pun penyebabnya (demi keamanan,
    // supaya klien tidak tahu detail konfigurasi server) - jadi penyebab
    // sesungguhnya (mis. BLOB_READ_WRITE_TOKEN kosong/salah) hanya pernah
    // terlihat di log server ini, bukan di UI.
    console.error("Gagal menerbitkan token upload Blob:", error);
    return NextResponse.json(
      { detail: error instanceof Error ? error.message : "Gagal menerbitkan token unggah." },
      { status: 400 },
    );
  }
}
