import { BrandGlyph } from "@/components/common/BrandGlyph";
import { cn } from "@/lib/utils";

interface Props {
  className?: string;
  showWordmark?: boolean;
  wordmarkClassName?: string;
}

// Kotak membulat bernada mint dengan glyph jalur teal, sama persis dengan
// app/icon.svg dan apple-icon.png supaya logo di navigasi, tab browser, dan
// layar utama ponsel tidak pernah berbeda.
export function Brandmark({
  className,
  showWordmark = true,
  wordmarkClassName,
}: Props) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <span
        className={cn(
          "grid h-9 w-9 place-items-center rounded-xl bg-accent",
          className,
        )}
      >
        <BrandGlyph className="h-9 w-9 text-primary" />
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
