import { cookies } from "next/headers";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { UpdatePasswordForm } from "@/components/update-password-form";
import { PASSWORD_RECOVERY_COOKIE } from "@/lib/supabase/recovery";

type UpdatePasswordPageProps = {
  searchParams: Promise<{ error?: string | string[] }>;
};

export default async function UpdatePasswordPage({
  searchParams,
}: UpdatePasswordPageProps) {
  const params = await searchParams;
  const cookieStore = await cookies();
  const hasRecoveryCookie =
    cookieStore.get(PASSWORD_RECOVERY_COOKIE)?.value === "1";

  let hasValidRecoverySession = false;
  if (hasRecoveryCookie) {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();
    hasValidRecoverySession = !error && Boolean(user);
  }

  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-6 bg-muted p-6 md:p-10">
      <div className="flex w-full max-w-sm flex-col gap-6">
        <UpdatePasswordForm
          hasValidRecoverySession={hasValidRecoverySession}
          hasInvalidLink={params.error === "invalid_link"}
        />
      </div>
    </div>
  );
}
