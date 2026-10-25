import { MessagesSquare } from "lucide-react";
import Link from "next/link";

import { Card } from "@/components/ui/card";
import { IconTile } from "@/components/ui/icon-tile";
import { formatRelativeTime } from "@/lib/formatting";

interface ForumClassCardProps {
  classId: string;
  name: string;
  topicCount: number;
  /** Awalan alamat kelas menurut peran. */
  classBase: string;
  /** Aktivitas terakhir di forum kelas ini, atau null bila belum ada topik. */
  lastActivity: string | null;
}

/** Kartu ringkas satu kelas yang membuka tab Forum kelas tersebut. */
export function ForumClassCard({
  classId,
  name,
  topicCount,
  classBase,
  lastActivity,
}: ForumClassCardProps) {
  return (
    <Card className="h-full transition-colors hover:bg-accent/40">
      <Link
        href={`${classBase}/${classId}?tab=forum`}
        className="flex h-full items-center gap-3 rounded-xl p-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <IconTile icon={MessagesSquare} size="sm" />
        <span className="min-w-0">
          <span className="block truncate text-sm font-semibold text-foreground">{name}</span>
          <span className="block truncate text-xs text-muted-foreground">
            {topicCount} topik
            {lastActivity ? ` · ${formatRelativeTime(lastActivity)}` : ""}
          </span>
        </span>
      </Link>
    </Card>
  );
}
