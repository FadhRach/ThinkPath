import { ChevronRight, FolderOpen } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { EmptyState } from "@/components/dashboard/EmptyState";
import { ClassMaterialBrowser } from "@/components/materials/ClassMaterialBrowser";
import { academicLabel, distinctSubject } from "@/lib/academic";
import { getStudentClasses, getStudentMaterials } from "@/lib/data";
import { classAccent, groupByTopic } from "@/lib/materials";
import { cn } from "@/lib/utils";

export default async function StudentClassMaterialsPage({
  params,
}: {
  params: { classId: string };
}) {
  const [classes, materials] = await Promise.all([
    getStudentClasses(),
    getStudentMaterials(),
  ]);
  // Hanya kelas yang diikuti; kelas lain tampil sebagai halaman tidak ditemukan.
  const current = classes.find((cls) => cls.id === params.classId);
  if (!current) {
    notFound();
  }
  const own = materials.filter((material) => material.class_id === current.id);
  const topicCount = groupByTopic(own).length;

  return (
    <div className="space-y-6">
      <nav
        aria-label="Lokasi halaman"
        className="flex min-w-0 items-center gap-1 text-body-sm text-muted-foreground"
      >
        <Link href="/student/materi" className="shrink-0 transition hover:text-foreground">
          Materi
        </Link>
        <ChevronRight aria-hidden="true" className="h-4 w-4 shrink-0" />
        <span aria-current="page" className="truncate font-medium text-foreground">
          {current.name}
        </span>
      </nav>

      <header className="flex items-start gap-4">
        <span
          aria-hidden="true"
          className={cn(
            "grid h-14 w-14 shrink-0 place-items-center rounded-2xl",
            classAccent(current.id),
          )}
        >
          <FolderOpen className="h-7 w-7" />
        </span>
        <div className="min-w-0 space-y-1">
          <h1 className="text-display-2 font-extrabold tracking-tight text-foreground">
            {current.name}
          </h1>
          <p className="text-body text-muted-foreground">
            {[
              distinctSubject(current.name, current.subject),
              academicLabel(current),
              current.teacher_name,
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
          {own.length > 0 ? (
            <p className="text-body-sm font-medium text-primary">
              {own.length} materi dalam {topicCount} topik
            </p>
          ) : null}
        </div>
      </header>

      {own.length === 0 ? (
        <EmptyState
          title="Belum ada materi di kelas ini"
          caption="Begitu dosen membagikan slide, bacaan, atau video, materinya tersusun di sini per pertemuan dan lonceng notifikasimu berbunyi."
        />
      ) : (
        <ClassMaterialBrowser materials={own} now={Date.now()} />
      )}
    </div>
  );
}
