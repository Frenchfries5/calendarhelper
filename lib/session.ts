import { sealData, unsealData } from "iron-session";
import { cookies } from "next/headers";

export interface SessionData {
  accessToken?: string;
  account?: string;
}

const COOKIE = "onboarding_session";
const MAX_CHUNKS = 8;
// A real Microsoft Graph access token seals to ~4.3KB, which overflows the
// ~4096-byte per-cookie browser limit. So we split the sealed blob across
// several cookies (onboarding_session.0, .1, …), each kept well under the
// limit, and rejoin them on read.
const CHUNK_SIZE = 3500;

function password(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error("SESSION_SECRET is not set");
  return secret;
}

const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
};

/** Reads and decrypts the session. Returns {} when not signed in. Safe to
 *  call from server components (read-only). */
export async function getSession(): Promise<SessionData> {
  const store = await cookies();
  let sealed = "";
  for (let i = 0; i < MAX_CHUNKS; i++) {
    const part = store.get(`${COOKIE}.${i}`)?.value;
    if (!part) break;
    sealed += part;
  }
  if (!sealed) return {};
  try {
    return await unsealData<SessionData>(sealed, { password: password(), ttl: 0 });
  } catch {
    // Tampered / stale / secret-rotated cookie — treat as signed out.
    return {};
  }
}

/** Encrypts and writes the session across chunked cookies. Route handlers
 *  only (cookies can't be set from server components). */
export async function saveSession(data: SessionData): Promise<void> {
  const store = await cookies();
  const sealed = await sealData(data, { password: password(), ttl: 0 });
  const chunks = sealed.match(new RegExp(`.{1,${CHUNK_SIZE}}`, "g")) ?? [];
  if (chunks.length > MAX_CHUNKS) {
    throw new Error("Session data too large to store in cookies");
  }
  chunks.forEach((chunk, i) => store.set(`${COOKIE}.${i}`, chunk, cookieOptions));
  // Clear any leftover chunks from a previously larger session.
  for (let i = chunks.length; i < MAX_CHUNKS; i++) {
    store.delete(`${COOKIE}.${i}`);
  }
}

/** Clears every session cookie (including a legacy single-cookie session). */
export async function destroySession(): Promise<void> {
  const store = await cookies();
  store.delete(COOKIE);
  for (let i = 0; i < MAX_CHUNKS; i++) {
    store.delete(`${COOKIE}.${i}`);
  }
}
