import PasswordForm from "@/components/password-form";
import { supabaseConfig } from "@/lib/supabase/config";
export const dynamic = "force-dynamic";
export const metadata = { title: "Reset your password — Respawn" };
export default async function Page({ searchParams }: { searchParams: Promise<{ expired?: string }> }) {
  const params = await searchParams;
  return <PasswordForm mode="forgot-password" configured={!!supabaseConfig()} expired={params.expired === "1"} />;
}
