import { Btn } from "./Btn";
import { LandingLogo } from "./LandingLogo";
import { LanguageSwitch } from "./LanguageSwitch";
import { ThemeToggle } from "./ThemeToggle";
import { landingHref } from "./copy";
import type { Copy, Lang, Theme } from "./types";

export function LandingNav({
  copy,
  lang,
  theme,
}: {
  copy: Copy["nav"];
  lang: Lang;
  theme: Theme | null;
}) {
  return (
    <header className="lp-nav">
      <div className="lp-wrap lp-nav-bar">
        <LandingLogo href={landingHref(lang, theme)} />

        <nav aria-label="ThinkPath" className="lp-nav-links">
          {copy.links.map((link) => (
            <a key={link.href} href={link.href} className="lp-link">
              {link.label}
            </a>
          ))}
        </nav>

        <div className="lp-nav-tools">
          <LanguageSwitch lang={lang} theme={theme} label={copy.languageLabel} />
          <ThemeToggle lang={lang} toLight={copy.toLight} toDark={copy.toDark} />
          <span className="lp-hide-xs">
            <Btn href="/login" variant="ghost" small>
              {copy.login}
            </Btn>
          </span>
          <Btn href="/register" small>
            {copy.register}
          </Btn>
        </div>
      </div>

      {/* Layar sempit: tautan section digulir menyamping di baris ini, tanpa menu buka-tutup. */}
      <nav aria-label="ThinkPath" className="lp-nav-scroll">
        {copy.links.map((link) => (
          <a key={link.href} href={link.href} className="lp-link">
            {link.label}
          </a>
        ))}
      </nav>
    </header>
  );
}
