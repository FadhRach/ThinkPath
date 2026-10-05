import Link from "next/link";

export function Footer() {
  return (
    <footer className="mt-auto border-t border-border bg-card">
      <div className="mx-auto flex max-w-[1440px] flex-wrap items-center justify-between gap-x-6 gap-y-3 px-5 py-5 text-xs text-muted-foreground sm:px-8 lg:px-10">
        <span>ThinkPath · © 2026 Tim DataDigger</span>
        <Link href="/kebijakan-privasi" className="text-accent-foreground underline-offset-4 hover:underline">Kebijakan Privasi</Link>
      </div>
    </footer>
  );
}
