# ThinkPath — Frontend

Next.js 15 (App Router) + React 19 + TypeScript strict + Tailwind CSS + shadcn/ui. Seluruh data lewat API Django; frontend tidak pernah mengakses database. Panduan proyek: [README utama](../README.md).

---

## Menjalankan Lokal

Backend dijalankan terpisah ([backend/README.md](../backend/README.md)) dan harus sudah hidup di `127.0.0.1:7860`.

```bash
cp .env.local.example .env.local   # NEXT_PUBLIC_BACKEND_URL=http://127.0.0.1:7860
npm install
npm run dev                        # http://localhost:3000
```

Windows PowerShell: `Copy-Item .env.local.example .env.local`.

- **Demo/penjurian: pakai `npm run build && npm start`**, bukan `npm run dev` (dev mengompilasi tiap rute 2–3 detik saat pertama dibuka). Buka tiap halaman utama sekali untuk menghangatkan server.
- Akun demo (password `thinkpath123`): `dosen@thinkpath.local`, `dosen2@thinkpath.local`, `mhs01`…`mhs20@thinkpath.local`.
- `127.0.0.1`, bukan `localhost`: browser bisa memilih IPv6 `::1` sementara Django hanya di IPv4.
- Form login/daftar memakai `suppressHydrationWarning` karena ekstensi browser menambah atribut `fdprocessedid`.

```bash
npm run build         # production build (jangan dijalankan di folder ini saat `npm run dev` hidup)
npm run lint          # ESLint, termasuk aturan arah impor antar lapisan
npm run typecheck     # tsc --noEmit (strict, tanpa any)
npm run format        # Prettier ke seluruh kode; format:check untuk CI
```

> `tailwind.config.ts` **tidak dimuat ulang** oleh `npm run dev`: hentikan server, hapus `.next`, jalankan lagi.

---

## Struktur

```
frontend/
├── app/                  Rute (App Router). Tipis: ambil data, susun komponen. Target < 120 baris per page.tsx
│   ├── login/, register/, lupa-sandi/, reset-sandi/, kebijakan-privasi/, persetujuan/
│   ├── dashboard/        DOSEN   (layout.tsx = RoleLayout, error.tsx, not-found.tsx, loading.tsx)
│   ├── student/          MAHASISWA
│   └── bff/              Jembatan same-origin ke API; menyisipkan token dari cookie HttpOnly
├── components/           Komponen yang TIDAK terikat satu domain
│   ├── ui/               Primitif shadcn + varian ThinkPath (Button, Badge, Card, Alert, IconTile, Toaster, ...)
│   ├── shared/           Komposisi lintas fitur (StatCard, EmptyState, StatusPage, FormField, ...)
│   ├── layout/           Kerangka aplikasi (AppShell, SidebarShell, RoleLayout, Footer, Brandmark, ...)
│   └── charts/           Pembantu chart generik (ChartLegend, warna)
├── features/<domain>/    Segala hal milik satu domain: components/, lib/ (logika murni), hooks/
│   ├── classes, assignments, submissions, cekpaham, materials, schedule
│   ├── overview (+ chart Recharts), reports, notifications, bloom
│   └── auth, privacy, settings, landing
├── hooks/                Hook lintas fitur (use-action)
├── lib/                  Infrastruktur dan kontrak, tanpa tampilan
│   ├── api/              errors, messages, request (inti), server, browser, direct (unggahan bertiket)
│   ├── types/            Tipe payload API per domain (barrel: impor dari "@/lib/types")
│   ├── data/             Getter server per domain (barrel: "@/lib/data")
│   ├── mutations/        Aksi tulis dari browser per domain (barrel: "@/lib/mutations")
│   └── formatting, privacy, notify, text, avatar, auth-claims, auth-token, utils
├── styles/tokens.css     Token warna terang/gelap (satu-satunya sumber nilai warna dan radius)
└── middleware.ts         Guard rute /dashboard, /student, /persetujuan
```

### Aturan lapisan (dijaga ESLint)

| Lapisan | Boleh mengimpor | Tidak boleh |
|---|---|---|
| `components/ui` | `lib/` dan sesama `ui` | `shared`, `layout`, `features`, `app` |
| `components/shared`, `components/charts` | `ui`, `lib/`, `hooks/` | `features`, `layout`, `app` |
| `components/layout` | `ui`, `shared`, `features`, `lib/` | `app` |
| `features/*` | `ui`, `shared`, `lib/`, `hooks/`, fitur lain lewat `components/` atau `lib/` miliknya | `app` |
| `app/*` | semuanya | |

Satu komponen satu berkas, **named export** (default hanya bila diwajibkan Next.js), impor lewat alias `@/`, logika non-tampilan di `features/<domain>/lib/`.

### Cara menambah sesuatu

