import { Callout } from "@/components/common/Callout";

interface Props {
  recommendation: string | null;
}

export function RecommendationBlock({ recommendation }: Props) {
  return (
    <Callout variant="warning" title="Rekomendasi Tindak Lanjut">
      {recommendation ||
        "Belum ada rekomendasi otomatis. Tinjau bukti di atas untuk menentukan tindak lanjut."}
    </Callout>
  );
}
