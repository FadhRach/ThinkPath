import { EyeOff, MapPin, Trash2, type LucideIcon } from "lucide-react";

import type { Copy } from "./types";

const PRINCIPLE_ICONS: LucideIcon[] = [MapPin, EyeOff, Trash2];

function StackList({ stack, hidden }: { stack: Copy["proof"]["stack"]; hidden?: boolean }) {
  return (
    <ul aria-hidden={hidden || undefined}>
      {stack.map((item) => (
        <li key={item.name} className="lp-tech">
          <strong>{item.name}</strong>
          <span>{item.role}</span>
        </li>
      ))}
    </ul>
  );
}

export function TechStack({ copy }: { copy: Copy["proof"] }) {
  return (
    <section id="teknologi" className="lp-section">
      <div className="lp-wrap">
        <div className="lp-head">
          <h2 className="lp-h2">{copy.title}</h2>
          <p className="lp-lead">{copy.lead}</p>
        </div>

        {/* Berjalan dari kiri ke kanan; daftar kedua hanya untuk menyambung putaran dan disembunyikan dari pembaca layar. */}
        <div className="lp-marquee">
          <div className="lp-marquee-track">
            <StackList stack={copy.stack} />
            <StackList stack={copy.stack} hidden />
          </div>
        </div>

        <p className="lp-tech-note">{copy.stackNote}</p>
        <div className="lp-principles">
          {copy.principles.map((item, index) => {
            const Icon = PRINCIPLE_ICONS[index];
            return (
              <article key={item.title} className="lp-principle">
                <span className="lp-principle-icon">
                  <Icon aria-hidden="true" />
                </span>
                <h3>{item.title}</h3>
                <p>{item.body}</p>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
