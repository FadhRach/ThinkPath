/** @type {import('next').NextConfig} */
const nextConfig = {
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
