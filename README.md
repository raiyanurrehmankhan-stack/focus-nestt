# FocusNest — working web app prototype

A fully functional **static, offline-capable-by-file** digital wellbeing web app. Based on the supplied FocusNest Complete Project Document for the Design Thinking Midterm.

## Run locally

- Easiest: extract this ZIP and double-click `index.html` in Chrome or Edge.
- For development/hosting: `python -m http.server 8080` in this folder, then visit http://localhost:8080.
- Deploy: drag this folder to a new Netlify site, or upload to a GitHub repository and import the project into Vercel. Framework preset: Other; build command: blank; output directory: `.`.

No package install, backend, account or API keys are required.

## Demo tip

On the Dashboard (or Settings), click **Load sample data** to fill the app with 7 days of example check-ins, a 5-day sleep streak, wins and points. Use **Demo mode** (30 seconds) for the break flow.

## What works

- Five-step onboarding quiz and personalized dashboard
- Focus and break timers using absolute timestamps (survive tab throttling / page reload)
- **Demo mode:** 30-second sessions instead of real timers
- Break-over alarm + on-screen overlay + optional browser notification
- Thoughtful extension: short breathing pause + reason + maximum two extensions
- Daily screen-time, activity, mood and bedtime check-ins, with local history
- Bedtime checklist, morning sleep entry and sleep streak
- Simulated Night Lock preview, clearly labeled
- Quests, earned points, level and badges
- My Wins journal, offline activity suggestions and progress
- Community activity ideas and human-support/safety page
- Light/dark/auto theme, mobile-responsive layout, local export/delete

## Known constraints

This **web app cannot monitor usage in other apps, block Instagram/PUBG, send notifications if the browser is closed, synchronize with a separate phone, or offer a real counseling service**. The phone is a simulated companion in the browser, not a real connected device. For real blocking and OS app usage telemetry, a native Android app with explicit permissions is required. Real cross-device sync, secure accounts and push notifications would require a backend and PWA service worker.

All progress is self-reported and saved only in the browser's `localStorage`. This is a research prototype, not an authenticated multiuser service. Browser storage can be cleared; use Settings > Export data for a backup. Research interview examples from the project document must be validated with actual interviews and survey responses before being reported as real evidence.

## Suggested 5-student usability test

Ask each volunteer to: (1) finish onboarding, (2) start a demo break, (3) wait for the reminder and choose an extension, (4) return to focus, (5) set bedtime and save a daily check-in. Record consent, completion rate, confusion, quotes (anonymized), and improvements after each test.

## Privacy and ethics

No account, tracking scripts, external data transfer or third-party analytics. Google Fonts (optional) can load from Google when online. Student names and check-in data are local only. Users can export or delete their data. No staff/parent monitoring. No coercive blocking or public shaming.
