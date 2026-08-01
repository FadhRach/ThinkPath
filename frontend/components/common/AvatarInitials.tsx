import { avatarColorClass, initials } from "@/lib/ui";
import { cn } from "@/lib/utils";

interface Props {
  name: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}

const SIZE: Record<NonNullable<Props["size"]>, string> = {
  sm: "h-8 w-8 text-[0.7rem]",
  md: "h-10 w-10 text-xs",
  lg: "h-14 w-14 text-base",
};

export function AvatarInitials({ name, size = "md", className }: Props) {
  return (
    <span
      className={cn(
        "grid shrink-0 place-items-center rounded-full font-bold",
        SIZE[size],
        avatarColorClass(name),
        className,
      )}
      aria-hidden="true"
    >
      {initials(name)}
    </span>
  );
}