| Mau menambah | Taruh di | Catatan |
|---|---|---|
| Halaman baru | `app/<area>/<rute>/page.tsx` | Ambil data dengan `@/lib/data`, rakit dari komponen fitur. Tambah `loading.tsx` bila datanya berat. |
| Komponen khusus satu domain | `features/<domain>/components/` | Gunakan `ui`/`shared`; jangan menulis kelas warna sendiri. |
| Komponen yang dipakai banyak domain | `components/shared/` | Harus tidak tahu apa pun tentang domain. |
| Badge untuk nilai domain | `features/<domain>/components/` | Petakan nilainya ke `tone` pada `Badge`; jangan menulis `rounded-full bg-...` tangan. |
| Tombol, tautan berbentuk tombol | `Button` / `<Button asChild>` | `buttonVariants` (dari `ui/button-variants`) untuk server component. |
| Endpoint baru | `lib/data/<domain>.ts` (baca) atau `lib/mutations/<domain>.ts` (tulis), tipe di `lib/types/<domain>.ts` | Daftarkan di barrel `index.ts` bila domainnya baru. |
| Pesan ke pengguna | `notify.success/error` (toast), `Alert` (tetap di halaman), `ConfirmDialog` (sebelum aksi berisiko) | Jangan memakai `window.confirm`/`alert`. |
| Halaman 404/403/galat | `StatusPage` / `ErrorBoundaryPage` | `not-found.tsx` dan `error.tsx` tiap area hanya memberi teks dan tujuan. |
| Warna atau ukuran baru | `styles/tokens.css` + `tailwind.config.ts` | Tanpa `text-[..]`, `rounded-[..]`, atau hex di komponen. |

### Kontrak yang tidak boleh patah

- `lib/privacy.ts` harus tetap di jalur itu: tes backend membacanya untuk mencocokkan `PRIVACY_POLICY_VERSION`.
- Jangkar `kebijakan-privasi#...` yang dirujuk dari layar persetujuan dan butir persetujuan harus tetap ada di `PolicyArticle.tsx`.

---

## Peta Rute

| Peran | Rute | Isi |
|---|---|---|
| Dosen | `/dashboard` | Beranda: antrean "Perlu diperiksa", kartu kelas (pintasan ikon ke Mahasiswa/Materi/Forum/Tugas), forum terbaru, ringkasan Cek Paham, tenggat terdekat |
| Dosen | `/dashboard/forum` | Forum semua kelas: kartu kelas, pencarian, saringan kelas dan jenis, "Belum dibalas" |
| Dosen | `/dashboard/classes` | Kartu kelas (pencarian, Buat kelas sebaris, pintasan ikon ke tab) |
| Dosen | `/dashboard/classes/[id]` | Detail kelas, tab `?tab=`: **Analitik** (bawaan: angka ringkas, antrean periksa kelas ini, Cek Paham per mahasiswa, peta dan tren Bloom), Mahasiswa, Tugas, Materi, Forum |
| Dosen | `/dashboard/tugas` | Seluruh tugas lintas kelas |
| Dosen | `/dashboard/cekpaham` | Daftar Cek Paham: saring kelas dan status (perlu ditinjau, belum selesai, dibatalkan), cari |
| Dosen | `/dashboard/cekpaham/[id]` | Hasil Cek Paham: skor saran berlabel "belum dikalibrasi", transkrip server vs caption, laporan mahasiswa; kolom kanan soal dan analisis tulisan |
| Dosen | `/dashboard/analitik` | Tab `?tab=kelas` (peta dan tren tiap kelas, `?kelas=`) dan `?tab=lintas` (agregat per kelas, prodi, semester) |
| Dosen | `/dashboard/students/[id]` | Profil kognitif seorang mahasiswa |
| Dosen | `/dashboard/pengumpulan?kelas=&tugas=` | Antrean periksa, dikelompokkan per tugas |
| Dosen | `/dashboard/submission/[id]` | Kartu mahasiswa, dokumen/jawaban, ringkasan bukti, penanda gaya; kolom kanan: nilai, saran satu klik, Cek Paham, kemiripan |
| Mahasiswa | `/student` | Beranda: peringatan tugas, kartu kelas (progres + rata-rata), to-do pribadi, jadwal terdekat, forum terbaru, nilai terbaru, gabung kelas |
| Mahasiswa | `/student/tugas` | Tugas semua kelas, dikelompokkan: perlu dikerjakan / menunggu nilai / sudah dinilai; saringan kelas |
| Mahasiswa | `/student/kelas`, `/student/kelas/[id]` | Daftar kartu kelas; detail dengan tab Ringkasan, Forum, Materi, Tugas, Gradebook (nilai, rata-rata, grafik Bloom kelas itu), Anggota (dosen dan teman sekelas) (`?tab=`; `?post=` membuka topik forum) |
| Mahasiswa | `/student/forum` | Kartu kelas di atas membuka forum kelasnya; di bawahnya semua topik lintas kelas bisa dicari dan disaring per kelas dan jenis |
| Mahasiswa | `/student/jadwal` | Kalender tenggat dan sesi Cek Paham |
| Mahasiswa | `/student/submit/[id]` | Mengerjakan / merevisi jawaban: header (judul, instruksi, tenggat hidup, nilai dan target kognitif vs hasil), masukan dosen di atas, editor kaya (TipTap: format, daftar, tabel, kode, rumus KaTeX, tautan, gambar kecil, Tab menjorok), minimal 5 kata, terkunci otomatis saat tenggat lewat, kartu status perubahan |
| Mahasiswa | `/student/cekpaham/[id]` | Cek Paham: persetujuan suara, tes mikrofon, menjawab dengan suara, transkrip sendiri, lapor (tanpa skor) |
| Mahasiswa | `/student/gradebook` (`?kelas=<id>` memilih kelas awal) | Satu halaman: kartu kelas yang bisa digeser di atas; rapor nilai, umpan balik dosen, dan grafik perkembangan penalaran kelas terpilih tampil di bawahnya, **tanpa kolom indikasi AI** |
| Keduanya | `/dashboard/pengaturan`, `/student/pengaturan` | Ubah nama tampil dan jenjang |

