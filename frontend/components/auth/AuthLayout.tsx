import { AuthHero } from "@/components/auth/AuthHero";

interface Props {
  title: string;
  caption: string;
  children: React.ReactNode;
  footer: React.ReactNode;
}

// Kerangka dua kolom: hero teal di kiri, konten form di kanan.
export function AuthLayout({ title, caption, children, footer }: Props) {
  return (
    <main className="grid min-h-screen bg-background lg:grid-cols-2">
      <AuthHero />
      <div className="flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-md space-y-6">
          <header className="space-y-1.5">
            <h1 className="text-display-2 font-extrabold tracking-tight text-foreground">
              {title}
            </h1>
            <p className="text-body text-muted-foreground">{caption}</p>
          </header>
          {children}
          <p className="text-center text-body-sm text-muted-foreground">{footer}</p>
        </div>
      </div>
    </main>
  );
}
