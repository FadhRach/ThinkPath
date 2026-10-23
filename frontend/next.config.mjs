import { fileURLToPath } from "node:url";

const isDev = process.env.NODE_ENV !== "production";

// Origin API untuk panggilan langsung (unggahan besar dengan tiket). Panggilan
// biasa lewat /bff sama-origin dan tidak butuh izin ini.
function apiOrigin() {
  try {
    return new URL(process.env.NEXT_PUBLIC_BACKEND_URL ?? "").origin;
  } catch {
    return "";
  }
}

// CSP. script-src memakai 'unsafe-inline' karena hidrasi Next.js menyisipkan
// skrip inline dan nonce per-request memaksa semua halaman dirender dinamis
// (landing statis ikut hilang). Kompromi yang disadari: tidak ada sink XSS di
// kode (tanpa dangerouslySetInnerHTML/eval), token tidak terbaca JavaScript
// (cookie HttpOnly), dan direktif lain membatasi ke mana data bisa dikirim.
const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  `connect-src 'self' ${apiOrigin()}${isDev ? " ws://localhost:3000 ws://127.0.0.1:3000" : ""}`.trim(),
  "media-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: contentSecurityPolicy },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Mikrofon dibutuhkan Cek Paham; kamera, lokasi, dan lainnya tidak.
  { key: "Permissions-Policy", value: "microphone=(self), camera=(), geolocation=(), payment=()" },
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
  outputFileTracingRoot: fileURLToPath(new URL(".", import.meta.url)),
  // Halaman Verifikasi Verbal digantikan Cek Paham.
  async redirects() {
    return [{ source: "/dashboard/verifikasi", destination: "/dashboard/cekpaham", permanent: true }];
  },
  experimental: {
    // Impor per-ikon/per-chart, bukan seluruh paket — mempercepat kompilasi dev
    // dan memperkecil bundel.
    optimizePackageImports: ["lucide-react", "recharts"],
    // Navigasi ulang ke rute dinamis yang sama dalam 30 detik memakai cache
    // router (instan). Data tetap segar karena semua mutasi memanggil
    // router.refresh() yang membatalkan cache ini.
    staleTimes: { dynamic: 30 },
  },
};

export default nextConfig;