`/student/progress` dan `/student/materi/[id]` hanya mengalihkan (tautan lama). Sidebar lipat: `components/layout/SidebarShell.tsx` + `nav-config.ts`; kirim `role`, bukan daftar menu (ikon tidak bisa melintasi batas server→klien). Status lipat hanya di memori React (kebijakan privasi: tanpa cookie/localStorage tambahan).

---

## Keputusan Teknis

| Hal | Pilihan | Alasan |
|---|---|---|
| Data fetching | Server Components + `cache: "no-store"` | Data penilaian harus segar; kecepatan ditangani `loading.tsx` + `staleTimes` |
| Styling | Tailwind CSS **v3.4** | **Jangan** upgrade ke v4 — preset shadcn yang dipakai belum kompatibel |
| Komponen | shadcn/ui jalur `shadcn@2` | Tambah komponen: `npx shadcn@2 add <nama>`, **bukan** `@latest` |
| Ikon | `lucide-react` **0.468.x** | Dipin; 1.x menargetkan React 19 dan merusak build |
| Chart | Recharts, dimuat malas | Menyeret seluruh keluarga d3, jadi halaman tanpa grafik tidak ikut membayarnya |
| Font | Hanya Plus Jakarta Sans via `next/font` (tanpa serif atau monospace) | Self-hosted saat build, tanpa request jaringan pemblokir |
| Tema | Terang di aplikasi; landing terang/gelap lewat `?tema=` | Tema tersimpan butuh cookie/localStorage, bertentangan dengan kebijakan privasi |

Design token (HSL) di `styles/tokens.css`, dipetakan di `tailwind.config.ts`; dokumentasi: [diagram/06-design-system.md](../diagram/06-design-system.md).

> `components/ui/button.tsx` sengaja `"use client"` (`@radix-ui/react-slot` memanggil `createContext` di top-level). Karena itu `buttonVariants` dan `tab-styles.ts` ada di berkas tanpa `"use client"`: server component tidak boleh memanggil fungsi dari modul client.

### Performa

Empat keputusan yang saling terkait, jangan dicabut sebagian:

- **`loading.tsx` di seluruh area dasbor** (`PageSkeleton`): menghilangkan layar beku dan membuat prefetch `<Link>` bekerja pada rute dinamis.
- **Layout tidak menunggu jaringan**: peran dari klaim JWT di cookie (`lib/auth-claims.ts`, decode tanpa verifikasi, hanya tampilan); nama di-stream lewat Suspense.
- **Semua tombol mutasi lewat `hooks/use-action.ts`**: `router.refresh()` di dalam `useTransition`, tombol pending sampai data baru tampil; juga mengirim toast.
- **`next.config.mjs`**: `optimizePackageImports` (lucide-react/recharts) dan `staleTimes.dynamic: 30` (aman karena mutasi memanggil `router.refresh()`).

---

## Environment

| Var | Keterangan |
|---|---|
| `NEXT_PUBLIC_BACKEND_URL` | URL backend Django. Publik (ikut ke browser), aman karena hanya URL |
| `NEXT_PUBLIC_DISPLAY_TIME_ZONE` | Zona waktu tampilan. Kosong berarti `Asia/Jakarta` |
| `NEXT_PUBLIC_PRIVACY_CONTACT_EMAIL` | Surel permohonan hak subjek data di Kebijakan Privasi. Kosong berarti permohonan diarahkan lewat dosen pengampu |

Zona waktu **dipaku**: backend mengirim UTC; tanpa zona eksplisit tampilan benar di laptop UTC+7 tetapi meleset 7 jam di Vercel (forensik proses bergantung pada jam ini). **Tidak ada secret di frontend.**

---

## Deploy: Vercel

1. Import folder `frontend/` sebagai project Vercel (Next.js terdeteksi otomatis).
2. Set env `NEXT_PUBLIC_BACKEND_URL` ke URL backend. Di produksi: `https://thinkpath.fadh.tech`, API di VPS Jakarta (lihat [backend/README.md](../backend/README.md#deploy-produksi-vps)).
3. Deploy, lalu pastikan backend sudah mengizinkan origin Vercel di `CORS_ALLOWED_ORIGINS`.

> `NEXT_PUBLIC_*` ter-bake saat build (ubah = **redeploy**) dan masuk ke bundel browser: jangan taruh rahasia di sana.
