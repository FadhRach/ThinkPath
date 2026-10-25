import { notFound } from "next/navigation";

import { Breadcrumb } from "@/components/shared/Breadcrumb";
import { CreateAssignmentForm } from "@/features/assignments/components/CreateAssignmentForm";
import { ApiError } from "@/lib/api/errors";
import { getClasses, getTeacherAssignment } from "@/lib/data";

export default async function EditAssignmentPage({
  params,
}: {
  params: Promise<{ classId: string; assignmentId: string }>;
}) {
  const { classId, assignmentId } = await params;
  const classes = await getClasses();
  const current = classes.find((item) => item.id === classId);
  if (!current) notFound();
  let assignment;
  try {
    assignment = await getTeacherAssignment(assignmentId);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) notFound();
    throw error;
  }
  if (assignment.class_id !== classId) notFound();

  return (
    <div className="space-y-5">
      <Breadcrumb
        items={[
          { label: "Kelas", href: "/dashboard/classes" },
          { label: current.name, href: `/dashboard/classes/${classId}?tab=tugas` },
          {
            label: assignment.title,
            href: `/dashboard/classes/${classId}?tab=tugas&assignment=${assignmentId}`,
          },
          { label: "Edit" },
        ]}
      />
      <header>
        <h1 className="text-title font-bold text-foreground">Edit tugas</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Perubahan judul, instruksi, dan tenggat langsung terlihat oleh mahasiswa {current.name}.
        </p>
      </header>
      <CreateAssignmentForm classId={classId} assignment={assignment} />
    </div>
  );
}
