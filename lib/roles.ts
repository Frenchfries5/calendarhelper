// ===========================================================================
// ROLE TEMPLATES — one onboarding-session set per role.
// ===========================================================================
// Everyone lands on the same Outlook calendar ("US Onboarding Schedule"), but
// each role has its own week of sessions. The set below is only the SEED used
// the first time the app runs / before anything is saved. After that, the
// canonical copy lives in the store (see lib/store.ts) and is edited in-app.

import { ONBOARDING_TEMPLATE, OnboardingSession } from "./template";

export interface RoleTemplate {
  id: string; // stable slug, e.g. "growth"
  name: string; // display name, e.g. "Growth / Sales"
  sessions: OnboardingSession[];
}

export interface RolesConfig {
  roles: RoleTemplate[];
}

// Seed: the existing template becomes the first role. Add more via the editor.
export const SEED_ROLES: RolesConfig = {
  roles: [
    {
      id: "growth",
      name: "Growth / Sales",
      sessions: ONBOARDING_TEMPLATE,
    },
  ],
};

export function findRole(config: RolesConfig, roleId: string | undefined): RoleTemplate | undefined {
  if (!roleId) return config.roles[0];
  return config.roles.find((r) => r.id === roleId) ?? config.roles[0];
}

// Basic shape validation for data coming from the client editor or the store.
export function isValidRolesConfig(value: unknown): value is RolesConfig {
  if (!value || typeof value !== "object") return false;
  const roles = (value as RolesConfig).roles;
  if (!Array.isArray(roles) || roles.length === 0) return false;
  return roles.every(
    (r) =>
      r && typeof r.id === "string" && r.id.trim() !== "" &&
      typeof r.name === "string" &&
      Array.isArray(r.sessions) &&
      r.sessions.every(
        (s) =>
          s && typeof s.title === "string" &&
          Number.isFinite(s.dayOffset) &&
          /^\d{1,2}:\d{2}$/.test(s.startTime) &&
          Number.isFinite(s.duration) && s.duration > 0 &&
          typeof s.location === "string" &&
          typeof s.body === "string",
      ),
  );
}
