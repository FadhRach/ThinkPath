import type { Metadata } from "next";

import "@/features/landing/landing.css";
import { Features } from "@/features/landing/Features";
import { Hero } from "@/features/landing/Hero";
import { HowItWorks } from "@/features/landing/HowItWorks";
import { LandingFooter } from "@/features/landing/LandingFooter";
import { LandingNav } from "@/features/landing/LandingNav";
import { Pricing } from "@/features/landing/Pricing";
import { ProblemSolution } from "@/features/landing/ProblemSolution";
import { TechStack } from "@/features/landing/TechStack";
import { getCopy, parseLang, parseTheme, type LandingQuery } from "@/features/landing/copy";

type Props = { searchParams: Promise<LandingQuery> };

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const { meta } = getCopy(parseLang(await searchParams));
  return { title: meta.title, description: meta.description };
}

// Bahasa dan tema dibaca dari URL (?lang=en, ?tema=gelap|terang); tanpa parameter:
// Indonesia dan tema mengikuti sistem. Gaya landing berdiri sendiri di landing.css.
export default async function HomePage({ searchParams }: Props) {
  const query = await searchParams;
  const lang = parseLang(query);
  const theme = parseTheme(query);
  const copy = getCopy(lang);
  const footerLinks = [1, 2, 4].map((index) => copy.nav.links[index]);

  return (
    <main lang={lang} data-theme={theme ?? undefined} className="lp">
      <LandingNav copy={copy.nav} lang={lang} theme={theme} />
      <Hero copy={copy.hero} sheet={copy.sheet} />
      <ProblemSolution copy={copy.problem} />
      <Features copy={copy.features} />
      <HowItWorks copy={copy.how} />
      <TechStack copy={copy.proof} />
      <Pricing copy={copy.pricing} />
      <LandingFooter
        copy={copy.footer}
        links={footerLinks}
        subject={copy.pricing.waitlistSubject}
        lang={lang}
        theme={theme}
      />
    </main>
  );
}
