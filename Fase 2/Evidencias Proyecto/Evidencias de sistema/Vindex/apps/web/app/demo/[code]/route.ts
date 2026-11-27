import { NextRequest, NextResponse } from "next/server";
import { findDemoLoginAccount } from "@/lib/demo-login";
import { createSupabaseAdminClient, createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

function errorResponse(message: string, status: number) {
  const response = NextResponse.json({ error: message }, { status });
  response.headers.set("Cache-Control", "no-store");
  return response;
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ code: string }> },
) {
  const { code } = await context.params;

  let account;
  try {
    account = findDemoLoginAccount(code);
  } catch (error) {
    console.error("La configuración de acceso demo no es válida.", error);
    return errorResponse("El acceso demo no está configurado correctamente.", 500);
  }

  if (!account) {
    return errorResponse("El código QR no corresponde a una cuenta demo.", 404);
  }

  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    !process.env.SUPABASE_SERVICE_ROLE_KEY
  ) {
    console.error("Faltan variables de entorno requeridas para el acceso demo.");
    return errorResponse("El acceso demo no está configurado correctamente.", 500);
  }

  const adminClient = createSupabaseAdminClient();
  const { data: generatedLink, error: generateError } = await adminClient.auth.admin.generateLink({
    type: "magiclink",
    email: account.email,
  });

  if (generateError) {
    console.error("No se pudo generar el acceso mágico para la cuenta demo.", generateError);
    return errorResponse("No se pudo iniciar la sesión demo. Inténtalo de nuevo.", 502);
  }

  const supabase = await createSupabaseServerClient();
  const { data, error: verifyError } = await supabase.auth.verifyOtp({
    token_hash: generatedLink.properties.hashed_token,
    type: "magiclink",
  });

  if (verifyError || !data.session || !data.user || data.user.id !== generatedLink.user.id) {
    console.error("No se pudo verificar el acceso mágico de la cuenta demo.", verifyError);
    return errorResponse("No se pudo iniciar la sesión demo. Inténtalo de nuevo.", 502);
  }

  const response = NextResponse.redirect(new URL("/", request.url));
  response.headers.set("Cache-Control", "no-store");
  return response;
}
