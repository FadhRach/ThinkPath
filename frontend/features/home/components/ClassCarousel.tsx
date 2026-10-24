import { StudentClassCard } from "@/features/classes/components/StudentClassCard";
import type { StudentClassWithAssignments } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * Kartu kelas berjajar ke samping. Dua kartu pas selebar baris; lebih dari dua, kartu ketiga
 * mengintip supaya jelas bahwa daftarnya bisa digeser.
 */
export function ClassCarousel({ classes }: { classes: StudentClassWithAssignments[] }) {
  const scrolls = classes.length > 2;
  return (
    <ul
      className={cn(
        "-mx-1 flex snap-x snap-mandatory gap-4 overflow-x-auto px-1",
        scrolls && "pb-3",
      )}
      aria-label="Kelas yang kamu ikuti"
    >
      {classes.map((classroom) => (
        <li
          key={classroom.id}
          className={cn(
            "min-w-0 shrink-0 snap-start basis-[85%]",
            scrolls ? "md:basis-[44%]" : "md:basis-[calc(50%-0.5rem)]",
          )}
        >
          <StudentClassCard studentClass={classroom} />
        </li>
      ))}
    </ul>
  );
}
