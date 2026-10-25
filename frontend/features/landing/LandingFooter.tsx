import Link from "next/link";

import { LandingLogo } from "./LandingLogo";
import { landingHref, mailtoHref } from "./copy";
import type { Copy, Lang, Theme } from "./types";

export function LandingFooter({
  copy,
  links,
  subject,
  lang,
  theme,
}: {
  copy: Copy["footer"];
  links: Copy["nav"]["links"];
  subject: string;
  lang: Lang;
  theme: Theme | null;
}) {
  const contact = mailtoHref(subject);
  return (
    <footer className="lp-footer">
      <div className="lp-wrap">
        <div className="lp-footer-grid">
          <div className="lp-footer-brand">
            <LandingLogo href={landingHref(lang, theme)} />
            <p>{copy.tagline}</p>
          </div>
          <div>
            <h2>{copy.productHeading}</h2>
            <ul>
              {links.map((link) => (
                <li key={link.href}>
                  <a href={link.href}>{link.label}</a>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h2>{copy.infoHeading}</h2>
            <ul>
              <li>
                <Link href="/kebijakan-privasi">{copy.privacy}</Link>
              </li>
              <li>
                <Link href="/login">{copy.login}</Link>
              </li>
              <li>
                <Link href="/register">{copy.register}</Link>
              </li>
            </ul>
          </div>
          {contact ? (
            <div>
              <h2>{copy.contactHeading}</h2>
              <ul>
                <li>
                  <a href={contact}>{copy.contact}</a>
                </li>
              </ul>
            </div>
          ) : null}
        </div>
      </div>
      <div className="lp-footer-bottom">
        <div className="lp-wrap">{copy.rights}</div>
      </div>
    </footer>
  );
}
