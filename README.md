# FocusNest

**Track it. Control it. Replace it.** A digital wellbeing platform for everyone,
from school and university students to working professionals.

FocusNest stops "five more minutes" from turning into hours. A break timer ends
with a gentle alarm and a full-screen **Break Over** prompt on your laptop *and*
phone. Extending a break needs a 30-second breathing pause and a reason (at most
two extensions). It also covers bedtime routines, daily check-ins, quests and
badges, a wins journal, offline activities, community and support.

- **Web app:** React 18, Vite, Tailwind CSS, React Router, Zustand, Recharts, lucide-react
- **Installable PWA:** vite-plugin-pwa (Workbox, custom service worker), offline support, update prompt, Web Push
- **API:** Node.js 20, Express, MongoDB + Mongoose, JWT + bcrypt, zod, helmet, rate limiting, Socket.IO, web-push, node-schedule

> **Honest limit (doc section 3):** a website cannot see how long you use Instagram
> or PUBG, and it cannot block or close other apps. FocusNest uses self check-ins,
> alarms and notifications. Night Lock is a clearly labelled preview. Real
> blocking needs the native Android app (Phase 3).

---

## Two ways to run

| Mode | When | Data |
| --- | --- | --- |
| **Guest mode** | No `VITE_API_URL` set, or the user doesn't sign in | Saved in the browser (`localStorage`). Every feature works, fully offline. |
| **Account mode** | `VITE_API_URL` points to the FocusNest API and the user signs in | MongoDB. Laptop and phone stay in sync in real time; push notifications when the app is closed. |

Both modes use the same screens. All data access goes through
`src/services/api.js`, which picks `localApi.js` (guest) or `remoteApi.js`
(account) — the pattern from doc section 6.3. Points, streaks, quests, badges and
the danger-hour insight live in `/shared` and are used by **both** the browser
and the server, so the rules are identical.

Data from the first prototype (`localStorage["focusnest-v1"]`) is migrated
automatically on first load. Old `#dashboard`-style links still work.

---

## Project structure

```
/                      Web app (Vite) — deployed to Vercel
├─ index.html
├─ vite.config.js      React + PWA manifest + iOS splash links
├─ tailwind.config.js  Design tokens from doc 5.2 (teal #2A9D8F, blue #4F8EF7 …)
├─ vercel.json         Build, SPA rewrites, service-worker & security headers
├─ public/             Icons, splash screens, brand art, alarm sound, offline page
├─ src/
│  ├─ main.jsx, App.jsx, routes.jsx, sw.js (service worker)
│  ├─ components/ layout · ui · focus · charts · pwa
│  ├─ pages/      Onboarding, Dashboard, Focus, CheckIn, Sleep, NightLock, Quests,
│  │              Wins, Activities, Campus, Support, Settings, PhoneCompanion,
│  │              Install, Auth, NotFound
│  ├─ store/      useAppStore, useTimerStore, useProgressStore, useToastStore
│  ├─ services/   api, localApi, remoteApi, socket, push, pwa, notifications,
│  │              sound, session, timerActions, device, storage, events
│  ├─ hooks/      useCountdown, useTheme, useApiData, useMediaQuery
│  └─ utils/
├─ shared/             Business rules + validation used by web app AND API
├─ server/             Node.js API — deployed to Render/Railway (see below)
│  └─ src/ server.js, app.js, config/, models/, routes/, controllers/,
│          middleware/, sockets/, services/, seed/, utils/
├─ tests/              node:test suites (shared rules, guest-mode API)
├─ scripts/            Asset generators (icons, splash screens, sound)
├─ design/             Reference mockups and original brand artwork
└─ docs/PWA-INSTALL.md Installation guide for Android, iOS and desktop
```

---

## Local development

Requirements: **Node.js 20+**, and for account mode a **MongoDB** database
(local `mongod` or a free MongoDB Atlas cluster).

