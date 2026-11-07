import { NextRequest, NextResponse } from "next/server";
import { getPublicOrigin } from "@/lib/checkout/webpay";

export const runtime = "nodejs";

const RETURN_TOKEN_COOKIE = "vindex_ad_return_token";
const CANCEL_TOKEN_COOKIE = "vindex_ad_cancel_token";
const CANCEL_ORDER_COOKIE = "vindex_ad_cancel_order";

const handleReturn = (
  request: NextRequest,
  parameters: URLSearchParams | FormData,
) => {
  const token = parameters.get("token_ws");
  const cancelToken = parameters.get("TBK_TOKEN");
  const buyOrder = parameters.get("TBK_ORDEN_COMPRA");
  const transactionId = request.nextUrl.searchParams.get("transaction_id");
  const destination = new URL("/advertising/result", getPublicOrigin(request.url));
  if (transactionId && /^[0-9a-f-]{36}$/i.test(transactionId)) {
    destination.searchParams.set("transaction_id", transactionId);
  }

  const cancelled = !(typeof token === "string" && token.length > 0);
  if (cancelled) destination.searchParams.set("cancelled", "1");
  const response = NextResponse.redirect(destination, 303);
  const cookieOptions = {
    httpOnly: true,
    secure: destination.protocol === "https:",
    sameSite: "lax" as const,
    path: "/api/payments/advertising/commit",
    maxAge: 10 * 60,
  };

  if (typeof token === "string" && token.length > 0) {
    response.cookies.set(RETURN_TOKEN_COOKIE, token, cookieOptions);
  } else {
    if (typeof cancelToken === "string" && cancelToken.length > 0) {
      response.cookies.set(CANCEL_TOKEN_COOKIE, cancelToken, cookieOptions);
    }
    if (typeof buyOrder === "string" && buyOrder.length > 0 && buyOrder.length <= 64) {
      response.cookies.set(CANCEL_ORDER_COOKIE, buyOrder, cookieOptions);
    }
  }

  return response;
};

export async function GET(request: NextRequest) {
  return handleReturn(request, request.nextUrl.searchParams);
}

export async function POST(request: NextRequest) {
  try {
    return handleReturn(request, await request.formData());
  } catch {
    const destination = new URL("/advertising/result", getPublicOrigin(request.url));
    destination.searchParams.set("state", "communication_error");
    return NextResponse.redirect(destination, 303);
  }
}
