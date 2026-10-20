# Togethr

A cute 3D co-working island (togethr.ca): pick an animal, walk around with friends, share to-do lists, and focus together on a synced Pomodoro timer.

## Run locally

```bash
npm install
npm run dev
```

The island renders without a backend. To connect Supabase:

1. Create a project at [supabase.com](https://supabase.com).
2. **Authentication → Sign In / Providers → Anonymous sign-ins:** turn on. Players never see a login; each browser gets an anonymous session.
3. **SQL Editor:** paste and run [`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql).
4. Copy `.env.example` to `.env.local` and fill in the project URL and anon key from **Project Settings → API**.
5. Restart `npm run dev`. The status card should say "Connected as …".

## Scripts

- `npm run dev` — dev server on http://localhost:5173
- `npm test` — unit tests (Vitest)
- `npm run build` — typecheck + production build

## Layout

- `src/island/` — 3D scene (React Three Fiber)
- `src/lib/` — Supabase client, room-code and timer helpers
- `src/shared/types.ts` — types mirroring the database schema
- `supabase/migrations/` — schema, row-level security, and RPCs (`create_room`, `join_room`, `timer_control`, `server_now`)
