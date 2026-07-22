# Handoff — Onboarding Scheduler

This repo is a working scaffold. It builds and runs; the remaining work is the
one-time Microsoft/Vercel setup (which only a human can do in the portal) plus
any polish you want. This doc is the brief for finishing and shipping it.

---

## 1. What's here vs. what's left

**Done (in this repo):**
- Full Next.js App Router app: UI, auth routes, Graph integration, business-day
  scheduling, dry-run preview.
- The onboarding session template (`lib/template.ts`).
- Styling and a mobile-responsive layout.

**Left to do (human, ~15 min):**
- Register an Entra app and get the three IDs/secret (Section 3).
- Set env vars locally and in Vercel (Section 4).
- Deploy and add the production redirect URI (Section 6).
- Optional: tweak the session template and copy.

You (Claude Code) can do everything except click through the Entra and Vercel
portals. Where a step is portal-only, hand it back to the operator with the
exact values to enter.

---

## 2. Run it locally

```bash
npm install
cp .env.example .env.local   # then fill in real values (Section 3–4)
npm run dev                  # http://localhost:3000
```

Without valid env vars the app loads but sign-in will fail — that's expected
until Section 3 is done.

---

## 3. Entra app registration (portal — operator does this)

In the Microsoft Entra admin center → **App registrations → New registration**:

1. **Name:** `Onboarding Scheduler`.
2. **Supported account types:** *Accounts in this organizational directory only*
   (single tenant).
3. **Redirect URI:** platform **Web**, value
   `http://localhost:3000/api/auth/callback`. (Add the production URL in
   Section 6 after the first deploy.)
4. Register, then from **Overview** copy the **Application (client) ID** and
   **Directory (tenant) ID**.
5. **Certificates & secrets → New client secret** → copy the secret **Value**
   (not the ID) immediately; it's shown only once.
6. **API permissions → Add a permission → Microsoft Graph → Delegated
   permissions →** add `Calendars.ReadWrite`. `openid`, `profile`, and
   `offline_access` are usually present by default; add them if not.
   - Delegated `Calendars.ReadWrite` is consented by the signing-in user at
     first login. If your tenant restricts user consent, an admin clicks
     **Grant admin consent** once. No tenant-wide mailbox access is involved.

---

## 4. Environment variables

Set these in `.env.local` (local) and in Vercel Project Settings → Environment
Variables (production). Values come from Section 3.

| Variable | What it is |
|---|---|
| `AZURE_CLIENT_ID` | Application (client) ID |
| `AZURE_TENANT_ID` | Directory (tenant) ID |
| `AZURE_CLIENT_SECRET` | Client secret **Value** |
| `AZURE_REDIRECT_URI` | `http://localhost:3000/api/auth/callback` locally; the Vercel URL in prod |
| `SESSION_SECRET` | 32+ char random string. Generate: `openssl rand -base64 32` |
| `KV_REST_API_URL` | *(templates saving)* set automatically when you add a Vercel KV store — see below |
| `KV_REST_API_TOKEN` | *(templates saving)* set automatically with the KV store |

The client secret and session secret are server-only — never prefixed
`NEXT_PUBLIC_`, never referenced in client components.

### Role templates storage (Vercel KV)

The onboarding session sets are **per role** and edited in-app ("Manage
templates"). Saving those edits needs a writable store:

- **Locally**, no setup needed — edits are written to `.data/role-templates.json`.
- **On Vercel**, the filesystem is read-only, so add a KV store: Vercel
  dashboard → **Storage → Create → KV**, and connect it to this project.
  Vercel then injects `KV_REST_API_URL` and `KV_REST_API_TOKEN` automatically;
  redeploy so they take effect.
- Until KV is added, production still works read-only: everyone gets the
  seeded role template, and the editor shows a "saving disabled" notice. Add
  KV whenever you want to create/edit roles in prod.

---

## 5. How the app works (so changes stay safe)

- `app/page.tsx` (server) reads the iron-session cookie and tells the client
  form whether the user is signed in.
- **Sign in** → `/api/auth/login` builds the Microsoft authorize URL (MSAL) and
  redirects. Microsoft returns to `/api/auth/callback`, which exchanges the code
  for an access token and stores it in the encrypted session cookie.
- **Preview** → `POST /api/onboarding` with `dryRun: true` returns the computed,
  dated schedule. Nothing is written.
- **Create** → same route, `dryRun: false`. It optionally finds/creates the
  "US Onboarding Schedule" calendar, then POSTs each event to Graph as the user.
- The onboarding content lives entirely in `lib/template.ts`. Editing a title,
  time, or `dayOffset` there changes what gets scheduled — no other file needs
  to change.

Token lifetime: access tokens last ~1 hour and are not refreshed. For a
sit-down monthly run that's fine; if the token expires mid-session the API
returns 401 and the UI asks the operator to sign in again. If you later want
zero re-auth, store the refresh token from the code exchange and call
`acquireTokenByRefreshToken` — deliberately left out to avoid persisting a
long-lived credential.

---

## 6. Deploy to Vercel

1. Push the repo to GitHub and import it in Vercel (framework auto-detected as
   Next.js).
2. Add all five env vars (Section 4). Set `AZURE_REDIRECT_URI` to
   `https://<your-app>.vercel.app/api/auth/callback`.
3. Deploy. Then go back to the Entra app → **Authentication** and add that same
   production callback URL as a second **Web** redirect URI.
4. Sign in on the production URL and run a dry-run before a real create.

---

## 7. Definition of done

- [ ] `npm run dev` runs with no type errors.
- [ ] Sign-in completes and the header shows the operator's account.
- [ ] "Preview schedule" renders the full week as a dated agenda; no calendar
      events are created.
- [ ] "Create events" creates every session on the correct dates/times in
      Eastern, on the dedicated calendar when that toggle is on.
- [ ] Weekend start dates roll forward correctly; `dayOffset` counts business
      days.
- [ ] Attendees and Teams-link toggles are honored.
- [ ] Deployed on Vercel with the production redirect URI registered.
- [ ] No secret or token is ever sent to or logged on the client.

---

## 8. Nice-to-haves (only if asked)

- Duplicate guard: before creating, query existing events in the window and skip
  matching subjects, so a re-run doesn't double-book.
- A confirmation step showing the target calendar name before create.
- Per-session attendee overrides instead of one global list.

(Done: multiple role templates selectable + editable in-app — see §4 storage.)
