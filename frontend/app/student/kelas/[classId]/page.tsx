import { notFound } from "next/navigation";

import { Breadcrumb } from "@/components/shared/Breadcrumb";
import { ArchivedClassNotice } from "@/features/classes/components/ArchivedClassNotice";
import { StudentClassHeader } from "@/features/classes/components/StudentClassHeader";
import { StudentClassTabs } from "@/features/classes/components/StudentClassTabs";
import { classProgress, summarizeStudentClass } from "@/features/classes/lib/student-class";
import {
  getClassForum,
  getClassPeople,
  getOwnProgress,
  getStudentClasses,
  getStudentMaterials,
} from "@/lib/data";

export default async function StudentClassDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ classId: string }>;
  searchParams: Promise<{ tab?: string; post?: string }>;
}) {
  const [{ classId }, query] = await Promise.all([params, searchParams]);
  // Semua dimuat sekaligus (tab dirender di server, bukan per klik). Selain daftar kelas,
  // kegagalan satu sumber hanya mengosongkan tab-nya, bukan seluruh halaman; kelas yang bukan
  // milik mahasiswa tetap berujung 404 dari daftar kelas.
  const [classes, materials, forumPosts, people, progressSeries] = await Promise.all([
    getStudentClasses(),
    getStudentMaterials(),
    getClassForum(classId).catch(() => []),
    getClassPeople(classId).catch(() => ({ teacher: null, students: [] })),
    getOwnProgress().catch(() => ({ classes: [] })),
  ]);
  const current = classes.find((studentClass) => studentClass.id === classId);
  if (!current) notFound();
  const summary = summarizeStudentClass(current, materials);
  const progress = classProgress(current);

  return (
    <div className="space-y-5 sm:space-y-6">
      <Breadcrumb
        items={[
          { label: "Beranda", href: "/student" },
          { label: "Kelas", href: "/student/kelas" },
          { label: current.name },
        ]}
      />
      <ArchivedClassNotice klass={current} />
      <StudentClassHeader
        name={current.name}
        meta={summary.classMeta}
        teacherName={current.teacher_name}
        done={progress.done}
        total={progress.total}
        average={progress.average}
      />
      <StudentClassTabs
        current={current}
        assignments={summary.assignments}
        materials={summary.ownMaterials}
        forumPosts={forumPosts}
        people={people}
        growth={progressSeries.classes.find((series) => series.class_id === classId)}
        requestedTab={query.tab}
        openPostId={query.post}
      />
    </div>
  );
}
