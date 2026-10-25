import { Check, X } from "lucide-react";

import type { Copy } from "./types";

export function ProblemSolution({ copy }: { copy: Copy["problem"] }) {
  return (
    <section id="masalah" className="lp-section lp-section--alt">
      <div className="lp-wrap">
        <div className="lp-head">
          <h2 className="lp-h2">{copy.title}</h2>
          <p className="lp-lead">{copy.lead}</p>
        </div>

        <div className="lp-scroll" role="region" aria-label={copy.title} tabIndex={0}>
          <div className="lp-compare">
            <div className="lp-compare-head" aria-hidden="true">
              <div className="lp-cell lp-cell--aspect" />
              <div className="lp-cell lp-cell--before">{copy.beforeHeading}</div>
              <div className="lp-cell lp-cell--after">{copy.afterHeading}</div>
            </div>
            {copy.rows.map((row) => (
              <div key={row.aspect} className="lp-compare-row">
                <div className="lp-cell lp-cell--aspect">{row.aspect}</div>
                <div className="lp-cell lp-cell--before">
                  <X aria-hidden="true" />
                  <span>{row.before}</span>
                </div>
                <div className="lp-cell lp-cell--after">
                  <Check aria-hidden="true" />
                  <span>{row.after}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <p className="lp-punch">{copy.punchline}</p>
      </div>
    </section>
  );
}
