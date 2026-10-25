import { Building2, Check, UserRound, Users, type LucideIcon } from "lucide-react";

import { Btn } from "./Btn";
import { ContactButton } from "./ContactButton";
import type { Copy, PlanState } from "./types";

const PLAN_ICONS: Record<PlanState, LucideIcon> = {
  now: UserRound,
  soon: Users,
  contact: Building2,
};
// Kekuatan detektor per paket, ditampilkan sebagai meter tiga ruas.
const DETECTOR_LEVEL: Record<PlanState, number> = { now: 1, soon: 2, contact: 3 };

export function Pricing({ copy }: { copy: Copy["pricing"] }) {
  return (
    <section id="paket" className="lp-section lp-section--alt">
      <div className="lp-wrap">
        <div className="lp-head">
          <h2 className="lp-h2">{copy.title}</h2>
          <p className="lp-lead">{copy.lead}</p>
        </div>
        <div className="lp-plans" role="region" aria-label={copy.title} tabIndex={0}>
          {copy.plans.map((plan) => {
            const Icon = PLAN_ICONS[plan.state];
            return (
              <article key={plan.name} className={`lp-plan lp-plan--${plan.state}`}>
                <div className="lp-plan-top">
                  <span className="lp-badge">{plan.badge}</span>
                  <span className="lp-plan-icon">
                    <Icon aria-hidden="true" />
                  </span>
                  <h3>{plan.name}</h3>
                  <p className="lp-plan-audience">{plan.audience}</p>
                </div>
                <div className="lp-plan-body">
                  <p className="lp-price">{plan.price}</p>
                  <p>{plan.blurb}</p>
                  <div className="lp-meter">
                    <span className="bars" aria-hidden="true">
                      {[1, 2, 3].map((n) => (
                        <i key={n} className={n <= DETECTOR_LEVEL[plan.state] ? "on" : ""} />
                      ))}
                    </span>
                    {plan.detector}
                  </div>
                  <ul className="lp-checks">
                    {plan.features.map((feature) => (
                      <li key={feature}>
                        <Check aria-hidden="true" />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                  {plan.state === "now" ? (
                    <Btn href="/register" block>
                      {plan.cta}
                    </Btn>
                  ) : (
                    <ContactButton
                      label={plan.cta}
                      subject={copy.waitlistSubject}
                      unavailable={copy.unavailable}
                      block
                    />
                  )}
                </div>
              </article>
            );
          })}
        </div>
        <p className="lp-note">{copy.note}</p>
      </div>
    </section>
  );
}
