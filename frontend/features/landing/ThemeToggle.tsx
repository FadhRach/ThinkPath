import { Moon, Sun } from "lucide-react";
import Link from "next/link";

import { landingHref } from "./copy";
import type { Lang } from "./types";

// Dua tautan menutupi trek yang sama dan hanya satu tampil: yang menuju tema kebalikan dari tema aktif,
// termasuk saat tema masih mengikuti sistem (aturannya di landing.css). Ikon duduk di bawah tautan.
export function ThemeToggle({
  lang,
  toLight,
  toDark,
}: {
  lang: Lang;
  toLight: string;
  toDark: string;
}) {
  return (
    <div className="lp-switch lp-switch--theme">
      <span className="lp-thumb" aria-hidden="true" />
      <span className="lp-icon lp-icon--sun" aria-hidden="true">
        <Sun />
      </span>
      <span className="lp-icon lp-icon--moon" aria-hidden="true">
        <Moon />
      </span>
      <Link
        href={landingHref(lang, "light")}
        replace
        scroll={false}
        aria-label={toLight}
        className="lp-switch-hit lp-to-light"
      />
      <Link
        href={landingHref(lang, "dark")}
        replace
        scroll={false}
        aria-label={toDark}
        className="lp-switch-hit lp-to-dark"
      />
    </div>
  );
}
