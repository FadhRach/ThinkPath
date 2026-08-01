"use client";

import { ChevronDown, LogOut, User } from "lucide-react";
import { useRouter } from "next/navigation";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { logout } from "@/lib/auth";
import { avatarColorClass, initials } from "@/lib/ui";
import { cn } from "@/lib/utils";

interface Props {
  displayName: string;
  email: string;
  roleLabel: string;
}

export function NavUser({ displayName, email, roleLabel }: Props) {
  const router = useRouter();
  const name = displayName || email;

  function handleLogout() {
    logout();
    router.replace("/login");
    router.refresh();
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex items-center gap-2.5 rounded-full py-1 pl-1 pr-2 outline-none transition hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring">
        <span
          className={cn(
            "grid h-9 w-9 place-items-center rounded-full text-xs font-bold",
            avatarColorClass(name),
          )}
        >
          {initials(name)}
        </span>
        <span className="hidden text-left leading-tight sm:block">
          <span className="block text-sm font-semibold text-foreground">
            {name}
          </span>
          <span className="block text-xs text-muted-foreground">
            {roleLabel}
          </span>
        </span>
        <ChevronDown className="hidden h-4 w-4 text-muted-foreground sm:block" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="flex flex-col">
          <span className="text-sm font-semibold">{name}</span>
          <span className="truncate text-xs font-normal text-muted-foreground">
            {email}
          </span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem className="gap-2" disabled>
          <User className="h-4 w-4" />
          Pengaturan profil
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem className="gap-2 text-danger focus:text-danger" onSelect={handleLogout}>
          <LogOut className="h-4 w-4" />
          Keluar
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
