import { NextResponse } from "next/server";
import { getCca, SCOPES, REDIRECT_URI } from "@/lib/auth";

export async function GET() {
  const url = await getCca().getAuthCodeUrl({
    scopes: SCOPES,
    redirectUri: REDIRECT_URI,
    prompt: "select_account",
  });
  return NextResponse.redirect(url);
}
