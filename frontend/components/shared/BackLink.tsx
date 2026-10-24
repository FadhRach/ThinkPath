import { ArrowLeft } from "lucide-react";
import Link from "next/link";

interface Props {
  href: string;
  label: string;
}

export function BackLink({ href, label }: Props) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-1.5 text-body-sm text-muted-foreground transition hover:text-foreground"
    >
      <ArrowLeft className="h-4 w-4" />
      {label}
    </Link>
  );
}
