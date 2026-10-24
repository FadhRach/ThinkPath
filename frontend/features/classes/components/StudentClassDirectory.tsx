"use client";

import { teacherLabel } from "@/features/classes/components/ArchivedClassNotice";
import { ClassDirectory } from "@/features/classes/components/ClassDirectory";
import { StudentClassCard } from "@/features/classes/components/StudentClassCard";
import type { StudentClassWithAssignments } from "@/lib/types";

const searchText = (item: StudentClassWithAssignments) =>
  [item.name, item.subject, teacherLabel(item.teacher_name)].join(" ");

export function StudentClassDirectory({ classes }: { classes: StudentClassWithAssignments[] }) {
  return (
    <ClassDirectory
      items={classes}
      searchText={searchText}
      renderCard={(item) => <StudentClassCard studentClass={item} />}
      placeholder="Cari nama kelas atau dosen"
      emptyCaption="Coba kata kunci lain, atau gabung kelas menggunakan kode dari dosen di Beranda."
    />
  );
}
