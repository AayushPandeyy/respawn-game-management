import AuthForm from "@/components/auth-form";
import { currentUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { supabaseConfig } from "@/lib/supabase/config";
export default async function Login({
  searchParams,
}: {
  searchParams: Promise<{ confirmation?: string }>;
}) {
  if (await currentUser()) redirect("/dashboard");
  const query = await searchParams;
  return (
    <AuthForm
      mode="login"
      configured={!!supabaseConfig()}
      initialError={
        query.confirmation === "failed"
          ? "This confirmation link is invalid, expired, or was opened in a different browser. Try logging in if your email is already confirmed, or sign up again to request a new link."
          : ""
      }
    />
  );
}
