"use client";

import { useMemo, useState } from "react";

import { EmptyState } from "@/components/shared/EmptyState";
import { FilterPills } from "@/components/shared/FilterPills";
import { SearchInput } from "@/components/shared/IconInput";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { NativeSelect } from "@/components/ui/native-select";
import { ScrollStrip } from "@/components/shared/ScrollStrip";
import { ForumClassCard } from "@/features/forum/components/ForumClassCard";
import { ForumPostRow } from "@/features/forum/components/ForumPostRow";
import { filterPosts, type ForumKindFilter } from "@/features/forum/lib/forum-filter";
import type { ForumPost } from "@/lib/types";

interface StudentForumBrowserProps {
  classes: { id: string; name: string }[];
  /** Semua topik dari semua kelas, terbaru di atas. */
  posts: ForumPost[];
}

const ALL = "semua";

/**
 * Forum lintas kelas untuk mahasiswa: kartu kelas di atas langsung membuka forum kelasnya;
 * di bawahnya semua topik bisa dicari dan disaring per kelas dan jenis.
 */
export function StudentForumBrowser({ classes, posts }: StudentForumBrowserProps) {
  const [query, setQuery] = useState("");
  const [classId, setClassId] = useState(ALL);
  const [kind, setKind] = useState<ForumKindFilter>(ALL);

  const visible = useMemo(
    () => filterPosts(posts, { query, classId, kind }),
    [posts, query, classId, kind],
  );
  const kindCount = (value: ForumKindFilter) =>
    filterPosts(posts, { query, classId, kind: value }).length;
  const statsByClass = useMemo(() => {
    const stats = new Map<string, { count: number; last: string }>();
    for (const post of posts) {
      const current = stats.get(post.class_id);
      stats.set(post.class_id, {
        count: (current?.count ?? 0) + 1,
        last:
          current && current.last > post.last_activity_at ? current.last : post.last_activity_at,
      });
    }
    return stats;
  }, [posts]);

  function reset() {
    setQuery("");
    setClassId(ALL);
    setKind(ALL);
  }

  return (
    <div className="space-y-5">
      <ScrollStrip label="Forum per kelas">
        {classes.map((studentClass) => (
          <ForumClassCard
            key={studentClass.id}
            classId={studentClass.id}
            name={studentClass.name}
            topicCount={statsByClass.get(studentClass.id)?.count ?? 0}
            lastActivity={statsByClass.get(studentClass.id)?.last ?? null}
          />
        ))}
      </ScrollStrip>

      <div className="min-w-0 space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="min-w-0 flex-1">
            <SearchInput
              aria-label="Cari topik forum"
              placeholder="Cari judul, isi, atau penulis"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>
          {classes.length > 1 ? (
            <NativeSelect
              aria-label="Saring menurut kelas"
              value={classId}
              onChange={(event) => setClassId(event.target.value)}
              className="sm:w-64"
            >
              <option value={ALL}>Semua kelas</option>
              {classes.map((studentClass) => (
                <option key={studentClass.id} value={studentClass.id}>
                  {studentClass.name}
                </option>
              ))}
            </NativeSelect>
          ) : null}
        </div>
        <FilterPills
          label="Saring menurut jenis"
          value={kind}
          onChange={setKind}
          options={[
            { value: ALL, label: "Semua", count: kindCount(ALL) },
            { value: "announcement", label: "Pengumuman", count: kindCount("announcement") },
            { value: "discussion", label: "Diskusi", count: kindCount("discussion") },
          ]}
        />

        {visible.length ? (
          <Card className="divide-y divide-border/70 overflow-hidden">
            {visible.map((post) => (
              <ForumPostRow key={post.id} post={post} />
            ))}
          </Card>
        ) : (
          <EmptyState
            title={posts.length ? "Tidak ada topik yang cocok" : "Belum ada topik"}
            caption={
              posts.length
                ? "Coba kata kunci lain, atau tampilkan kembali semua kelas dan jenis."
                : "Pengumuman dosen dan diskusi kelas akan muncul di sini."
            }
            action={
              posts.length ? (
                <Button type="button" variant="outline" onClick={reset}>
                  Reset pencarian
                </Button>
              ) : undefined
            }
          />
        )}
      </div>
    </div>
  );
}
