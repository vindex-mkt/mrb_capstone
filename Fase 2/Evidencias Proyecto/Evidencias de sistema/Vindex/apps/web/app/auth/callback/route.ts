import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  PASSWORD_RECOVERY_COOKIE,
  PASSWORD_RECOVERY_COOKIE_MAX_AGE,
} from "@/lib/supabase/recovery";

function getRedirectUrl(
  request: NextRequest,
  parameter: string,
  fallback: string,
) {
  const path = request.nextUrl.searchParams.get(parameter);
  if (!path?.startsWith("/") || path.startsWith("//")) {
    return new URL(fallback, request.url);
  }

  const destination = new URL(path, request.url);
  return destination.origin === request.nextUrl.origin
    ? destination
    : new URL(fallback, request.url);
}

function getErrorRedirectUrl(request: NextRequest) {
  const destination = getRedirectUrl(
    request,
    "errorRedirectTo",
    "/update-password?error=invalid_link",
  );
  if (!destination.searchParams.has("error")) {
    destination.searchParams.set("error", "invalid_link");
  }
  return destination;
}

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  if (!code) {
    return NextResponse.redirect(getErrorRedirectUrl(request));
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);

  if (error || !data.session || !data.user) {
    return NextResponse.redirect(getErrorRedirectUrl(request));
  }

  const destination = getRedirectUrl(
    request,
    "next",
    "/update-password",
  );
  const response = NextResponse.redirect(destination);

  if (destination.pathname !== "/update-password") {
    return response;
  }

  response.cookies.set(PASSWORD_RECOVERY_COOKIE, "1", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: PASSWORD_RECOVERY_COOKIE_MAX_AGE,
  });

  return response;
}
