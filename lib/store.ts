// ===========================================================================
// Persistence for the role templates.
// ===========================================================================
// Three tiers, chosen automatically:
//   1. Vercel KV (Upstash REST) when KV_REST_API_URL + KV_REST_API_TOKEN are
//      set — the shared, production store. No npm dependency; plain fetch.
//   2. A local JSON file (.data/role-templates.json) during local dev, so the
//      editor works before any store is provisioned. The Vercel filesystem is
//      read-only, so this tier is dev-only.
//   3. Read-only seed defaults (lib/roles.ts) when neither is available. The
//      app still schedules; saving reports that storage isn't configured.

import { promises as fs } from "fs";
import path from "path";
import { isValidRolesConfig, RolesConfig, SEED_ROLES } from "./roles";

const KEY = "role-templates";
const LOCAL_FILE = path.join(process.cwd(), ".data", "role-templates.json");

function kvUrl(): string | undefined {
  return process.env.KV_REST_API_URL;
}
function kvToken(): string | undefined {
  return process.env.KV_REST_API_TOKEN;
}
function kvConfigured(): boolean {
  return Boolean(kvUrl() && kvToken());
}
// Local file writes only make sense off-Vercel (its FS is read-only).
function localFileUsable(): boolean {
  return !process.env.VERCEL;
}

export type StoreMode = "kv" | "local-file" | "read-only";
export function storeMode(): StoreMode {
  if (kvConfigured()) return "kv";
  if (localFileUsable()) return "local-file";
  return "read-only";
}

async function kvGet(): Promise<RolesConfig | null> {
  const res = await fetch(`${kvUrl()}/get/${KEY}`, {
    headers: { Authorization: `Bearer ${kvToken()}` },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`KV get failed (${res.status})`);
  const body = (await res.json()) as { result?: string | null };
  if (!body.result) return null;
  const parsed = JSON.parse(body.result);
  return isValidRolesConfig(parsed) ? parsed : null;
}

async function kvSet(config: RolesConfig): Promise<void> {
  // Upstash REST: value in the request body for POST /set/{key}.
  const res = await fetch(`${kvUrl()}/set/${KEY}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${kvToken()}`, "Content-Type": "text/plain" },
    body: JSON.stringify(config),
  });
  if (!res.ok) throw new Error(`KV set failed (${res.status})`);
}

async function fileGet(): Promise<RolesConfig | null> {
  try {
    const raw = await fs.readFile(LOCAL_FILE, "utf8");
    const parsed = JSON.parse(raw);
    return isValidRolesConfig(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

async function fileSet(config: RolesConfig): Promise<void> {
  await fs.mkdir(path.dirname(LOCAL_FILE), { recursive: true });
  await fs.writeFile(LOCAL_FILE, JSON.stringify(config, null, 2), "utf8");
}

/** Loads the saved role config, falling back to seed defaults. Never throws. */
export async function getRolesConfig(): Promise<RolesConfig> {
  try {
    if (kvConfigured()) return (await kvGet()) ?? SEED_ROLES;
    if (localFileUsable()) return (await fileGet()) ?? SEED_ROLES;
  } catch {
    // Fall through to seed on any store error so scheduling still works.
  }
  return SEED_ROLES;
}

/** Persists the role config. Throws with a clear message if no writable store. */
export async function saveRolesConfig(config: RolesConfig): Promise<void> {
  if (kvConfigured()) return kvSet(config);
  if (localFileUsable()) return fileSet(config);
  throw new Error(
    "No writable store configured. Add a Vercel KV store (sets KV_REST_API_URL and KV_REST_API_TOKEN) to save template changes.",
  );
}
