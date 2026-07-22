import { NextRequest, NextResponse } from "next/server";
import { getCca, SCOPES, REDIRECT_URI } from "@/lib/auth";
import { saveSession } from "@/lib/session";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  if (!code) {
    return NextResponse.redirect(new URL("/?error=missing_code", request.url));
  }
  try {
    const result = await getCca().acquireTokenByCode({
      code,
      scopes: SCOPES,
      redirectUri: REDIRECT_URI,
    });
    await saveSession({
      accessToken: result.accessToken,
      account: result.account?.username ?? undefined,
    });
    return NextResponse.redirect(new URL("/", request.url));
  } catch (e) {
    console.error("Token exchange failed", e);
    return NextResponse.redirect(new URL("/?error=auth_failed", request.url));
  }
}
