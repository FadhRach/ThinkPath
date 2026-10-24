import {
  BookOpen,
  CalendarDays,
  ClipboardList,
  GraduationCap,
  LayoutDashboard,
  MessagesSquare,
  type LucideIcon,
} from "lucide-react";

import type { Role } from "@/lib/types";

export interface NavItem {
  label: string;
  href: string;
  icon?: LucideIcon;
  /** Awalan rute lain yang juga menandai item ini aktif (mis. halaman detail). */
  alsoActiveFor?: string[];
}

/** Menu sidebar mahasiswa. Urutannya mengikuti alur belajar: kerjakan, pelajari, diskusikan, lihat hasil. */
export const STUDENT_NAV: NavItem[] = [
  { label: "Beranda", href: "/student", icon: LayoutDashboard },
  {
    label: "Tugas",
    href: "/student/tugas",
    icon: ClipboardList,
    alsoActiveFor: ["/student/submit"],
  },
  { label: "Kelas", href: "/student/kelas", icon: BookOpen },
  { label: "Jadwal", href: "/student/jadwal", icon: CalendarDays },
  { label: "Forum", href: "/student/forum", icon: MessagesSquare },
  { label: "Gradebook", href: "/student/gradebook", icon: GraduationCap },
];

/** Menu navigasi atas dosen. */
export const TEACHER_NAV: NavItem[] = [
  { label: "Dashboard", href: "/dashboard" },
  { label: "Kelas", href: "/dashboard/classes" },
  { label: "Tugas", href: "/dashboard/tugas" },
  {
    label: "Pengumpulan",
    href: "/dashboard/pengumpulan",
    alsoActiveFor: ["/dashboard/submission"],
  },
  { label: "Cek Paham", href: "/dashboard/cekpaham" },
  { label: "Laporan", href: "/dashboard/laporan" },
];

export const NAV_BY_ROLE: Record<Role, NavItem[]> = {
  student: STUDENT_NAV,
  teacher: TEACHER_NAV,
};

const HOME_HREFS = new Set(["/dashboard", "/student"]);

/** Apakah `pathname` berada di bawah item ini. Beranda hanya cocok persis. */
export function isNavActive(pathname: string, item: NavItem): boolean {
  if (HOME_HREFS.has(item.href)) return pathname === item.href;
  const prefixes = [item.href, ...(item.alsoActiveFor ?? [])];
  return prefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

/** Judul halaman untuk topbar: label menu yang aktif. */
export function navTitle(pathname: string, items: NavItem[]): string {
  return items.find((item) => isNavActive(pathname, item))?.label ?? "ThinkPath";
}
