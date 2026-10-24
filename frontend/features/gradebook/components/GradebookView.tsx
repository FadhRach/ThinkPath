"use client";

import { useState } from "react";

import { ScrollStrip } from "@/components/shared/ScrollStrip";
import { ClassGradebook } from "@/features/gradebook/components/ClassGradebook";
import { GradebookClassPicker } from "@/features/gradebook/components/GradebookClassPicker";
import type { CognitiveClassSeries, StudentClassWithAssignments } from "@/lib/types";

interface GradebookViewProps {
  classes: StudentClassWithAssignments[];
  series: CognitiveClassSeries[];
  /** Kelas yang terpilih saat halaman dibuka (mis. dari ?kelas=); bawaannya kelas pertama. */
  initialClassId?: string;
}

/**
 * Gradebook satu halaman: kartu kelas di atas sebagai pilihan, rapor dan grafik kelas
 * yang dipilih langsung tampil di bawahnya tanpa pindah halaman.
 */
export function GradebookView({ classes, series, initialClassId }: GradebookViewProps) {
  const [selectedId, setSelectedId] = useState(
    classes.find((studentClass) => studentClass.id === initialClassId)?.id ?? classes[0].id,
  );
  const selected = classes.find((studentClass) => studentClass.id === selectedId) ?? classes[0];

  return (
    <div className="space-y-6">
      <ScrollStrip label="Pilih kelas">
        {classes.map((studentClass) => (
          <GradebookClassPicker
            key={studentClass.id}
            studentClass={studentClass}
            selected={studentClass.id === selected.id}
            onSelect={() => setSelectedId(studentClass.id)}
          />
        ))}
      </ScrollStrip>

      <ClassGradebook
        studentClass={selected}
        growth={series.find((item) => item.class_id === selected.id)}
      />
    </div>
  );
}
