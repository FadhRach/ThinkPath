import { Plus } from "lucide-react";
import Link from "next/link";

interface Props {
  href: string;
  label: string;
}

export function CreateLinkChip({ href, label }: Props) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-1.5 rounded-full border border-dashed border-border px-4 py-2 text-body-sm text-muted-foreground transition hover:border-primary hover:text-primary"
    >
      <Plus className="h-4 w-4" />
      {label}
    </Link>
  );
}
