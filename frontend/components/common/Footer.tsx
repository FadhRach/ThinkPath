import { Brandmark } from "@/components/common/Brandmark";

const LINKS = ["Panduan", "Bantuan", "Kebijakan Privasi", "Hubungi Sekolah"];

export function Footer() {
  return (
    <footer className="mt-auto border-t border-border bg-card">
      <div className="mx-auto flex max-w-[1280px] flex-col gap-4 px-4 py-6 text-sm text-muted-foreground sm:px-6 lg:flex-row lg:items-center">
        <div className="flex items-center gap-3">
          <Brandmark wordmarkClassName="text-base" />
          <span className="hidden text-muted-foreground sm:inline">
            Lihat proses berpikirnya, bukan hanya nilainya
          </span>
        </div>
        <nav className="flex flex-wrap gap-x-6 gap-y-2 lg:ml-auto">
          {LINKS.map((link) => (
            <span key={link} className="cursor-default transition hover:text-foreground">
              {link}
            </span>
          ))}
        </nav>
        <span className="text-xs text-muted-foreground/70">
          &copy; 2026 Tim DataDigger
        </span>
      </div>
    </footer>
  );
}
