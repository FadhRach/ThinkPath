import { GraduationCap } from "lucide-react";

import { AvatarInitials } from "@/components/shared/AvatarInitials";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import type { ClassPeople } from "@/lib/types";

/** Dosen pengampu dan teman sekelas; hanya nama tampil, tanpa kontak atau data lain. */
export function ClassPeopleList({ people }: { people: ClassPeople }) {
  return (
    <div className="space-y-5">
      <section aria-labelledby="people-teacher">
        <h2 id="people-teacher" className="mb-2 text-heading font-semibold">
          Dosen
        </h2>
        <Card className="flex items-center gap-3 p-4">
          {people.teacher ? (
            <>
              <AvatarInitials name={people.teacher.display_name} />
              <p className="min-w-0 flex-1 truncate font-medium">{people.teacher.display_name}</p>
              <GraduationCap className="h-4 w-4 text-brand-ink" aria-hidden="true" />
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              Akun dosen kelas ini sudah dihapus. Kelas menjadi arsip yang bisa dibaca.
            </p>
          )}
        </Card>
      </section>

      <section aria-labelledby="people-students">
        <h2 id="people-students" className="mb-2 text-heading font-semibold">
          Teman sekelas{" "}
          <span className="text-sm font-semibold tabular-nums text-muted-foreground">
            {people.students.length}
          </span>
        </h2>
        <Card className="divide-y divide-border/70 overflow-hidden">
          {people.students.map((student) => (
            <div key={student.id} className="flex items-center gap-3 px-4 py-3">
              <AvatarInitials name={student.display_name} size="sm" />
              <p className="min-w-0 flex-1 truncate text-sm font-medium">{student.display_name}</p>
              {student.is_me ? (
                <Badge tone="brand" size="sm">
                  Kamu
                </Badge>
              ) : null}
            </div>
          ))}
        </Card>
      </section>
    </div>
  );
}
