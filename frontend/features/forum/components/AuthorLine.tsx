import { AvatarInitials } from "@/components/shared/AvatarInitials";
import { Badge } from "@/components/ui/badge";
import { formatRelativeTime } from "@/lib/formatting";
import type { ForumAuthorRole } from "@/lib/types";

interface AuthorLineProps {
  name: string;
  role: ForumAuthorRole;
  createdAt: string;
  /** Teks tambahan di ujung baris, mis. jumlah balasan. */
  extra?: React.ReactNode;
}

/** Penulis, peran (dosen diberi lencana), dan waktunya. */
export function AuthorLine({ name, role, createdAt, extra }: AuthorLineProps) {
  return (
    <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
      <AvatarInitials name={name} size="sm" />
      <span className="max-w-[14rem] truncate font-semibold text-foreground">{name}</span>
      {role === "teacher" ? (
        <Badge tone="brand" size="sm">
          Dosen
        </Badge>
      ) : null}
      <span aria-hidden="true">·</span>
      <time dateTime={createdAt}>{formatRelativeTime(createdAt)}</time>
      {extra}
    </div>
  );
}
