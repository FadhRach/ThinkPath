import { Btn } from "./Btn";
import { ProcessSheet } from "./ProcessSheet";
import type { Copy } from "./types";

export function Hero({ copy, sheet }: { copy: Copy["hero"]; sheet: Copy["sheet"] }) {
  return (
    <section id="beranda" className="lp-hero">
      <div aria-hidden="true" className="lp-hero-lines" />
      <div className="lp-wrap lp-hero-grid">
        <div>
          <h1>{copy.title}</h1>
          <p className="lp-lead">{copy.lead}</p>
          <div className="lp-actions">
            <Btn href="/register">{copy.primary}</Btn>
            <Btn href="#cara-kerja" variant="outline">
              {copy.secondary}
            </Btn>
          </div>
          <p className="lp-tagline">{copy.tagline}</p>
        </div>
        <ProcessSheet copy={sheet} />
      </div>
    </section>
  );
}
