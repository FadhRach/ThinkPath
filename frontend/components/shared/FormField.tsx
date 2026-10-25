import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

interface FormFieldProps {
  /** `id` kontrol di dalamnya; menghubungkan label dan pesan galat. */
  htmlFor: string;
  label: string;
  hint?: string;
  error?: string | null;
  required?: boolean;
  className?: string;
  children: React.ReactNode;
}

/** Label + kontrol + petunjuk + galat, supaya semua form tersusun dan terbaca sama. */
export function FormField({
  htmlFor,
  label,
  hint,
  error,
  required,
  className,
  children,
}: FormFieldProps) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label htmlFor={htmlFor}>
        {label}
        {required ? (
          <span aria-hidden="true" className="ml-0.5 text-danger">
            *
          </span>
        ) : null}
      </Label>
      {children}
      {hint && !error ? <p className="text-body-sm text-muted-foreground">{hint}</p> : null}
      {error ? (
        <p role="alert" className="text-body-sm text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
