import { notFound } from "next/navigation";

import { BackLink } from "@/components/shared/BackLink";
import { TeacherAssignmentDetail } from "@/features/assignments/components/TeacherAssignmentDetail";
import { TeacherAssignmentList } from "@/features/assignments/components/TeacherAssignmentList";
import { AnnouncementForm } from "@/features/classes/components/AnnouncementForm";
import { AnnouncementList } from "@/features/classes/components/AnnouncementList";
import { ClassRoster } from "@/features/classes/components/ClassRoster";
import {
  ClassSectionTabs,
  type ClassSection,
} from "@/features/classes/components/ClassSectionTabs";
import { TeacherClassHeader } from "@/features/classes/components/TeacherClassHeader";
import { TeacherMaterialsSection } from "@/features/materials/components/TeacherMaterialsSection";
import {
  getAssignments,
  getClassAnnouncements,
  getClassMaterials,
  getClassRoster,
  getClasses,
  getSubmissions,
} from "@/lib/data";

const SECTIONS: ClassSection[] = ["mahasiswa", "materi", "pengumuman", "tugas"];

export default async function ClassDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ classId: string }>;
  searchParams: Promise<{ assignment?: string; tab?: string; filter?: string }>;
}) {
  const [{ classId }, query] = await Promise.all([params, searchParams]);
  const classes = await getClasses();
  const current = classes.find((item) => item.id === classId);
  if (!current) notFound();

  const [assignments, materials, roster, announcements] = await Promise.all([
    getAssignments(classId),
    getClassMaterials(classId),
    getClassRoster(classId),
    getClassAnnouncements(classId),
  ]);
  // Tab dari URL; tanpa ?tab=, membuka tugas tertentu berarti tab Tugas.
  const section: ClassSection =
    SECTIONS.find((id) => id === query.tab) ?? (query.assignment ? "tugas" : "mahasiswa");
  const selected =
    section === "tugas" ? assignments.find((item) => item.id === query.assignment) : undefined;
  const submissions = selected ? await getSubmissions(selected.id) : [];

  return (
    <div className="space-y-5">
      <BackLink href="/dashboard/classes" label="Kembali ke kelas" />
      <TeacherClassHeader klass={current} />
      <ClassSectionTabs
        classId={classId}
        active={section}
        counts={{
          mahasiswa: roster.length,
          materi: materials.length,
          pengumuman: announcements.length,
          tugas: assignments.length,
        }}
      />

      {section === "mahasiswa" ? <ClassRoster students={roster} /> : null}
      {section === "materi" ? (
        <TeacherMaterialsSection classId={classId} materials={materials} />
      ) : null}
      {section === "pengumuman" ? (
        <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,.85fr)_minmax(0,1.15fr)]">
          <AnnouncementForm classId={classId} />
          <div>
            <h2 className="mb-3 text-heading font-semibold">Pengumuman kelas</h2>
            <AnnouncementList announcements={announcements} />
          </div>
        </div>
      ) : null}
      {section === "tugas" && !selected ? (
        <TeacherAssignmentList
          assignments={assignments.map((item) => ({
            ...item,
            class_name: current.name,
            subject: current.subject,
          }))}
          showClass={false}
        />
      ) : null}
      {selected ? (
        <TeacherAssignmentDetail
          classId={classId}
          assignment={selected}
          submissions={submissions}
          filter={query.filter}
        />
      ) : null}
    </div>
  );
}
