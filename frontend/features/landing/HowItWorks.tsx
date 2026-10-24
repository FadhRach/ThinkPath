import {
  ArrowDown,
  ArrowRight,
  BookOpen,
  ClipboardCheck,
  Cpu,
  PenLine,
  type LucideIcon,
} from "lucide-react";

import type { Copy } from "./types";

// Ikon peran per langkah: dosen menyiapkan, mahasiswa menulis, ThinkPath menganalisis, dosen meninjau.
const ROLE_ICONS: LucideIcon[] = [BookOpen, PenLine, Cpu, ClipboardCheck];

export function HowItWorks({ copy }: { copy: Copy["how"] }) {
  return (
    <section id="cara-kerja" className="lp-section lp-section--alt">
      <div className="lp-wrap">
        <div className="lp-head">
          <h2 className="lp-h2">{copy.title}</h2>
          <p className="lp-lead">{copy.lead}</p>
        </div>
        <ol className="lp-flow">
          {copy.steps.map((step, index) => {
            const Icon = ROLE_ICONS[index];
            const last = index === copy.steps.length - 1;
            return (
              <li key={step.title} className="lp-step">
                <div className="lp-step-top">
                  <span className="lp-step-num">{index + 1}</span>
                  <span className="lp-step-role">
                    <Icon aria-hidden="true" />
                    {step.role}
                  </span>
                </div>
                <h3>{step.title}</h3>
                <p>{step.body}</p>
                {last ? null : (
                  <>
                    <span aria-hidden="true" className="lp-arrow lp-arrow--down">
                      <ArrowDown />
                    </span>
                    <span aria-hidden="true" className="lp-arrow lp-arrow--right">
                      <ArrowRight />
                    </span>
                  </>
                )}
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}
