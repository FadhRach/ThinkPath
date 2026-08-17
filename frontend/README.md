# ThinkPath — Frontend

Next.js 14 (App Router) + TypeScript strict + Tailwind CSS + shadcn/ui. Seluruh data diambil dari backend Django; frontend tidak pernah mengakses database langsung.

> Panduan menyeluruh proyek ada di [README utama](../README.md).

---

## Menjalankan Lokal

```bash
cp .env.local.example .env.local   # NEXT_PUBLIC_BACKEND_URL=http://localhost:7860
npm install
npm run dev                        # http://localhost:3000
```

Pastikan backend Django sudah jalan di port 7860 lebih dulu, lalu login dengan akun demo (password `thinkpath123`):
`dosen@thinkpath.local` · `mhs01@thinkpath.local` s.d. `mhs08@thinkpath.local`

```bash
npm run build    # production build
npm run lint     # ESLint
npx tsc --noEmit # type check (strict, tanpa any)
```

---

## Struktur

```
frontend/
├── app/                          Rute (App Router)
│   ├── login/, register/         Auth — split-screen + pemilih peran
│   ├── dashboard/                DOSEN — 8 loading.tsx tersebar sebagai skeleton
│   └── student/                  MAHASISWA
├── components/
│   ├── charts/                   Semua chart Recharts, dimuat malas
│   ├── common/                   Kit bersama: AppShell, TopNav, DataTable,
│   │                             SectionCard, PageSkeleton, BackLink, StatCard
│   ├── ui/                       Primitive shadcn
│   └── dashboard/, student/, submission/, overview/, report/, cognitive/
├── lib/
│   ├── api.ts, api-browser.ts    Fetcher server & client (inti di api-shared.ts)
│   ├── auth-claims.ts            Baca peran dari JWT cookie tanpa panggilan jaringan
│   ├── use-action.ts             Hook mutasi: pending sampai data baru tampil
│   ├── data.ts, mutations.ts     Getter data (server) & aksi tulis (client)
│   └── types.ts                  Tipe bersama
└── middleware.ts                 Guard rute /dashboard & /student
```

---

## Peta Rute

| Peran | Rute | Isi |
|---|---|---|
| Dosen | `/dashboard` | Overview: peta kelas dua sumbu, sebaran Bloom, tren kohort |
| Dosen | `/dashboard/classes` | Daftar kelas dan kode gabung |
| Dosen | `/dashboard/classes/[id]` | Detail kelas: pemilih tugas + tabel submission |
| Dosen | `/dashboard/tugas` | Seluruh tugas lintas kelas |
| Dosen | `/dashboard/verifikasi` | Antrean dan riwayat verifikasi verbal |
| Dosen | `/dashboard/laporan` | Laporan agregat per kelas, prodi, semester |
| Dosen | `/dashboard/students/[id]` | Profil kognitif seorang mahasiswa |
| Dosen | `/dashboard/submission/[id]` | Bukti lengkap satu jawaban + linimasa proses |
| Mahasiswa | `/student` | Beranda: tugas aktif dan nilai |
| Mahasiswa | `/student/tugas` | Daftar tugas dan tenggat |
| Mahasiswa | `/student/submit/[id]` | Mengerjakan / merevisi jawaban |
| Mahasiswa | `/student/progres` | Perkembangan penalaran, **tanpa kolom indikasi AI** |
| Keduanya | `/dashboard/pengaturan`, `/student/pengaturan` | Ubah nama tampil dan jenjang |

Menu **Materi** dan **Jadwal** sengaja dibiarkan nonaktif, bukan diisi halaman kosong. Keduanya butuh model backend yang belum ada, dan menu yang bisa diklik tetapi tidak melakukan apa pun lebih menyesatkan daripada menu yang jujur menyatakan dirinya belum jadi.

---

## Keputusan Teknis

