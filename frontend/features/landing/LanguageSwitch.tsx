import Link from "next/link";

import { landingHref } from "./copy";
import type { Lang, Theme } from "./types";

const LANGS: Lang[] = ["id", "en"];

// Bulatan penanda digeser CSS lewat atribut lang pada .lp, jadi pindah bahasa beranimasi halus.
export function LanguageSwitch({
  lang,
  theme,
  label,
}: {
  lang: Lang;
  theme: Theme | null;
  label: string;
}) {
  return (
    <nav aria-label={label} className="lp-switch lp-switch--lang">
      <span className="lp-thumb" aria-hidden="true" />
      {LANGS.map((code) => (
        <Link
          key={code}
          href={landingHref(code, theme)}
          replace
          scroll={false}
          lang={code}
          hrefLang={code}
          aria-current={code === lang ? "true" : undefined}
          className="lp-switch-item"
        >
          {code.toUpperCase()}
        </Link>
      ))}
    </nav>
  );
}
