"use client";

import Link from "next/link";

import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { StudentClassWithAssignments } from "@/lib/types";

interface Props {
  classes: StudentClassWithAssignments[];
}

export function StudentGradeRecap({ classes }: Props) {
  const recaps = classes.map((classroom) => ({
    ...classroom,
    gradedAssignments: classroom.assignments.filter(
      ({ submission }) =>
        submission?.status === "reviewed" && typeof submission.grade === "number",
    ),
  }));
  const initialClass = recaps.find((classroom) => classroom.gradedAssignments.length > 0) ?? recaps[0];

  if (!initialClass) return null;

  return (
    <Card className="min-w-0 space-y-4 p-5 shadow-soft">
      <div>
        <h2 className="font-bold text-foreground">Nilai tugas</h2>
        <p className="mt-1 text-body-sm text-muted-foreground">
          Nilai dari dosen untuk tugas yang sudah diperiksa.
        </p>
      </div>

      <Tabs defaultValue={initialClass.id}>
        <div className="-mx-1 overflow-x-auto p-1">
          <TabsList aria-label="Kelas untuk rekap nilai" className="h-auto w-max justify-start gap-1">
            {recaps.map((classroom) => (
              <TabsTrigger key={classroom.id} value={classroom.id} className="max-w-64 py-2">
                <span className="truncate" title={classroom.name}>{classroom.name}</span>
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        {recaps.map((classroom) => (
          <TabsContent key={classroom.id} value={classroom.id} className="mt-4">
            {classroom.gradedAssignments.length === 0 ? (
              <p className="rounded-xl bg-muted/40 px-4 py-5 text-body-sm text-muted-foreground">
                Belum ada tugas yang dinilai di kelas ini.
              </p>
            ) : (
              <table className="w-full table-fixed text-left text-body-sm">
                <caption className="sr-only">Nilai tugas di kelas {classroom.name}</caption>
                <thead>
                  <tr className="border-b border-border text-caption text-muted-foreground">
                    <th scope="col" className="pb-2 pr-4 font-medium">Tugas</th>
                    <th scope="col" className="w-24 pb-2 text-right font-medium">Nilai</th>
                  </tr>
                </thead>
                <tbody>
                  {classroom.gradedAssignments.map((assignment) => (
                    <tr key={assignment.id} className="border-b border-border last:border-0">
                      <th scope="row" className="break-words py-3 pr-4 font-medium">
                        <Link href={`/student/submit/${assignment.id}`} className="text-foreground hover:text-primary hover:underline">
                          {assignment.title}
                        </Link>
                      </th>
                      <td className="py-3 text-right tabular-nums">
                        <span className="font-bold text-foreground">{assignment.submission!.grade}</span>
                        <span className="text-muted-foreground"> / 100</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </TabsContent>
        ))}
      </Tabs>
    </Card>
  );
}
