import { ProfileSettings } from "@/components/settings/ProfileSettings";
import { getMe } from "@/lib/data";

export default async function PengaturanPage() {
  const profile = await getMe();
  return <ProfileSettings profile={profile} />;
}
