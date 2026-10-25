import {
  BookOpen,
  ClipboardList,
  GraduationCap,
  LibraryBig,
  MessagesSquare,
  Users,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";

interface QuickLink {
  label: string;
  icon: LucideIcon;
  href: (classId: string) => string;
}

const STUDENT_LINKS: QuickLink[] = [
  { label: "Kelas", icon: BookOpen, href: (id) => `/student/kelas/${id}` },
  { label: "Tugas", icon: ClipboardList, href: (id) => `/student/kelas/${id}?tab=tugas` },
  { label: "Forum", icon: MessagesSquare, href: (id) => `/student/kelas/${id}?tab=forum` },
  { label: "Gradebook", icon: GraduationCap, href: (id) => `/student/gradebook?kelas=${id}` },
];

const TEACHER_LINKS: QuickLink[] = [
  { label: "Mahasiswa", icon: Users, href: (id) => `/dashboard/classes/${id}?tab=mahasiswa` },
  { label: "Materi", icon: LibraryBig, href: (id) => `/dashboard/classes/${id}?tab=materi` },
  { label: "Forum", icon: MessagesSquare, href: (id) => `/dashboard/classes/${id}?tab=forum` },
  { label: "Tugas", icon: ClipboardList, href: (id) => `/dashboard/classes/${id}?tab=tugas` },
];

/** Pintasan ikon ke bagian-bagian sebuah kelas; ikonnya sama dengan menu sidebar. */
export function ClassQuickLinks({
  classId,
  role = "student",
  className,
}: {
  classId: string;
  role?: "student" | "teacher";
  className?: string;
}) {
  const LINKS = role === "teacher" ? TEACHER_LINKS : STUDENT_LINKS;
  return (
    <>
      {LINKS.map(({ label, icon: Icon, href }) => (
        <Button key={label} asChild variant="outline" size="icon" className={className}>
          <Link href={href(classId)} title={label} aria-label={`${label}: buka`}>
            <Icon />
          </Link>
        </Button>
      ))}
    </>
  );
}
