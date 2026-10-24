"use client";

import { ClassDirectory } from "@/features/classes/components/ClassDirectory";
import { TeacherClassCard } from "@/features/classes/components/TeacherClassCard";
import type { ClassSummary, TeacherAssignmentRow } from "@/lib/types";

const searchText = (item: ClassSummary) => `${item.name} ${item.subject} ${item.program_studi}`;

export function TeacherClassDirectory({
  classes,
  assignments,
}: {
  classes: ClassSummary[];
  assignments: TeacherAssignmentRow[];
}) {
  return (
    <ClassDirectory
      items={classes}
      searchText={searchText}
      renderCard={(item) => <TeacherClassCard studentClass={item} assignments={assignments} />}
      placeholder="Cari kelas atau mata kuliah"
      emptyCaption="Coba kata kunci lain."
    />
  );
}
