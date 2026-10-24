import {
  BookOpen,
  ClipboardList,
  GraduationCap,
  MessagesSquare,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";

interface QuickLink {
  label: string;
  icon: LucideIcon;
  href: (classId: string) => string;
}

const LINKS: QuickLink[] = [
  { label: "Kelas", icon: BookOpen, href: (id) => `/student/kelas/${id}` },
  { label: "Tugas", icon: ClipboardList, href: (id) => `/student/kelas/${id}?tab=tugas` },
  { label: "Forum", icon: MessagesSquare, href: (id) => `/student/kelas/${id}?tab=forum` },
  { label: "Gradebook", icon: GraduationCap, href: (id) => `/student/gradebook?kelas=${id}` },
];

/** Pintasan ikon ke bagian-bagian sebuah kelas; ikonnya sama dengan menu sidebar. */
export function ClassQuickLinks({ classId, className }: { classId: string; className?: string }) {
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