```bash
# 1. Web app (guest mode works with just this)
npm install
npm run dev                 # http://localhost:5173

# 2. API (optional, for accounts, sync and push)
cd server
cp .env.example .env        # fill in MONGO_URI and JWT_SECRET
npm install
npm run vapid               # prints VAPID keys for push → paste into .env
npm run dev                 # http://localhost:4000  (GET /api/health)

# 3. Point the web app at the API
cd ..
echo "VITE_API_URL=http://localhost:4000" > .env.local
npm run dev
```

Other scripts:

| Command | What it does |
| --- | --- |
| `npm run build` | Production build into `dist/` (includes the service worker) |
| `npm run preview` | Serve the production build locally (test install + offline here) |
| `npm test` | Unit/functional tests for the shared rules and guest-mode API |
| `npm run assets` | Regenerate brand images, icons, splash screens and alarm sound (needs `sharp`) |
| `cd server && npm run seed` | Upsert activities and community events (also runs on API start) |

The service worker is only active in production builds (`npm run build && npm run preview`).

---

## Deployment

### Web app → Vercel (existing project)

The repository root is the Vite app; `vercel.json` sets everything:

- Install: `npm install` · Build: `npm run build` · Output: `dist`
- SPA rewrites so `/focus`, `/sleep`, … load the app
- `sw.js` is served with `no-cache`, so new versions are picked up immediately
- Security headers (CSP, nosniff, frame-ancestors, referrer and permissions policies)

**Environment variable (Vercel → Project → Settings → Environment Variables):**

| Name | Value |
| --- | --- |
| `VITE_API_URL` | Public URL of the API, e.g. `https://focusnest-api.onrender.com`. Leave unset to ship guest mode only. |

Vite reads `VITE_*` variables at build time, so redeploy after changing it.

### API → Render (or Railway)

Socket.IO needs a long-running server, so the API is deployed separately
(doc section 7.1 suggests Render/Railway + MongoDB Atlas).

1. Create a free **MongoDB Atlas** cluster → *Connect → Drivers* → copy the
   connection string. Under *Network Access*, allow your host's outbound IPs (or `0.0.0.0/0`).
2. **Render → New → Blueprint →** pick this repo. `render.yaml` creates the
   `focusnest-api` web service (built and started from the repository root so the API can use `shared/`; health check `/api/health`).
3. Set the environment variables (see `server/.env.example`):

| Name | Required | Notes |
| --- | --- | --- |
| `MONGO_URI` | ✅ | MongoDB Atlas connection string |
| `JWT_SECRET` | ✅ | ≥ 32 random characters (Render can generate it) |
| `CORS_ORIGIN` | ✅ | Your Vercel URL(s), comma-separated |
| `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` | for push | `cd server && npm run vapid` |
| `APP_URL` | optional | Web app URL used in emails |
| `SMTP_*`, `MAIL_FROM` | optional | Accountability-buddy emails |

4. Copy the service URL into Vercel's `VITE_API_URL` and redeploy the web app.

> Free Render instances sleep when idle; the first request can take ~30 s and
> scheduled break alarms only fire while the instance is awake. Clients also
> check the timer when they come back to the foreground, so nothing is lost —
> but for reliable phone push use a paid/always-on instance.

---

## API reference

All routes are under `/api`. Everything except register, login, health and the
push public key needs `Authorization: Bearer <token>`. Request bodies are
validated with zod (`shared/schemas.js`). Errors return `{ error, fields? }`.

