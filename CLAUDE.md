# CLAUDE.md

Repo context for Claude Code. Read `HANDOFF.md` for the full brief and the
step-by-step "definition of done".

## What this is

A small internal People Ops tool for Coverdash. It creates a full new-hire
onboarding week (multiple sessions with set titles, descriptions, locations,
times) on the operator's Outlook calendar via Microsoft Graph. The operator
signs in with Microsoft, picks a **role** (each role has its own session set),
a cohort start date, previews the schedule (list or week calendar), optionally
excludes or drag-reschedules individual sessions, and creates the events with
one click. All roles use the same calendar ("US Onboarding Schedule").
Role templates are edited in-app ("Manage templates") and saved to a store.
Human-triggered, ~once a month.

## Architecture (already decided — do not re-litigate)

- **Next.js (App Router) + TypeScript**, deployed on **Vercel**.
- **Auth: delegated OAuth authorization-code flow** via `@azure/msal-node`
  (`ConfidentialClientApplication`). The app acts *as the signed-in user* and
  only ever touches that user's own calendar. Scope: `Calendars.ReadWrite`.
  No application (app-only) permissions, no tenant-wide admin consent.
- **Secret handling:** the client secret lives only in server-side env vars.
  It is never sent to the browser. All Graph calls happen in route handlers.
- **Session:** the access token is stored in an encrypted, http-only cookie via
  `iron-session`. No database.
- **Graph:** plain `fetch` against `https://graph.microsoft.com/v1.0`, no SDK.

## Layout

```
app/
  layout.tsx, page.tsx (server; reads session), globals.css
  api/auth/login|callback|logout/route.ts
  api/onboarding/route.ts        # compute schedule for a role; dry-run or create
  api/templates/route.ts         # GET/PUT role templates (the editable defaults)
components/
  OnboardingForm.tsx   # scheduler: role picker + form + list/calendar preview
  TemplateEditor.tsx   # in-app editor for role templates
lib/
  template.ts   # OnboardingSession type, TIME_ZONE, and the SEED session set
  roles.ts      # RoleTemplate type, SEED_ROLES, validation
  store.ts      # persistence: Vercel KV -> local file (dev) -> read-only seed
  dates.ts      # business-day math + schedule computation
  auth.ts       # MSAL confidential client
  session.ts    # iron-session (chunked cookies)
  graph.ts      # Graph client (resolve calendar, create event)
```

## Role templates & storage

- Templates are **role → session set**. Editable in-app via `TemplateEditor`
  ("Manage templates"); the scheduler's role dropdown drives which set is
  used. All roles share one calendar (`DEDICATED_CALENDAR_NAME` in the
  onboarding route) — only sessions differ.
- `TemplateEditor` also does **CSV import/export** (client-side): Download CSV
  emits the selected role's sessions (headers: title, dayOffset, startTime,
  duration, location, body); Upload CSV parses/validates rows (RFC4180-ish,
  handles quoted commas/newlines) and replaces that role's sessions in the
  editor. Saving still goes through PUT /api/templates.
- `lib/store.ts` persists them in three auto-selected tiers:
  1. **Vercel KV** when `KV_REST_API_URL` + `KV_REST_API_TOKEN` are set (prod;
     accessed via Upstash REST with plain `fetch`, no npm dep).
  2. **Local JSON file** `.data/role-templates.json` in local dev (the Vercel
     FS is read-only, so this is dev-only; gitignored).
  3. **Read-only seed** (`SEED_ROLES` in `lib/roles.ts`) when neither exists —
     scheduling still works; saving reports "no writable store".
- The onboarding create path is authoritative: it loads the role's sessions
  from the store server-side (never trusts a client-sent session list); the
  client only sends `roleId` plus timing overrides/exclusions.

## Conventions

- The saved store is the source of truth for what gets scheduled;
  `lib/template.ts` / `SEED_ROLES` is only the first-run seed. Don't hardcode
  new session content in components — it flows through roles/store.
- Times are wall-clock strings paired with `timeZone: "Eastern Standard Time"`;
  do not convert to UTC. `lib/dates.ts` explains why.
- Dry-run (preview) must never write to the calendar. Excluded sessions are
  dropped server-side before the create loop.
- Never log or return the access token or client secret.

## Do NOT

- Do not switch to app-only auth or add `Calendars.ReadWrite` *application*
  permission — that grants tenant-wide mailbox access and is out of scope.
- Do not persist tokens to a database or expose any secret to the client.
