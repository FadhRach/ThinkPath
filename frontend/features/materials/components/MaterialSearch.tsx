"use client";

import { X } from "lucide-react";

import { SearchInput } from "@/components/shared/IconInput";
import { Button } from "@/components/ui/button";

interface MaterialSearchProps {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}

export function MaterialSearch({ value, onChange, placeholder }: MaterialSearchProps) {
  return (
    <SearchInput
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      aria-label={placeholder}
      className="[&::-webkit-search-cancel-button]:hidden"
      trailing={
        value ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7 rounded-full"
            onClick={() => onChange("")}
            aria-label="Hapus pencarian"
          >
            <X />
          </Button>
        ) : null
      }
    />
  );
}
