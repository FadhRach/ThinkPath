import Link from "next/link";

import { BrandGlyph } from "@/components/layout/BrandGlyph";

// Hanya glyph merek yang dibagi dengan aplikasi (satu sumber bentuk logo); sisanya milik landing.
export function LandingLogo({ href }: { href: string }) {
  return (
    <Link href={href} className="lp-logo" aria-label="ThinkPath">
      <span className="lp-logo-mark">
        <BrandGlyph />
      </span>
      <span className="lp-logo-text">ThinkPath</span>
    </Link>
  );
}
