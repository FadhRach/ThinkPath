import { Alert } from "@/components/ui/alert";

interface Props {
  recommendation: string | null;
}

export function RecommendationBlock({ recommendation }: Props) {
  return (
    <Alert variant="warning" title="Rekomendasi Tindak Lanjut">
      {recommendation ||
        "Belum ada rekomendasi otomatis. Tinjau bukti di atas untuk menentukan tindak lanjut."}
    </Alert>
  );
}
