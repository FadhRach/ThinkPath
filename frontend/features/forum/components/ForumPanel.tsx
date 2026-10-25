"use client";

import { useMemo, useState } from "react";

import { EmptyState } from "@/components/shared/EmptyState";
import { FilterPills } from "@/components/shared/FilterPills";
import { Alert } from "@/components/ui/alert";
import { ForumPostCard } from "@/features/forum/components/ForumPostCard";
import { PostComposer } from "@/features/forum/components/PostComposer";
import type { ForumPost, Role } from "@/lib/types";

type Filter = "all" | "announcement" | "discussion";

interface ForumPanelProps {
  classId: string;
  posts: ForumPost[];
  viewerRole: Role;
  /** Kelas arsip: topik masih bisa dibaca, tetapi tidak menerima tulisan baru. */
  readOnly?: boolean;
  /** Topik yang dibuka sejak awal (dari ?post= pada tautan notifikasi). */
  openPostId?: string;
}

/** Forum satu kelas: pengumuman disematkan di atas, diskusi di bawahnya, semuanya bisa dibalas. */
export function ForumPanel({
  classId,
  posts,
  viewerRole,
  readOnly = false,
  openPostId,
}: ForumPanelProps) {
  const [filter, setFilter] = useState<Filter>("all");
  const counts = useMemo(
    () => ({
      all: posts.length,
      announcement: posts.filter((post) => post.kind === "announcement").length,
      discussion: posts.filter((post) => post.kind === "discussion").length,
    }),
    [posts],
  );
  const visible = posts.filter((post) => filter === "all" || post.kind === filter);

  return (
    <div className="space-y-4">
      {readOnly ? (
        <Alert variant="warning" title="Forum hanya bisa dibaca">
          Dosen kelas ini telah menghapus akunnya, jadi topik dan balasan baru tidak diterima.
        </Alert>
      ) : (
        <PostComposer classId={classId} role={viewerRole} />
      )}

      {posts.length > 0 ? (
        <FilterPills
          label="Saring topik forum"
          value={filter}
          onChange={setFilter}
          options={[
            { value: "all", label: "Semua", count: counts.all },
            { value: "announcement", label: "Pengumuman", count: counts.announcement },
            { value: "discussion", label: "Diskusi", count: counts.discussion },
          ]}
        />
      ) : null}

      {visible.length ? (
        <div className="space-y-3">
          {visible.map((post) => (
            <ForumPostCard
              key={post.id}
              post={post}
              viewerRole={viewerRole}
              readOnly={readOnly}
              defaultOpen={post.id === openPostId}
            />
          ))}
        </div>
      ) : (
        <EmptyState
          title={posts.length ? "Tidak ada topik di kategori ini" : "Forum masih sepi"}
          caption={
            viewerRole === "teacher"
              ? "Terbitkan pengumuman atau buka topik diskusi untuk memulai."
              : "Punya pertanyaan tentang materi atau tugas? Tulis di sini, dosen dan teman sekelas bisa membalas."
          }
        />
      )}
    </div>
  );
}
