import { NextRequest, NextResponse } from "next/server";
import { CANCEL_TOKEN_COOKIE, getPublicOrigin, RETURN_TOKEN_COOKIE } from "@/lib/checkout/webpay";

export const runtime = "nodejs";

const redirectToResult = (request: NextRequest, token: string | null, cancelled: boolean) => {
  const resultUrl = new URL("/checkout/result", getPublicOrigin(request.url));
  if (!token) resultUrl.searchParams.set("state", "communication_error");

  const response = NextResponse.redirect(resultUrl, 303);
  if (token) {
    response.cookies.set(cancelled ? CANCEL_TOKEN_COOKIE : RETURN_TOKEN_COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/api/payments/webpay/commit",
      maxAge: 300,
    });
  }
  return response;
};

const handleReturn = (request: NextRequest, values: URLSearchParams | FormData) => {
  const token = values.get("token_ws");
  const cancelledToken = values.get("TBK_TOKEN");
  if (typeof token === "string" && token.length > 0) return redirectToResult(request, token, false);
  if (typeof cancelledToken === "string" && cancelledToken.length > 0) {
    return redirectToResult(request, cancelledToken, true);
  }
  return redirectToResult(request, null, false);
};

export async function POST(request: NextRequest) {
  try {
    return handleReturn(request, await request.formData());
  } catch {
    return redirectToResult(request, null, false);
  }
}

export async function GET(request: NextRequest) {
  return handleReturn(request, request.nextUrl.searchParams);
}
