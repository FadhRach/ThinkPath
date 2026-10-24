import { notFound } from "next/navigation";

import { Breadcrumb } from "@/components/shared/Breadcrumb";
import { ArchivedClassNotice } from "@/features/classes/components/ArchivedClassNotice";
import { StudentClassHeader } from "@/features/classes/components/StudentClassHeader";
import { StudentClassTabs } from "@/features/classes/components/StudentClassTabs";
import { summarizeStudentClass } from "@/features/classes/lib/student-class";
import { getClassAnnouncements, getStudentClasses, getStudentMaterials } from "@/lib/data";

export default async function StudentClassDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ classId: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const [{ classId }, query] = await Promise.all([params, searchParams]);
  const [classes, materials] = await Promise.all([getStudentClasses(), getStudentMaterials()]);
  const current = classes.find((studentClass) => studentClass.id === classId);
  if (!current) notFound();
  const announcements = await getClassAnnouncements(classId);
  const summary = summarizeStudentClass(current, materials);

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
        materialCount={summary.ownMaterials.length}
        openCount={summary.openCount}
      />
      <StudentClassTabs
        current={current}
        assignments={summary.assignments}
        assignmentRefs={summary.assignmentRefs}
        materials={summary.ownMaterials}
        announcements={announcements}
        openCount={summary.openCount}
        requestedTab={query.tab}
      />
    </div>
  );
}
