"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { deleteAccount, fetchDeletionImpact } from "@/lib/mutations";
import type { DeletionImpact, Role } from "@/lib/types";
import { useAction } from "@/hooks/use-action";

const CONFIRM_PHRASE = "HAPUS";

function impactSentence(role: Role, impact: DeletionImpact): string {
  if (role === "teacher") {
    return `${impact.classes} kelas dengan ${impact.students ?? 0} mahasiswa dan ${impact.submissions} jawaban TIDAK ikut terhapus. Kelas menjadi arsip yang hanya bisa dibaca, dengan keterangan bahwa dosennya telah menghapus akun. Yang terhapus: akun, sesi login, notifikasi, dan bukti persetujuanmu.`;
  }
  return `${impact.submissions} jawaban, ${impact.files} berkas unggahan atau rekaman suara, keanggotaan di ${impact.classes} kelas, notifikasi, dan bukti persetujuanmu dihapus dari server.`;
}

export function DeleteAccountCard({ role }: { role: Role }) {
  const [open, setOpen] = useState(false);
  const [impact, setImpact] = useState<DeletionImpact | null>(null);
  const [password, setPassword] = useState("");
  const [phrase, setPhrase] = useState("");
  const { pending, error, run, setError } = useAction("Gagal menghapus akun.");

  async function handleOpenChange(next: boolean) {
    setOpen(next);
    setError(null);
    if (next) {
      setPassword("");
      setPhrase("");
      setImpact(null);
      try {
        setImpact(await fetchDeletionImpact());
      } catch {
        setError("Ringkasan data yang terhapus gagal dimuat. Tutup lalu buka lagi.");
      }
    }
  }

  async function handleDelete(event: React.FormEvent) {
    event.preventDefault();
    // Navigasi penuh, bukan router.replace: seluruh keadaan klien ikut dibuang.
    await run(
      () => deleteAccount(password, phrase),
      () => window.location.assign("/login"),
    );
  }

  return (
    <Card variant="raised" className="space-y-3 border-danger/40 p-5">
      <div>
        <h2 className="font-bold text-foreground">Hapus akun</h2>
        <p className="mt-1 text-body-sm text-muted-foreground">
          Menghapus akun dan datamu dari server, termasuk berkas di disk. Tidak bisa dibatalkan.
        </p>
      </div>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogTrigger asChild>
          <Button variant="destructive">Hapus akun saya</Button>
        </DialogTrigger>
        <DialogContent>
          <form onSubmit={handleDelete} className="space-y-4" autoComplete="off">
            <DialogHeader>
              <DialogTitle>Hapus akun secara permanen?</DialogTitle>
              <DialogDescription>
                {impact ? impactSentence(role, impact) : "Memuat ringkasan data yang terhapus..."}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-1.5">
              <Label htmlFor="delete-password">Kata sandi</Label>
              <Input
                id="delete-password"
                type="password"
                autoComplete="current-password"
                maxLength={128}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="delete-phrase">
                Ketik <strong>{CONFIRM_PHRASE}</strong> untuk melanjutkan
              </Label>
              <Input
                id="delete-phrase"
                autoComplete="off"
                maxLength={20}
                value={phrase}
                onChange={(event) => setPhrase(event.target.value)}
              />
            </div>
            {error ? (
              <p role="alert" className="text-body-sm text-danger">
                {error}
              </p>
            ) : null}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
                Batal
              </Button>
              <Button
                type="submit"
                variant="destructive"
                disabled={pending || !impact || !password || phrase.trim() !== CONFIRM_PHRASE}
              >
                {pending ? "Menghapus..." : "Hapus akun permanen"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
