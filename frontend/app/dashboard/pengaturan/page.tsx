import { ProfileSettings } from "@/components/settings/ProfileSettings";
import { getConsent, getMe } from "@/lib/data";

export default async function PengaturanPage() {
  const [profile, consent] = await Promise.all([getMe(), getConsent()]);
  return <ProfileSettings profile={profile} consent={consent} />;
}
