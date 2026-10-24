import Link from "next/link";

interface SectionHeadingProps {
  title: string;
  /** id judul, untuk aria-labelledby pada <section> pembungkusnya. */
  id?: string;
  /** Tautan "lihat semua" di kanan judul. */
  href?: string;
  linkLabel?: string;
}

/** Judul bagian di dalam halaman, dengan tautan opsional di ujung kanan. */
export function SectionHeading({ id, title, href, linkLabel }: SectionHeadingProps) {
  return (
    <div className="mb-4 flex items-center justify-between gap-3">
      <h2 id={id} className="text-heading font-semibold">
        {title}
      </h2>
      {href ? (
        <Link
          href={href}
          className="shrink-0 text-sm font-medium text-brand-ink underline-offset-4 hover:underline"
        >
          {linkLabel} <span aria-hidden="true">→</span>
        </Link>
      ) : null}
    </div>
  );
}
