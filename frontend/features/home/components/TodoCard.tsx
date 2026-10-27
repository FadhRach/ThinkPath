"use client";

import { ListChecks, Plus, Trash2 } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { IconTile } from "@/components/ui/icon-tile";
import { Input } from "@/components/ui/input";
import { useAction } from "@/hooks/use-action";
import { createTodo, deleteTodo, updateTodo } from "@/lib/mutations";
import type { StudentTodo } from "@/lib/types";
import { cn } from "@/lib/utils";

const MAX_TITLE = 200;

/**
 * Daftar to-do pribadi. Perubahan tampil seketika (optimistis) lalu dikirim ke server;
 * bila gagal, tampilan dikembalikan dan galatnya muncul sebagai toast. Lewat useAction supaya
 * cache router ikut disegarkan: kembali ke Beranda tidak menampilkan daftar lama.
 */
export function TodoCard({ initial }: { initial: StudentTodo[] }) {
  const [items, setItems] = useState(initial);
  const [title, setTitle] = useState("");
  const add = useAction("Butir belum tersimpan. Coba lagi.");
  const update = useAction("Perubahan belum tersimpan. Coba lagi.");
  const del = useAction("Butir belum terhapus. Coba lagi.");
  const open = items.filter((item) => !item.done);
  const finished = items.filter((item) => item.done);

  async function handleAdd(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = title.trim();
    if (!text) return;
    const { ok, result } = await add.run(() => createTodo({ title: text }));
    if (!ok || !result) return;
    setItems((current) => [result, ...current]);
    setTitle("");
  }

  async function toggle(item: StudentTodo) {
    const before = items;
    setItems((current) =>
      current.map((entry) => (entry.id === item.id ? { ...entry, done: !entry.done } : entry)),
    );
    const { ok } = await update.run(() => updateTodo(item.id, { done: !item.done }));
    if (!ok) setItems(before);
  }

  async function remove(item: StudentTodo) {
    const before = items;
    setItems((current) => current.filter((entry) => entry.id !== item.id));
    const { ok } = await del.run(() => deleteTodo(item.id));
    if (!ok) setItems(before);
  }

  return (
    <Card className="p-5">
      <div className="flex items-center gap-2.5">
        <IconTile icon={ListChecks} size="sm" />
        <div>
          <h2 className="font-bold text-foreground">To-do saya</h2>
          <p className="text-xs text-muted-foreground">
            {open.length ? `${open.length} butir belum selesai` : "Semua beres"}
          </p>
        </div>
      </div>

      <form onSubmit={handleAdd} className="mt-4 flex gap-2">
        <Input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          maxLength={MAX_TITLE}
          placeholder="Tambah catatan atau pengingat…"
          aria-label="Butir to-do baru"
        />
        <Button
          type="submit"
          size="icon"
          disabled={add.pending || !title.trim()}
          aria-label="Tambah butir"
        >
          <Plus />
        </Button>
      </form>

      {items.length ? (
        // Daftar bisa panjang: tingginya dibatasi dan isinya menggulir.
        <ul className="mt-3 max-h-44 space-y-1 overflow-y-auto pr-1">
          {[...open, ...finished].map((item) => (
            <li
              key={item.id}
              className="group flex items-start gap-3 rounded-lg px-2 py-2 hover:bg-muted/60"
            >
              <input
                type="checkbox"
                checked={item.done}
                onChange={() => toggle(item)}
                aria-label={`Tandai selesai: ${item.title}`}
                className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer accent-[hsl(var(--primary))]"
              />
              <span
                className={cn(
                  "min-w-0 flex-1 break-words text-sm leading-snug",
                  item.done ? "text-muted-foreground line-through" : "text-foreground",
                )}
              >
                {item.title}
              </span>
              <button
                type="button"
                onClick={() => remove(item)}
                aria-label={`Hapus: ${item.title}`}
                className="shrink-0 rounded p-1 text-muted-foreground opacity-0 transition hover:bg-danger-soft hover:text-danger focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring group-hover:opacity-100 max-lg:opacity-100"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-4 text-sm text-muted-foreground">
          Catat hal kecil yang tidak ada di daftar tugas dosen, misalnya membaca bab atau menyiapkan
          slide.
        </p>
      )}
    </Card>
  );
}
