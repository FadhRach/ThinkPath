import { AvatarInitials } from "@/components/shared/AvatarInitials";
import { Alert } from "@/components/ui/alert";
import { ConsentProof } from "@/features/settings/components/ConsentProof";
import { DeleteAccountCard } from "@/features/settings/components/DeleteAccountCard";
import { PasswordForm } from "@/features/settings/components/PasswordForm";
import { ProfileForm } from "@/features/settings/components/ProfileForm";
import { Card } from "@/components/ui/card";
import { formatDate } from "@/lib/formatting";
import type { ConsentStatus, Profile } from "@/lib/types";

const ROLE_LABEL: Record<Profile["role"], string> = {
  teacher: "Dosen",
  student: "Mahasiswa",
};

/**
 * Isi halaman pengaturan, dipakai bersama rute dosen dan rute mahasiswa.
 *
 * Sengaja satu komponen: yang bisa diubah sama persis untuk kedua peran, dan
 * menduplikasinya hanya membuka peluang keduanya menyimpang diam-diam.
 */
export function ProfileSettings({
  profile,
  consent,
}: {
  profile: Profile;
  consent: ConsentStatus;
}) {
  return (
    <div className="space-y-6">
      <h1 className="sr-only">Pengaturan</h1>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="min-w-0 space-y-6 lg:col-span-2">
          <Card variant="raised" className="space-y-4 p-5">
            <ProfileForm profile={profile} />
          </Card>
          <Card variant="raised" className="p-5">
            <PasswordForm />
          </Card>
          <ConsentProof role={profile.role} consent={consent} />
          <DeleteAccountCard role={profile.role} />
        </div>

        <div className="space-y-6">
          <Card variant="raised" className="space-y-4 p-5">
            <div className="flex items-center gap-3">
              <AvatarInitials name={profile.display_name ?? profile.email} />
              <div className="min-w-0">
                <p className="truncate font-bold text-foreground">
                  {profile.display_name || profile.email}
                </p>
                <p className="truncate text-body-sm text-muted-foreground">
                  {ROLE_LABEL[profile.role]}
                </p>
              </div>
            </div>

            <dl className="space-y-2 border-t border-border pt-3 text-body-sm">
              <Row label="Email" value={profile.email} />
              <Row label="Peran" value={ROLE_LABEL[profile.role]} />
              <Row label="Bergabung" value={formatDate(profile.created_at)} />
            </dl>
          </Card>

          <Alert variant="info" title="Yang tidak bisa diubah">
            Email dan peran dikunci setelah pendaftaran. Keduanya menjadi dasar kepemilikan kelas
            dan submission yang sudah tersimpan, sehingga mengubahnya akan memutus riwayat yang
            sudah terbentuk.
          </Alert>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="shrink-0 text-muted-foreground">{label}</dt>
      <dd className="min-w-0 truncate text-right text-foreground">{value}</dd>
    </div>
  );
}
