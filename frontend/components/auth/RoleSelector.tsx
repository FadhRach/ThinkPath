"use client";

import { Check, GraduationCap, Presentation } from "lucide-react";

import type { Role } from "@/lib/types";
import { cn } from "@/lib/utils";

interface RoleOption {
  value: Role;
  label: string;
  caption: string;
  icon: typeof GraduationCap;
}

const OPTIONS: RoleOption[] = [
  {
    value: "student",
    label: "Siswa",
    caption: "Kerjakan & kumpulkan tugas",
    icon: GraduationCap,
  },
  {
    value: "teacher",
    label: "Guru",
    caption: "Monitor & analisis kelas",
    icon: Presentation,
  },
];

interface Props {
  value: Role;
  onChange: (role: Role) => void;
}

export function RoleSelector({ value, onChange }: Props) {
  return (
    <div className="grid grid-cols-2 gap-3">
      {OPTIONS.map((option) => {
        const selected = option.value === value;
        const Icon = option.icon;
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            aria-pressed={selected}
            className={cn(
              "relative rounded-2xl border p-4 text-left transition",
              selected
                ? "border-primary bg-secondary/30 ring-1 ring-primary"
                : "border-border bg-card hover:border-primary/40",
            )}
          >
            <span
              className={cn(
                "absolute right-3 top-3 grid h-5 w-5 place-items-center rounded-full border",
                selected
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border text-transparent",
              )}
            >
              <Check className="h-3 w-3" />
            </span>
            <Icon className={cn("h-5 w-5", selected ? "text-primary" : "text-muted-foreground")} />
            <p className="mt-2 font-semibold text-foreground">{option.label}</p>
            <p className="text-xs text-muted-foreground">{option.caption}</p>
          </button>
        );
      })}
    </div>
  );
}
