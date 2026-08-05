# ThinkPath Frontend

Next.js 14 (App Router) + TypeScript (strict) + Tailwind CSS + shadcn/ui. Semua
data diambil dari backend Django. Frontend tidak pernah mengakses database
langsung. Tutorial end-to-end (backend + database) ada di [README root](../README.md).

## Stack & keputusan penting

| Hal | Pilihan | Catatan |
|-----|---------|---------|
| Framework | Next.js 14 App Router | Server Components untuk fetch data |
| Styling | Tailwind CSS **v3.4** | tetap v3, JANGAN upgrade ke v4 |
| Komponen | shadcn/ui (jalur `shadcn@2`) | tambah komponen: `npx shadcn@2 add <nama>`, **bukan** `@latest` (Nova preset = Tailwind v4) |
| Ikon | `lucide-react` **0.468.x** | dipin; 1.x menargetkan React 19 dan merusak build |
| Chart | Recharts | `GradeBarChart`, `BloomTrendChart` |
| Font | Plus Jakarta Sans | via `next/font`, variabel `--font-sans` |

Palette teal (`#0ABAB5 / #56DFCF / #ADEED9 / #FFEDF3`) dan seluruh design token
hidup sebagai variabel HSL di `app/globals.css` `:root`, dipetakan di
`tailwind.config.ts`. Ganti tema/warna cukup di dua file itu.

> Catatan: `components/ui/button.tsx` sengaja diberi `"use client"`. Versi baru
> `@radix-ui/react-slot` memanggil `createContext` di top-level modul; tanpa
> directive itu setiap halaman yang memakai Button gagal saat build RSC.

## Struktur

```
frontend/
├── app/
│   ├── page.tsx                 # landing
│   ├── login, register/         # auth (split-screen + role selector)
│   ├── dashboard/               # GURU
│   │   ├── page.tsx             # daftar kelas (kartu)
│   │   ├── classes/[classId]/   # detail kelas: tugas + tabel submission
│   │   └── submission/[id]/     # detail submission + penilaian
│   └── student/                 # SISWA
│       ├── page.tsx             # beranda: ringkasan + kelas
│       └── submit/[assignmentId]/  # kerjakan / revisi jawaban
├── components/
│   ├── common/                  # kit reusable: AppShell, TopNav, StatCard, BloomStepper, ...
│   ├── ui/                      # primitives shadcn
│   ├── dashboard/, student/, submission/   # fitur per-peran
├── lib/
│   ├── api.ts / api-browser.ts  # fetch server / client (Bearer token dari cookie)
│   ├── data.ts                  # getter data (server), getMe dibungkus React cache()
│   ├── mutations.ts             # aksi tulis (client)
│   └── types.ts                 # tipe bersama
└── middleware.ts                # guard rute /dashboard & /student (cek token)
```

## Menjalankan lokal

```bash
cp .env.local.example .env.local    # NEXT_PUBLIC_BACKEND_URL=http://localhost:7860
npm install
npm run dev                         # http://localhost:3000
```

Pastikan backend Django jalan di port 7860 dulu. Login pakai akun demo
(`guru@thinkpath.local` / `siswa01@thinkpath.local`, password `thinkpath123`).

## Skrip

```bash
npm run dev      # dev server
npm run build    # production build
npm run lint     # ESLint
npx tsc --noEmit # type check (strict, tanpa any)
```

## Environment

| Var | Keterangan |
|-----|------------|
| `NEXT_PUBLIC_BACKEND_URL` | URL backend Django. Publik (dikirim ke browser), aman, hanya URL. |

Tidak ada secret di frontend. Analisis AI (Groq) hanya dipanggil server-side di
backend, tidak pernah dari browser.

## Deploy: Vercel

1. Import folder `frontend/` sebagai project Vercel (Next.js terdeteksi otomatis).
2. Set env `NEXT_PUBLIC_BACKEND_URL=https://<nama-space>.hf.space`.
3. Deploy. Pastikan backend HF sudah mengizinkan origin Vercel di
   `CORS_ALLOWED_ORIGINS`.
