import AuthForm from "@/components/auth-form";
import { currentUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { supabaseConfig } from "@/lib/supabase/config";
import { authDestination } from "@/lib/auth-destination";
export default async function Login({
  searchParams,
}: {
  searchParams: Promise<{ confirmation?: string; next?: string; oauth?: string }>;
}) {
  const query = await searchParams;
  const destination = authDestination(query.next);
  if (await currentUser()) redirect(destination);
  return (
    <AuthForm
      mode="login"
      destination={destination}
      configured={!!supabaseConfig()}
      initialError={
        query.oauth === "failed"
          ? "Google sign-in was cancelled or could not be completed. Please try again."
          : query.confirmation === "failed"
          ? "This confirmation link is invalid, expired, or was opened in a different browser. Try logging in if your email is already confirmed, or sign up again to request a new link."
          : ""
      }
    />
  );
}
