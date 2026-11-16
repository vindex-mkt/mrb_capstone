import { LoginForm } from "@/components/login-form"
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function LoginPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession();

  let isAuthenticated = false;
  let sessionCheckFailed = Boolean(sessionError);

  if (session && !sessionError) {
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();
    isAuthenticated = !error && Boolean(user);
    sessionCheckFailed = Boolean(error);
  }

  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-6 bg-muted p-6 md:p-10">
      <div className="flex w-full max-w-sm flex-col gap-6">
        <LoginForm
          initialIsAuthenticated={isAuthenticated}
          sessionCheckFailed={sessionCheckFailed}
        />
      </div>
    </div>
  )
}