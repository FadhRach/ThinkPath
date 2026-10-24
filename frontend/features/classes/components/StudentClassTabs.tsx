import {
  BookOpen,
  ClipboardList,
  GraduationCap,
  LibraryBig,
  MessagesSquare,
  Users,
} from "lucide-react";

import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { NextAssignmentCard } from "@/features/classes/components/NextAssignmentCard";
import { StudentClassAssignments } from "@/features/classes/components/StudentClassAssignments";
import { EmptyState } from "@/components/shared/EmptyState";
import { ClassMaterialBrowser } from "@/features/materials/components/ClassMaterialBrowser";
import { ClassPeopleList } from "@/features/classes/components/ClassPeopleList";
import { ClassGradebook } from "@/features/gradebook/components/ClassGradebook";
import { ForumFeedCard } from "@/features/home/components/ForumFeedCard";
import { ForumPanel } from "@/features/forum/components/ForumPanel";
import type {
  ClassPeople,
  CognitiveClassSeries,
  ForumPost,
  Material,
  StudentClassWithAssignments,
} from "@/lib/types";

type TabId = "ringkasan" | "forum" | "materi" | "tugas" | "gradebook" | "anggota";
const TAB_IDS: TabId[] = ["ringkasan", "forum", "materi", "tugas", "gradebook", "anggota"];

interface StudentClassTabsProps {
  current: StudentClassWithAssignments;
  assignments: StudentClassWithAssignments["assignments"];
  materials: Material[];
  forumPosts: ForumPost[];
  people: ClassPeople;
  growth: CognitiveClassSeries | undefined;
  /** Tab dari ?tab= di URL; nilai tak dikenal jatuh ke "ringkasan". */
  requestedTab?: string;
  /** Topik forum yang dibuka dari tautan notifikasi (?post=). */
  openPostId?: string;
}

/** Isi halaman kelas mahasiswa: ringkasan, forum, materi, dan tugas dalam satu set tab. */
export function StudentClassTabs({
  current,
  assignments,
  materials,
  forumPosts,
  people,
  growth,
  requestedTab,
  openPostId,
}: StudentClassTabsProps) {
  // Tautan ke topik tertentu selalu membuka forum, walau ?tab= tidak ada.
  const active = TAB_IDS.find((id) => id === requestedTab) ?? (openPostId ? "forum" : "ringkasan");

  return (
    <Tabs key={active} defaultValue={active} className="space-y-4">
      <TabsList aria-label="Bagian kelas">
        <TabsTrigger value="ringkasan">
          <BookOpen className="h-4 w-4" aria-hidden="true" />
          Ringkasan
        </TabsTrigger>
        <TabsTrigger value="forum">
          <MessagesSquare className="h-4 w-4" aria-hidden="true" />
          Forum
        </TabsTrigger>
        <TabsTrigger value="materi">
          <LibraryBig className="h-4 w-4" aria-hidden="true" />
          Materi
        </TabsTrigger>
        <TabsTrigger value="tugas">
          <ClipboardList className="h-4 w-4" aria-hidden="true" />
          Tugas
        </TabsTrigger>
        <TabsTrigger value="gradebook">
          <GraduationCap className="h-4 w-4" aria-hidden="true" />
          Gradebook
        </TabsTrigger>
        <TabsTrigger value="anggota">
          <Users className="h-4 w-4" aria-hidden="true" />
          Anggota
        </TabsTrigger>
      </TabsList>

      <TabsContent value="ringkasan" className="mt-0">
        <div className="grid gap-4 lg:grid-cols-2">
          <NextAssignmentCard assignments={assignments} />
          <ForumFeedCard
            posts={forumPosts.slice(0, 3)}
            title="Kabar terbaru kelas ini"
            href={`/student/kelas/${current.id}?tab=forum`}
          />
        </div>
      </TabsContent>

      <TabsContent value="forum" className="mt-0">
        <ForumPanel
          classId={current.id}
          posts={forumPosts}
          viewerRole="student"
          readOnly={current.is_archived}
          openPostId={openPostId}
        />
      </TabsContent>
      <TabsContent value="materi" className="mt-0">
        {materials.length ? (
          <ClassMaterialBrowser materials={materials} now={Date.now()} />
        ) : (
          <EmptyState
            title="Belum ada materi di kelas ini"
            caption="Slide, bacaan, dan video dari dosen akan tersusun di sini per pertemuan."
          />
        )}
      </TabsContent>
      <TabsContent value="tugas" className="mt-0">
        <StudentClassAssignments assignments={assignments} />
      </TabsContent>
      <TabsContent value="gradebook" className="mt-0">
        <ClassGradebook studentClass={current} growth={growth} />
      </TabsContent>
      <TabsContent value="anggota" className="mt-0">
        <ClassPeopleList people={people} />
      </TabsContent>
    </Tabs>
  );
}
