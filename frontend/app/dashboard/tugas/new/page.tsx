import { ArrowRight, BookOpen } from "lucide-react";
import Link from "next/link";

import { Breadcrumb } from "@/components/shared/Breadcrumb";
import { EmptyState } from "@/components/shared/EmptyState";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { academicLabel } from "@/features/classes/lib/academic";
import { getClasses } from "@/lib/data";

export default async function ChooseAssignmentClassPage() {
  const classes = await getClasses();

  return (
    <div className="space-y-5">
      <Breadcrumb items={[{ label: "Tugas", href: "/dashboard/tugas" }, { label: "Buat tugas" }]} />
      <header>
        <h1 className="text-title font-bold text-foreground">Buat tugas</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Pilih kelas tujuan untuk tugas baru Anda.
        </p>
      </header>
      {classes.length ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {classes.map((item) => (
            <Link
              key={item.id}
              href={`/dashboard/classes/${item.id}/assignments/new`}
              className="group focus-visible:outline-none"
            >
              <Card className="h-full p-5 transition-colors group-hover:bg-accent/40 group-focus-visible:ring-2 group-focus-visible:ring-ring">
                <BookOpen className="h-6 w-6 text-brand-ink" aria-hidden="true" />
                <h2 className="mt-3 text-heading font-semibold">{item.name}</h2>
                <p className="mt-1 text-xs text-muted-foreground">{academicLabel(item)}</p>
                <p className="mt-4 flex items-center gap-1.5 text-sm font-semibold text-brand-ink">
                  Pilih kelas
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </p>
              </Card>
            </Link>
          ))}
        </div>
      ) : (
        <EmptyState
          title="Buat kelas terlebih dahulu"
          caption="Tugas akan dibagikan kepada mahasiswa dalam kelas yang Anda pilih."
          action={
            <Button asChild>
              <Link href="/dashboard/classes/new">Buat kelas</Link>
            </Button>
          }
        />
      )}
    </div>
  );
}
