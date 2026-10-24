import { BLOOM_LEVELS, bloomShortLabel } from "@/features/bloom/lib/bloom";

/** Daftar L1-L6 beserta nama level berpikirnya, untuk keterangan grafik. */
export function BloomLevelGuide() {
  return (
    <ul className="mt-2 grid grid-cols-2 gap-x-4 gap-y-0.5">
      {BLOOM_LEVELS.map((level) => (
        <li key={level}>
          <span className="font-semibold">L{level}</span> {bloomShortLabel(level)}
        </li>
      ))}
    </ul>
  );
}
