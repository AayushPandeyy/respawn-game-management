import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import PasswordForm from "@/components/password-form";
export const dynamic = "force-dynamic";
export const metadata = { title: "New password — Respawn" };
export default async function Page() {
  if (!await currentUser()) redirect("/forgot-password?expired=1");
  return <PasswordForm mode="reset-password" configured />;
}
