export function initials(name: string | null | undefined): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/).filter(Boolean);
  // Nama bernomor ("Mahasiswa 05") dulu menghasilkan "M0" untuk semua orang,
  // sehingga seluruh avatar di tabel kelas tampak sama. Nomornya jauh lebih
  // membedakan daripada huruf depan kata yang sama.
  const last = parts[parts.length - 1] ?? "";
  if (parts.length > 1 && /^\d+$/.test(last)) return last.slice(-2);
  return (
    parts
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase() ?? "")
      .join("") || "?"
  );
}

// Avatar diberi warna deterministik dari nama agar stabil antar render.
const AVATAR_PALETTE = [
  "bg-brand-pink text-danger",
  "bg-secondary text-secondary-foreground",
  "bg-accent text-accent-foreground",
  "bg-warning-soft text-warning",
];

export function avatarColorClass(name: string | null | undefined): string {
  if (!name) return AVATAR_PALETTE[0];
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) {
    hash = (hash + name.charCodeAt(i)) % AVATAR_PALETTE.length;
  }
  return AVATAR_PALETTE[hash];
}
