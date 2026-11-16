import { NextRequest, NextResponse } from "next/server";
import { CANCEL_TOKEN_COOKIE, getPublicOrigin, RETURN_TOKEN_COOKIE } from "@/lib/checkout/webpay";
import { resolveBuyerPendingPayment } from "@/lib/checkout/pending-payments";
import { createSupabaseAdminClient, createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const isSameOrigin = (request: NextRequest) => {
  try {
    const origin = request.headers.get("origin");
    if (origin && origin !== getPublicOrigin(request.url)) return false;
    return request.headers.get("sec-fetch-site") !== "cross-site";
  } catch {
    return false;
  }
};

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ orderId: string }> },
) {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ message: "Solicitud no permitida." }, { status: 403 });
  }

  const { orderId: rawOrderId } = await params;
  if (!/^\d+$/.test(rawOrderId) || !Number.isSafeInteger(Number(rawOrderId)) || Number(rawOrderId) <= 0) {
    return NextResponse.json({ message: "El identificador de la orden no es válido." }, { status: 400 });
  }

  const authClient = await createSupabaseServerClient();
  const { data: { user }, error: authError } = await authClient.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ message: "Inicia sesión para administrar este pago." }, { status: 401 });
  }

  try {
    const adminClient = createSupabaseAdminClient();
    const rawBody: unknown = await request.json().catch(() => ({}));
    const action = typeof rawBody === "object" && rawBody !== null && "action" in rawBody && rawBody.action === "cancel"
      ? "cancel"
      : "retry";
    const result = await resolveBuyerPendingPayment(adminClient, user.id, Number(rawOrderId), action);

    if (result.state === "authorized") {
      const response = NextResponse.json({
        state: "resume",
        orderId: Number(rawOrderId),
        message: result.message,
      }, { headers: { "Cache-Control": "no-store" } });
      response.cookies.set(RETURN_TOKEN_COOKIE, result.token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/api/payments/webpay/commit",
        maxAge: 300,
      });
      response.cookies.set(CANCEL_TOKEN_COOKIE, "", {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/api/payments/webpay/commit",
        maxAge: 0,
      });
      return response;
    }

    return NextResponse.json(result, {
      status: result.state === "pending" ? 409 : 200,
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    console.error(
      "No se pudo resolver el pago Webpay pendiente:",
      error instanceof Error ? error.message : "error desconocido",
    );
    return NextResponse.json({
      message: "No pudimos procesar este intento de pago. Si ya pasaron cinco minutos, verifica que la migración de expiración esté aplicada.",
    }, { status: 502 });
  }
}
