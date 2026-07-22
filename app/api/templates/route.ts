import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { isValidRolesConfig } from "@/lib/roles";
import { getRolesConfig, saveRolesConfig, storeMode } from "@/lib/store";

// GET: current role templates + whether the store can be written to.
export async function GET() {
  const session = await getSession();
  if (!session.accessToken) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }
  const config = await getRolesConfig();
  return NextResponse.json({ ...config, storeMode: storeMode() });
}

// PUT: replace the whole role-template set.
export async function PUT(request: NextRequest) {
  const session = await getSession();
  if (!session.accessToken) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  if (!isValidRolesConfig(payload)) {
    return NextResponse.json(
      { error: "Invalid template data. Each role needs an id, a name, and valid sessions (HH:MM start, positive duration)." },
      { status: 400 },
    );
  }
  // Reject duplicate role ids.
  const ids = payload.roles.map((r) => r.id.trim().toLowerCase());
  if (new Set(ids).size !== ids.length) {
    return NextResponse.json({ error: "Role ids must be unique." }, { status: 400 });
  }
  try {
    await saveRolesConfig(payload);
    return NextResponse.json({ ok: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to save templates.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
