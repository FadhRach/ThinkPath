import { Button } from "@/components/ui/button";

import { Btn } from "./Btn";
import { mailtoHref } from "./copy";

// Tanpa alamat kontak sungguhan, tombol tampil nonaktif ("Segera hadir"); tidak ada mailto karangan.
export function ContactButton({
  label,
  subject,
  unavailable,
  block,
}: {
  label: string;
  subject: string;
  unavailable: string;
  block?: boolean;
}) {
  const href = mailtoHref(subject);
  if (!href) {
    return (
      <Button
        disabled
        variant="outline"
        size="lg"
        className={block ? "w-full border-dashed" : "border-dashed"}
      >
        {unavailable}
      </Button>
    );
  }
  return (
    <Btn href={href} variant="outline" block={block}>
      {label}
    </Btn>
  );
}
