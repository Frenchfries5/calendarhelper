# Onboarding Scheduler

Internal People Ops tool for Coverdash. Sign in with a Microsoft work account,
pick a cohort start date, preview the new-hire onboarding week (list or
calendar view, with per-session exclude), and create the events on your Outlook
calendar via Microsoft Graph. Acts only as the signed-in user — no tenant-wide
access.

## Stack

Next.js (App Router) + TypeScript · `@azure/msal-node` (delegated OAuth) ·
`iron-session` (encrypted cookie, no DB) · Microsoft Graph via `fetch`.

## Local development

```bash
npm install
cp .env.example .env.local   # fill in real values
npm run dev                  # http://localhost:3000
```

Sign-in will fail until the Entra app is registered and the env vars are set —
see **HANDOFF.md** for the full setup and the definition of done.

## Environment variables

| Variable | What it is |
|---|---|
| `AZURE_CLIENT_ID` | Entra Application (client) ID |
| `AZURE_TENANT_ID` | Entra Directory (tenant) ID |
| `AZURE_CLIENT_SECRET` | Client secret value |
| `AZURE_REDIRECT_URI` | `http://localhost:3000/api/auth/callback` locally; the Vercel URL in prod |
| `SESSION_SECRET` | 32+ char random string (`openssl rand -base64 32`) |

## Deploy (Vercel)

1. Push to GitHub and import the repo in Vercel (Next.js auto-detected).
2. Add the five env vars above; set `AZURE_REDIRECT_URI` to
   `https://<your-app>.vercel.app/api/auth/callback`.
3. Deploy, then add that same callback URL as a second **Web** redirect URI on
   the Entra app (Authentication).

Full details and the onboarding-content template (`lib/template.ts`) are
documented in **HANDOFF.md** and **CLAUDE.md**.
