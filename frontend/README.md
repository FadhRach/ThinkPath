# ThinkPath — Frontend

Next.js 15 (App Router) + React 19 + TypeScript strict + Tailwind CSS + shadcn/ui. Seluruh data diambil dari backend Django; frontend tidak pernah mengakses database langsung.

> Panduan menyeluruh proyek ada di [README utama](../README.md).

---

## Menjalankan Lokal

Frontend berdiri sendiri. Backend dijalankan terpisah (lihat [backend/README.md](../backend/README.md)) dan harus sudah hidup di `127.0.0.1:7860`.

```bash
cp .env.local.example .env.local   # NEXT_PUBLIC_BACKEND_URL=http://127.0.0.1:7860
npm install
npm run dev                        # http://localhost:3000
```

Windows PowerShell: `Copy-Item .env.local.example .env.local`, lalu `npm install` dan `npm run dev`.

Login dengan akun demo (password `thinkpath123`): `dosen@thinkpath.local` · `mhs01@thinkpath.local` s.d. `mhs08@thinkpath.local`. Setelah mengubah `NEXT_PUBLIC_BACKEND_URL`, jalankan ulang `npm run dev`.

URL API lokal memakai `127.0.0.1` supaya browser tidak memilih alamat IPv6
`::1` saat Django hanya mendengarkan di IPv4.

Ekstensi browser dapat menambahkan atribut `fdprocessedid` sebelum React
melakukan hydration. Kontrol form login dan pendaftaran memakai
`suppressHydrationWarning` secara lokal untuk menoleransi atribut tambahan ini.

```bash
npm run build         # production build (jangan dijalankan di folder ini saat `npm run dev` hidup)
npm run lint          # ESLint, termasuk aturan arah impor antar lapisan
npm run typecheck     # tsc --noEmit (strict, tanpa any)
npm test              # node --test tests/*.test.mjs
npm run format        # Prettier ke seluruh kode; format:check untuk CI
```

> Perubahan `tailwind.config.ts` **tidak dimuat ulang** oleh `npm run dev`. Setelah mengubahnya,
> hentikan server, hapus `.next`, lalu jalankan lagi.

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
│   ├── shared/           Komposisi lintas fitur (PageHeader, StatCard, EmptyState, StatusPage, FormField, ...)
│   ├── layout/           Kerangka aplikasi (AppShell, RoleLayout, TopNav, Footer, Brandmark, ...)
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
├── tests/                node --test; tests/helpers/load-ts.mjs memuat modul TS murni tanpa bundler
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

Selain itu: satu komponen satu berkas, **named export** (default export hanya untuk berkas yang
diwajibkan Next.js), impor memakai alias `@/` saja, dan logika yang bukan tampilan
(menghitung, menyusun kalimat, mengelompokkan) ditaruh di `features/<domain>/lib/` sehingga
bisa diuji tanpa React.

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

- `lib/privacy.ts` harus tetap di jalur itu: tes backend membaca berkasnya untuk mencocokkan
  `PRIVACY_POLICY_VERSION`.
- `tests/privacy.test.mjs` membaca `features/privacy/components/PolicyArticle.tsx` dan semua
  tautan `kebijakan-privasi#...`; jangkar yang diubah harus diubah di kedua tempat.
- `lib/api/errors|messages|request.ts` dan `features/*/lib/*` yang diuji sengaja tanpa alias `@/`
  dan tanpa impor runtime Next.js supaya bisa dimuat `tests/helpers/load-ts.mjs`.

---

## Peta Rute

| Peran | Rute | Isi |
|---|---|---|
| Dosen | `/dashboard` | Overview: peta kelas dua sumbu, sebaran Bloom, tren kohort |
| Dosen | `/dashboard/classes` | Daftar kelas dan kode gabung |
| Dosen | `/dashboard/classes/[id]` | Detail kelas: pemilih tugas + tabel submission |
| Dosen | `/dashboard/tugas` | Seluruh tugas lintas kelas |
| Dosen | `/dashboard/cekpaham` | Daftar Cek Paham, ringkasan, dan laporan menunggu |
| Dosen | `/dashboard/cekpaham/[id]` | Hasil Cek Paham: audio, transkrip server vs caption, saran skor berlabel "belum dikalibrasi", bukti, laporan mahasiswa |
| Dosen | `/dashboard/laporan` | Laporan agregat per kelas, prodi, semester |
| Dosen | `/dashboard/students/[id]` | Profil kognitif seorang mahasiswa |
| Dosen | `/dashboard/submission/[id]` | Bukti lengkap satu jawaban + linimasa proses |
| Mahasiswa | `/student` | Beranda: tugas aktif dan nilai |
| Mahasiswa | `/student/tugas` | Daftar tugas dan tenggat |
| Mahasiswa | `/student/submit/[id]` | Mengerjakan / merevisi jawaban |
| Mahasiswa | `/student/cekpaham/[id]` | Cek Paham: persetujuan suara, tes mikrofon, menjawab dengan suara, transkrip sendiri, lapor (tanpa skor) |
| Mahasiswa | `/student/progress` | Perkembangan penalaran dan rekap nilai tugas per kelas, **tanpa kolom indikasi AI** |
| Keduanya | `/dashboard/pengaturan`, `/student/pengaturan` | Ubah nama tampil dan jenjang |

Rute Materi (`/student/materi`, `/dashboard/classes/[id]?tab=materi`) dan Jadwal (`/student/jadwal`) sudah aktif.

---

## Keputusan Teknis

