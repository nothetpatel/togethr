# Togethr

A cute 3D co-working island ([togethr.ca](https://togethr.ca)): pick an animal, walk around with friends, share to-do lists, and focus together on a synced Pomodoro timer.

- **Rooms** with a 4-letter code or an invite link (`/?join=ABCD`), up to 8 people
- **Your animal** (dog, cat, panda, koala or turtle) walks wherever you tap; everyone sees everyone live
- **To-do lists** on the right: yours to edit, everyone else's to cheer on
- **Pomodoro timer** that only the room owner controls, in step on every screen

## Run locally

```bash
npm install
npm run dev
```

The island renders without a backend. To connect Supabase:

1. Create a project at [supabase.com](https://supabase.com).
2. **Authentication → Sign In / Providers → Allow anonymous sign-ins:** on. Players never see a login; each browser gets an anonymous session.
3. **SQL Editor:** run each file in [`supabase/migrations/`](supabase/migrations/) in order, each in a fresh query with nothing selected:
   - `0001_init.sql`: tables, row-level security, room and timer functions
   - `0002_private_room_channels.sql`: only room members can use a room's live channel
   - `0003_timer_advance.sql`: moves the timer on when a phase ends
4. Copy `.env.example` to `.env.local` and fill in the **Project URL** (just `https://<ref>.supabase.co`) and the **anon / publishable** key from **Project Settings → API**. Never use the service_role key in the app.
5. Restart `npm run dev`.

## Deploy (Vercel)

1. Push this repo to GitHub (private is fine).
2. In [Vercel](https://vercel.com): **Add New → Project**, import the repo. It detects Vite; keep the defaults.
3. Under **Environment Variables**, add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` (same values as `.env.local`), then deploy.
4. **Domain:** in the project's **Settings → Domains**, add `togethr.ca` and follow the DNS instructions at your registrar.
5. Every push to `main` redeploys automatically.

Before sharing the link widely, turn on CAPTCHA for anonymous sign-ins in Supabase (**Authentication → Bot and Abuse Protection**) to stop bots creating accounts.

## Scripts

- `npm run dev`: dev server on http://localhost:5173 (`?gallery` shows all five animals)
- `npm test`: unit tests (Vitest)
- `npm run build`: typecheck + production build
- `npm run e2e`: two-player browser tests (Playwright) against your Supabase project
- `npm run smoke:db`: checks the database rules (rooms, to-dos, timer, private channels)
- `npm run snapshot`: saves today's desktop and phone screenshots to `progress/`

## Layout

- `src/island/`: the 3D island: terrain, water, plants, flowers, animals, walking and multiplayer sync
- `src/components/`: UI cards: avatar creator, lobby, room card, timer, to-do panel
- `src/hooks/`: live room data: members, positions and presence, to-dos, timer
- `src/lib/`: Supabase client, room codes, timer maths, chime
- `src/shared/types.ts`: types mirroring the database schema
- `supabase/migrations/`: schema, row-level security and database functions
