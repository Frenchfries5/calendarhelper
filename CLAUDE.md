# CLAUDE.md

Repo context for Claude Code. Read `HANDOFF.md` for the full brief and the
step-by-step "definition of done".

## What this is

A small internal People Ops tool for Coverdash. It creates a full new-hire
onboarding week (multiple sessions with set titles, descriptions, locations,
times) on the operator's Outlook calendar via Microsoft Graph. The operator
signs in with Microsoft, picks a cohort start date, previews the schedule (as
a list or a week calendar), optionally excludes individual sessions, and
creates the events with one click. Human-triggered, ~once a month.

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
  api/onboarding/route.ts        # compute schedule; dry-run or create events
components/OnboardingForm.tsx     # client UI: form + list/calendar preview
lib/
  template.ts   # THE onboarding session template — the thing Chris edits
  dates.ts      # business-day math + schedule computation
  auth.ts       # MSAL confidential client
  session.ts    # iron-session config
  graph.ts      # Graph client (resolve calendar, create event)
```

## Conventions

- Keep the session template (`lib/template.ts`) the single source of truth for
  what gets scheduled. All titles/descriptions/locations/timing live there.
- Times are wall-clock strings paired with `timeZone: "Eastern Standard Time"`;
  do not convert to UTC. `lib/dates.ts` explains why.
- Dry-run (preview) must never write to the calendar. Excluded sessions are
  dropped server-side before the create loop.
- Never log or return the access token or client secret.

## Do NOT

- Do not switch to app-only auth or add `Calendars.ReadWrite` *application*
  permission — that grants tenant-wide mailbox access and is out of scope.
- Do not persist tokens to a database or expose any secret to the client.
