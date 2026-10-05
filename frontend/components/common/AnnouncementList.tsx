import { Megaphone } from "lucide-react";
import { Card } from "@/components/ui/card";
import { formatDate, formatRelativeTime } from "@/lib/formatting";
import type { Announcement } from "@/lib/types";

export function AnnouncementList({ announcements }: { announcements: Announcement[] }) {
  if (!announcements.length) return <Card className="campus-card px-5 py-10 text-center"><Megaphone className="mx-auto h-7 w-7 text-[#28675f]" /><h2 className="mt-3 font-bold">Belum ada pengumuman</h2><p className="mt-1 text-sm text-muted-foreground">Kabar dan arahan dari dosen akan tampil di sini.</p></Card>;
  return <div className="space-y-3">{announcements.map((item) => <Card key={item.id} id={`pengumuman-${item.id}`} className="campus-card scroll-mt-24 p-5"><div className="flex items-start gap-3"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#fff0e9] text-[#a95743]"><Megaphone className="h-4 w-4" /></span><div className="min-w-0"><p className="text-xs text-muted-foreground">{item.author_name} · {formatDate(item.created_at)} · {formatRelativeTime(item.created_at)}</p><h2 className="mt-1 text-base font-extrabold">{item.title}</h2><p className="mt-3 whitespace-pre-wrap break-words text-sm leading-relaxed">{item.body}</p></div></div></Card>)}</div>;
}
