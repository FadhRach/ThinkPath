import { classProgress } from "@/features/classes/lib/student-class";
import { teacherLabel } from "@/features/classes/components/ArchivedClassNotice";
import type { StudentClassWithAssignments } from "@/lib/types";
import { cn } from "@/lib/utils";

interface GradebookClassPickerProps {
  studentClass: StudentClassWithAssignments;
  selected: boolean;
  onSelect: () => void;
}

/** Kartu pilihan kelas di Gradebook: nama, dosen, tugas dikerjakan, dan rata-rata nilai. */
export function GradebookClassPicker({
  studentClass,
  selected,
  onSelect,
}: GradebookClassPickerProps) {
  const progress = classProgress(studentClass);
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={cn(
        "h-full w-full rounded-xl border bg-card p-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        selected
          ? "border-primary bg-secondary/40 ring-1 ring-primary"
          : "border-border hover:bg-accent/40",
      )}
    >
      <span className="block truncate text-sm font-semibold text-foreground">
        {studentClass.name}
      </span>
      <span className="block truncate text-xs text-muted-foreground">
        {teacherLabel(studentClass.teacher_name)}
      </span>
      <span className="mt-3 flex items-end justify-between gap-3">
        <span className="text-xs text-muted-foreground">
          <span className="block font-semibold tabular-nums text-foreground">
            {progress.done}/{progress.total}
          </span>
          tugas dikerjakan
        </span>
        <span className="text-right text-xs text-muted-foreground">
          <span className="block text-lg font-bold tabular-nums leading-none text-foreground">
            {progress.average ?? "–"}
          </span>
          rata-rata
        </span>
      </span>
    </button>
  );
}