| Hal | Pilihan | Alasan |
|---|---|---|
| Data fetching | Server Components + `cache: "no-store"` | Data penilaian harus segar; kecepatan ditangani `loading.tsx` + `staleTimes` |
| Styling | Tailwind CSS **v3.4** | **Jangan** upgrade ke v4 — preset shadcn yang dipakai belum kompatibel |
| Komponen | shadcn/ui jalur `shadcn@2` | Tambah komponen: `npx shadcn@2 add <nama>`, **bukan** `@latest` |
| Ikon | `lucide-react` **0.468.x** | Dipin; 1.x menargetkan React 19 dan merusak build |
| Chart | Recharts, dimuat malas | Menyeret seluruh keluarga d3, jadi halaman tanpa grafik tidak ikut membayarnya |
| Font | Plus Jakarta Sans via `next/font` | Self-hosted saat build, tanpa request jaringan pemblokir |

Palet teal (`#0ABAB5 / #56DFCF / #ADEED9 / #FFEDF3`) dan seluruh design token hidup sebagai variabel HSL di `app/globals.css` `:root`, dipetakan di `tailwind.config.ts`. Ganti tema cukup di dua berkas itu.

> `components/ui/button.tsx` sengaja diberi `"use client"`. Versi baru `@radix-ui/react-slot` memanggil `createContext` di top-level modul; tanpa directive itu setiap halaman yang memakai Button gagal saat build RSC.

### Performa

Empat keputusan yang saling terkait — jangan dicabut sebagian:

- **`loading.tsx` di seluruh area dasbor** (8 berkas, skeleton lewat `components/common/PageSkeleton`; yang di `dashboard/` dan `student/` sekaligus menjadi fallback rute anaknya). Selain menghilangkan layar beku saat navigasi, loading boundary inilah yang membuat prefetch `<Link>` bekerja pada rute dinamis.
- **Layout tidak menunggu jaringan.** Peran dibaca dari klaim JWT di cookie (`lib/auth-claims.ts`, decode tanpa verifikasi — hanya untuk tampilan, backend tetap memverifikasi tanda tangan), nama pengguna di-stream lewat Suspense. Fetch halaman berjalan paralel dengan `/api/me`, bukan setelahnya.
- **Semua tombol mutasi memakai `lib/use-action.ts`** — `router.refresh()` berjalan di dalam `useTransition`, jadi tombol tetap pending sampai data baru benar-benar tampil, bukan idle di atas data basi.
- **`next.config.mjs`**: `optimizePackageImports` untuk lucide-react/recharts, dan `staleTimes.dynamic: 30` sehingga navigasi ulang dalam 30 detik terasa instan — tetap aman karena setiap mutasi memanggil `router.refresh()` yang membatalkan cache.

---

## Environment

| Var | Keterangan |
|---|---|
| `NEXT_PUBLIC_BACKEND_URL` | URL backend Django. Publik (ikut ke browser), aman karena hanya URL |
| `NEXT_PUBLIC_DISPLAY_TIME_ZONE` | Zona waktu tampilan. Kosong berarti `Asia/Jakarta` |

Zona waktu **dipaku, bukan mengikuti mesin yang merender**. Backend mengirim seluruh waktu dalam UTC; tanpa zona yang disebut, hasilnya mengikuti proses yang kebetulan menjalankannya — benar di laptop UTC+7, meleset tujuh jam di Vercel yang UTC. Untuk produk ini itu bukan kosmetik, karena pembacaan forensik proses bergantung pada jam yang benar.

**Tidak ada secret di frontend.** Analisis AI hanya dipanggil server-side di backend, tidak pernah dari browser.

---

## Deploy: Vercel

1. Import folder `frontend/` sebagai project Vercel (Next.js terdeteksi otomatis).
2. Set env `NEXT_PUBLIC_BACKEND_URL=https://<nama-space>.hf.space`.
3. Deploy, lalu pastikan backend sudah mengizinkan origin Vercel di `CORS_ALLOWED_ORIGINS`.

> `NEXT_PUBLIC_BACKEND_URL` ikut ter-bake saat build, jadi mengubahnya menuntut **redeploy**, bukan sekadar restart. Jangan pernah menaruh rahasia di variabel berawalan `NEXT_PUBLIC_` — semuanya masuk ke bundel browser.
