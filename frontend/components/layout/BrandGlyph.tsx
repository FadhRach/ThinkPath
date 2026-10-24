interface Props {
  className?: string;
}

/**
 * Glyph merek ThinkPath: jalur berbentuk S dengan dua simpul di kedua ujungnya.
 *
 * Bentuknya metafora langsung dari nama produk. Jalur berkelok itu proses
 * berpikir, dan kedua simpul cincin adalah titik yang bisa ditinjau di
 * sepanjang jalur, bukan satu titik vonis di ujung.
 *
 * Seluruh goresan memakai currentColor dan lubang cincinnya transparan,
 * sehingga glyph ini bisa diletakkan di atas latar apa pun tanpa disalin ulang.
 * Definisi bentuknya HANYA ada di berkas ini; app/icon.svg memakai geometri
 * yang sama persis supaya logo di aplikasi dan di tab browser tidak pernah
 * berbeda.
 */
export function BrandGlyph({ className }: Props) {
  return (
    <svg viewBox="0 0 32 32" fill="none" aria-hidden="true" className={className}>
      <path
        d="M16 9 H12.5 A3.5 3.5 0 0 0 12.5 16 H19.5 A3.5 3.5 0 0 1 19.5 23 H16"
        stroke="currentColor"
        strokeWidth="3.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Simpul sengaja diberi jarak 0,8 unit dari ujung jalur. Kalau menempel,
          pada ukuran 16 piksel keduanya menyatu menjadi gumpalan. */}
      <circle cx="22.3" cy="9" r="2.7" stroke="currentColor" strokeWidth="2.2" />
      <circle cx="9.7" cy="23" r="2.7" stroke="currentColor" strokeWidth="2.2" />
    </svg>
  );
}