| Hal | Pilihan | Alasan |
|---|---|---|
| Data fetching | Server Components + `cache: "no-store"` | Data penilaian harus segar; kecepatan ditangani `loading.tsx` + `staleTimes` |
| Styling | Tailwind CSS **v3.4** | **Jangan** upgrade ke v4 — preset shadcn yang dipakai belum kompatibel |
| Komponen | shadcn/ui jalur `shadcn@2` | Tambah komponen: `npx shadcn@2 add <nama>`, **bukan** `@latest` |
| Ikon | `lucide-react` **0.468.x** | Dipin; 1.x menargetkan React 19 dan merusak build |
| Chart | Recharts, dimuat malas | Menyeret seluruh keluarga d3, jadi halaman tanpa grafik tidak ikut membayarnya |
| Font | Plus Jakarta Sans (isi) + Newsreader (judul) via `next/font` | Self-hosted saat build, tanpa request jaringan pemblokir |
| Tema | Terang di aplikasi; landing terang/gelap lewat `?tema=` | Tema tersimpan butuh cookie/localStorage, bertentangan dengan kebijakan privasi |

Seluruh design token (teal dalam `--primary`, teal terang `--brand-teal`, status, radius) hidup sebagai variabel HSL di `styles/tokens.css`, dipetakan di `tailwind.config.ts`. Ganti tema cukup di dua berkas itu; dokumentasinya ada di [diagram/06-design-system.md](../diagram/06-design-system.md).

> `components/ui/button.tsx` sengaja diberi `"use client"`. Versi baru `@radix-ui/react-slot` memanggil `createContext` di top-level modul; tanpa directive itu setiap halaman yang memakai Button gagal saat build RSC. Karena itu `buttonVariants` dan gaya tab (`tab-styles.ts`) hidup di berkas tanpa `"use client"`: server component tidak boleh memanggil fungsi yang diekspor dari modul client.

### Performa

Empat keputusan yang saling terkait — jangan dicabut sebagian:

- **`loading.tsx` di seluruh area dasbor** (skeleton lewat `components/shared/PageSkeleton`; yang di `dashboard/` dan `student/` sekaligus menjadi fallback rute anaknya). Selain menghilangkan layar beku saat navigasi, loading boundary inilah yang membuat prefetch `<Link>` bekerja pada rute dinamis.
- **Layout tidak menunggu jaringan.** Peran dibaca dari klaim JWT di cookie (`lib/auth-claims.ts`, dibaca `RoleLayout`; decode tanpa verifikasi — hanya untuk tampilan, backend tetap memverifikasi tanda tangan), nama pengguna di-stream lewat Suspense. Fetch halaman berjalan paralel dengan `/api/me`, bukan setelahnya.
- **Semua tombol mutasi memakai `hooks/use-action.ts`** — `router.refresh()` berjalan di dalam `useTransition`, jadi tombol tetap pending sampai data baru benar-benar tampil, bukan idle di atas data basi. Hook ini juga mengirim toast sukses (`successMessage`) dan toast galat.
- **`next.config.mjs`**: `optimizePackageImports` untuk lucide-react/recharts, dan `staleTimes.dynamic: 30` sehingga navigasi ulang dalam 30 detik terasa instan — tetap aman karena setiap mutasi memanggil `router.refresh()` yang membatalkan cache.

---

## Environment

| Var | Keterangan |
|---|---|
| `NEXT_PUBLIC_BACKEND_URL` | URL backend Django. Publik (ikut ke browser), aman karena hanya URL |
| `NEXT_PUBLIC_DISPLAY_TIME_ZONE` | Zona waktu tampilan. Kosong berarti `Asia/Jakarta` |
| `NEXT_PUBLIC_PRIVACY_CONTACT_EMAIL` | Surel permohonan hak subjek data di Kebijakan Privasi. Kosong berarti permohonan diarahkan lewat dosen pengampu |

Zona waktu **dipaku, bukan mengikuti mesin yang merender**. Backend mengirim seluruh waktu dalam UTC; tanpa zona yang disebut, hasilnya mengikuti proses yang kebetulan menjalankannya — benar di laptop UTC+7, meleset tujuh jam di Vercel yang UTC. Untuk produk ini itu bukan kosmetik, karena pembacaan forensik proses bergantung pada jam yang benar.

**Tidak ada secret di frontend.** Analisis AI hanya dipanggil server-side di backend, tidak pernah dari browser.

---

## Deploy: Vercel

1. Import folder `frontend/` sebagai project Vercel (Next.js terdeteksi otomatis).
2. Set env `NEXT_PUBLIC_BACKEND_URL` ke URL backend. Di produksi: `https://thinkpath.fadh.tech`, API di VPS Jakarta (lihat [backend/README.md](../backend/README.md#deploy-produksi-vps)).
3. Deploy, lalu pastikan backend sudah mengizinkan origin Vercel di `CORS_ALLOWED_ORIGINS`.

Frontend (Vercel) dan backend (VPS) di-deploy terpisah. Migrasi basis data berjalan otomatis setiap container `api` mulai (`deploy/entrypoint.sh`); langkah deploy ada di [backend/README.md](../backend/README.md#deploy-produksi-vps).

> `NEXT_PUBLIC_BACKEND_URL` ikut ter-bake saat build, jadi mengubahnya menuntut **redeploy**, bukan sekadar restart. Jangan pernah menaruh rahasia di variabel berawalan `NEXT_PUBLIC_` — semuanya masuk ke bundel browser.
