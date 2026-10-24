import { Card } from "@/components/ui/card";
import { JoinCodeForm } from "@/features/classes/components/JoinCodeForm";

/** Gabung kelas ringkas di sudut kanan atas beranda; selebar kolom kanan di bawahnya. */
export function JoinClassCard() {
  return (
    <Card className="p-4">
      <h2 className="mb-2.5 text-sm font-bold text-foreground">Gabung kelas</h2>
      <JoinCodeForm />
    </Card>
  );
}
