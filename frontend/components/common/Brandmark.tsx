import { cn } from "@/lib/utils";

interface Props {
  className?: string;
  showWordmark?: boolean;
  wordmarkClassName?: string;
}

// Logo tile: kotak gradien teal dengan glyph "path" tiga simpul terhubung.
export function Brandmark({
  className,
  showWordmark = true,
  wordmarkClassName,
}: Props) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <span
        className={cn(
          "grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-brand-teal-light to-brand-teal shadow-soft",
          className,
        )}
      >
        <svg
          width="20"
          height="20"
          viewBox="0 0 20 20"
          fill="none"
          aria-hidden="true"
        >
          <circle cx="5" cy="5" r="2.1" fill="white" />
          <circle cx="15" cy="10" r="2.1" fill="white" />
          <circle cx="5" cy="15" r="2.1" fill="white" />
          <path
            d="M5 5 Q13 5 13 10 Q13 15 5 15"
            stroke="white"
            strokeWidth="1.6"
            strokeLinecap="round"
            fill="none"
            opacity="0.85"
          />
        </svg>
      </span>
      {showWordmark ? (
        <span
          className={cn(
            "text-lg font-extrabold tracking-tight text-foreground",
            wordmarkClassName,
          )}
        >
          ThinkPath
        </span>
      ) : null}
    </span>
  );
}
