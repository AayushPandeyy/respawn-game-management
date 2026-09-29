import AuthForm from "@/components/auth-form";
import { currentUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { supabaseConfig } from "@/lib/supabase/config";
export const dynamic = "force-dynamic";
export default async function Signup() {
  if (await currentUser()) redirect("/dashboard");
  return <AuthForm mode="signup" configured={!!supabaseConfig()} />;
}
