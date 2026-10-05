import { notFound } from "next/navigation";
import { BackLink } from "@/components/common/BackLink";
import { PageHeader } from "@/components/common/PageHeader";
import { CreateAssignmentForm } from "@/components/dashboard/CreateAssignmentForm";
import { Card } from "@/components/ui/card";
import { ApiError } from "@/lib/api";
import { getClasses, getTeacherAssignment } from "@/lib/data";

export default async function EditAssignmentPage({ params }: { params: Promise<{ classId: string; assignmentId: string }> }) {
  const { classId, assignmentId } = await params;
  const classes = await getClasses();
  const current = classes.find((item) => item.id === classId);
  if (!current) notFound();
  let assignment;
  try { assignment = await getTeacherAssignment(assignmentId); }
  catch (error) { if (error instanceof ApiError && error.status === 404) notFound(); throw error; }
  if (assignment.class_id !== classId) notFound();
  return <div className="space-y-5"><BackLink href={`/dashboard/classes/${classId}?tab=tugas&assignment=${assignmentId}`} label="Kembali ke tugas" /><PageHeader title="Edit tugas" subtitle={`Perbarui tugas untuk ${current.name}.`} /><Card className="campus-card max-w-3xl p-5 sm:p-7"><CreateAssignmentForm classId={classId} assignment={assignment} /></Card></div>;
}
