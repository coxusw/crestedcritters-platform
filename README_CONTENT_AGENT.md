# Isopedia Content Agent Drop-In v1

Copy this package into the root of your `crestedcritters-platform` Next.js project.

This is a database-backed replacement for the Google Sheet / Apps Script Facebook agent.

## Install

1. Unzip this at the project root.
2. In Supabase SQL Editor, run:
   `supabase/migrations/20260515_content_agent.sql`
3. Add env vars from:
   `.env.content-agent.example`
4. In Visual Studio Code:
   ```bash
   npm install
   npm run build
   ```
5. Open:
   `/admin/content-agent`

## What it adds

- `app/admin/content-agent/page.tsx`
- `app/admin/content-agent/actions.ts`
- `app/admin/content-agent/ContentAgentDashboard.tsx`
- API routes under `app/api/content-agent`
- backend helpers under `lib/content-agent`
- SQL migration for content-agent tables
- Vercel cron example

## First safe test

1. Run SQL.
2. Add env vars.
3. Visit `/admin/content-agent`.
4. Click `Generate Next Posts`.
5. Approve a Draft.
6. Only after you are ready, set `auto_publish_enabled` true for that page in Supabase.
7. Click `Post Approved Due`.

## Current v1 limitations

- Page/token settings are edited in Supabase for now.
- Topic editor UI is not built yet.
- Automatic “on species verified” hook is not wired directly into your verification action yet. v1 has a manual `Latest Species Post` button and cron route starter.