| Method | Route | Purpose |
| --- | --- | --- |
| GET | `/health` | Service + database status |
| POST | `/auth/register` | Create account (includes quiz answers) |
| POST | `/auth/login` | Returns a JWT |
| GET/PATCH | `/auth/me` | Profile and settings |
| POST | `/auth/logout-all` | Invalidate all tokens |
| DELETE | `/auth/me` | Delete account and all data (password required) |
| GET | `/auth/export` | Download all personal data (JSON) |
| POST | `/auth/import` | Bring guest data into a new account |
| GET | `/state` | Profile + active timer + server capabilities |
| GET | `/dashboard?date=` | Today's numbers, week chart, danger-hour insight |
| POST / GET | `/checkins` | Save daily check-in / history (`?from=&to=`) |
| GET | `/timer` | Active focus session or break |
| POST | `/focus` | Start a focus session |
| PATCH | `/focus/:id` | `pause` · `resume` · `complete` · `cancel` |
| GET | `/focus/today` | Today's completed sessions |
| POST | `/breaks` | Start a break (server computes `endAt`) |
| POST | `/breaks/:id/extend` | Extend with a reason (max 2) |
| POST | `/breaks/:id/close` | Back to focus (+5 if on time) |
| GET / POST | `/sleep/week`, `/sleep` | Weekly sleep + streak / log bedtime & checklist |
| GET / POST / DELETE | `/wins` | Wins journal |
| GET / POST / PATCH / DELETE | `/goals` | Personal goals |
| GET | `/quests` | Weekly quests, badges, level |
| GET | `/activities`, `/activities/random`, `/activities/history` | "Bored? Try this" |
| POST | `/activities/complete` | +5 points (max 3 per day) |
| GET | `/campus/events` · POST `/campus/events/:key/join` | Community hub |
| GET / PUT | `/nightlock` | Night Lock settings |
| GET / POST / DELETE | `/devices` | Devices and push subscriptions |
| GET | `/push/public-key` · POST `/push/test` | Web Push |

**Realtime (Socket.IO)**: clients connect with `auth: { token, deviceId }` and
join `user:<id>`. Server → clients: `timer:sync`, `focus:started|updated|ended`,
`break:started|extended|ended|closed`, `progress:updated`, `data:changed`,
`devices:changed`. Clients → server (with acknowledgements): `device:register`,
`break:start`, `break:extend`, `break:closed`, `focus:start`, `focus:update`,
`timer:get`. The server owns the clock: each running break or focus session has a
scheduled job, rebuilt from MongoDB on restart, and a sweeper catches anything
missed. When a break ends, every connected device gets `break:ended` and
offline devices get a Web Push.

**Points (doc 7.7):** +10 per completed 25 minutes of focus · +5 back to focus on
time · +10 in bed within 30 min of the goal (and a sleep-streak day) · +5 per
offline activity (3 per day) · weekly quest rewards · badges at 3/7/14-day sleep
streaks and other milestones.

---

## Security & privacy

- Passwords hashed with bcrypt (12 rounds); constant-time login responses
- JWT (HS256) with a token version, so "sign out of all devices" and account deletion revoke tokens
- zod validation on every write; unknown profile fields rejected
- helmet, strict CORS allow-list, 200 KB body limit, rate limits on auth and writes
- Only check-ins, sessions, sleep, wins and goals are stored, with no access to phone content or messages
- The accountability buddy is told *that* a break was extended, never *why*
- A consent screen appears before the browser notification prompt
- Users can export or delete all their data; users under 18 need parental agreement to create an account
- `.env` files are git-ignored; only `.env.example` files are committed

---

## PWA details

- Manifest: name, short name, `standalone` display, theme `#2A9D8F`, background `#F5F8FA`, maskable icons, app shortcuts
- Icons: 48–512 px, maskable 192/512, Apple touch icon, favicon set, notification badge
- Splash: Android builds it from the manifest; iOS uses 21 generated `apple-touch-startup-image` sizes
- Service worker (`src/sw.js`): versioned precache of the app shell, SPA navigation fallback, offline page, font caching, Web Push and notification-click handling; API calls are never cached
- Updates: `registerType: 'prompt'` → "A new version is ready" banner; checks hourly and when the app returns to the foreground
- Install button (`beforeinstallprompt`) in the top bar, Settings and the Install page

See **[docs/PWA-INSTALL.md](docs/PWA-INSTALL.md)** for installing on Android, iPhone/iPad and desktop.

---

## Roadmap

- **Phase 1:** laptop-first web app with simulated phone ✅
- **Phase 2:** accounts, realtime laptop/phone sync, PWA install and push ✅ (needs the API deployed)
- **Phase 3:** native Android app (Usage Access, overlay block screen, Do Not Disturb, Night Lock enforcement) using the same API and Socket.IO events
