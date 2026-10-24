import {
  BookOpen,
  ClipboardList,
  GraduationCap,
  LibraryBig,
  MessageSquareText,
} from "lucide-react";

import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AnnouncementList } from "@/features/classes/components/AnnouncementList";
import { teacherLabel } from "@/features/classes/components/ArchivedClassNotice";
import { NextAssignmentCard } from "@/features/classes/components/NextAssignmentCard";
import { StudentClassAssignments } from "@/features/classes/components/StudentClassAssignments";
import { StudentClassMaterials } from "@/features/classes/components/StudentClassMaterials";
import { StudentUpdates } from "@/features/notifications/components/StudentUpdates";
import type { Announcement, Material, StudentClassWithAssignments } from "@/lib/types";

type TabId = "ringkasan" | "materi" | "tugas" | "pengumuman";
const TAB_IDS: TabId[] = ["ringkasan", "materi", "tugas", "pengumuman"];

interface StudentClassTabsProps {
  current: StudentClassWithAssignments;
  assignments: StudentClassWithAssignments["assignments"];
  assignmentRefs: { id: string; title: string }[];
  materials: Material[];
  announcements: Announcement[];
  openCount: number;
  /** Tab dari ?tab= di URL; nilai tak dikenal jatuh ke "ringkasan". */
  requestedTab?: string;
}

function InfoTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-background px-3.5 py-3">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="mt-0.5 truncate text-sm font-bold text-foreground">{value}</p>
    </div>
  );
}

/** Isi halaman kelas mahasiswa: ringkasan, materi, tugas, dan pengumuman dalam satu set tab. */
export function StudentClassTabs({
  current,
  assignments,
  assignmentRefs,
  materials,
  announcements,
  openCount,
  requestedTab,
}: StudentClassTabsProps) {
  const active = TAB_IDS.find((id) => id === requestedTab) ?? "ringkasan";

  return (
    <Tabs key={active} defaultValue={active} className="space-y-4">
      <TabsList aria-label="Bagian kelas">
        <TabsTrigger value="ringkasan">
          <BookOpen className="h-4 w-4" aria-hidden="true" />
          Ringkasan
        </TabsTrigger>
        <TabsTrigger value="materi">
          <LibraryBig className="h-4 w-4" aria-hidden="true" />
          Materi
        </TabsTrigger>
        <TabsTrigger value="tugas">
          <ClipboardList className="h-4 w-4" aria-hidden="true" />
          Tugas
        </TabsTrigger>
        <TabsTrigger value="pengumuman">
          <MessageSquareText className="h-4 w-4" aria-hidden="true" />
          Pengumuman
        </TabsTrigger>
      </TabsList>

      <TabsContent value="ringkasan" className="mt-0 space-y-4">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(17rem,.8fr)]">
          <Card className="p-5 sm:p-6">
            <h2 className="text-heading font-semibold text-foreground">Ringkasan kelas</h2>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
              Pilih tab Materi, Tugas, atau Pengumuman untuk melihat isi kelas.
            </p>
            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              <InfoTile label="Pengajar" value={teacherLabel(current.teacher_name)} />
              <InfoTile label="Materi tersedia" value={`${materials.length} materi`} />
              <InfoTile label="Tugas aktif" value={`${openCount} tugas`} />
            </div>
          </Card>
          <NextAssignmentCard assignments={assignments} />
        </div>
        <StudentUpdates
          classId={current.id}
          assignmentRefs={assignmentRefs}
          title="Kabar terbaru di kelas ini"
          compact
        />
      </TabsContent>

      <TabsContent value="materi" className="mt-0">
        <StudentClassMaterials materials={materials} />
      </TabsContent>
      <TabsContent value="tugas" className="mt-0">
        <StudentClassAssignments assignments={assignments} />
      </TabsContent>
      <TabsContent value="pengumuman" className="mt-0">
        <AnnouncementList announcements={announcements} />
      </TabsContent>
    </Tabs>
  );
}
