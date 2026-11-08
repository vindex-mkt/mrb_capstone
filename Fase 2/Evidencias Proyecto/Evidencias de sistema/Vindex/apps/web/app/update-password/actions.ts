"use server";

import { cookies } from "next/headers";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { PASSWORD_RECOVERY_COOKIE } from "@/lib/supabase/recovery";

type UpdatePasswordResult =
  | { success: true }
  | { success: false; message: string };

export async function updatePassword(
  newPassword: string,
): Promise<UpdatePasswordResult> {
  if (typeof newPassword !== "string" || newPassword.length < 8) {
    return {
      success: false,
      message: "La contraseña debe tener al menos 8 caracteres.",
    };
  }

  const cookieStore = await cookies();
  if (cookieStore.get(PASSWORD_RECOVERY_COOKIE)?.value !== "1") {
    return {
      success: false,
      message: "El enlace de recuperación no es válido o ha expirado.",
    };
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: sessionError,
  } = await supabase.auth.getUser();

  if (sessionError || !user) {
    return {
      success: false,
      message: "Tu sesión de recuperación no es válida o ha expirado.",
    };
  }

  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) {
    return { success: false, message: error.message };
  }

  cookieStore.delete(PASSWORD_RECOVERY_COOKIE);
  return { success: true };
}
