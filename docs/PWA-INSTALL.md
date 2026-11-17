# Installing FocusNest (PWA)

FocusNest is a Progressive Web App: you can install it from the browser and it
opens full screen from your home screen, dock or Start menu, like a normal app.
The app also has an **Install FocusNest** page (More → Install app) with the same
steps for the device you're using.

## Android (Chrome, Edge, Samsung Internet)

1. Open the FocusNest website in **Chrome**.
2. Tap **Install app** when the prompt appears, or tap the **Install app** button
   in FocusNest's top bar. Otherwise open the browser menu **⋮** and choose
   **Install app** (on older versions: **Add to Home screen**).
3. Tap **Install**. FocusNest appears on the home screen and in the app drawer.
4. Open it from the home screen icon. A splash screen with the FocusNest logo
   shows while it starts.
5. In **Settings → Notifications and sound**, tap **Turn on** so break alarms reach
   you even when the app is closed (needs an account and a configured server).

**Shortcuts:** long-press the FocusNest icon for *Start focus session*, *Take a break*,
*Daily check-in* and *Bedtime mode*.

## iPhone and iPad (Safari)

1. Open the FocusNest website in **Safari** (on iOS/iPadOS 16.4 or later, Chrome and
   Edge also offer *Add to Home Screen*).
2. Tap the **Share** button (bottom of the screen on iPhone, top right on iPad).
3. Scroll down and tap **Add to Home Screen**.
4. Keep the name **FocusNest** and tap **Add**.
5. Open FocusNest **from the Home Screen icon**. Then go to **Settings → Notifications
   and sound → Turn on**.

> On iPhone and iPad, web push notifications only work when FocusNest is opened
> from the Home Screen (iOS 16.4+). In a normal Safari tab you still get the
> on-screen Break Over alarm while the app is open.

## Laptop / desktop (Windows, macOS, Linux, ChromeOS)

**Chrome or Microsoft Edge**

1. Open the FocusNest website.
2. Click the **Install** icon at the right end of the address bar, or the
   **Install app** button in FocusNest's top bar.
3. Click **Install**. FocusNest opens in its own window and is added to the Start
   menu, Dock, Launchpad or app launcher.

**Safari on macOS Sonoma (14) or later:** File → **Add to Dock**.

**Firefox:** desktop Firefox doesn't install web apps; FocusNest works fully in a
normal tab.

## Updating

When a new version is deployed, FocusNest downloads it in the background and
shows **"A new version of FocusNest is ready"**. Tap **Update** to switch, or close
the banner and update later. Running timers are saved by their end time, so they
keep going after the update. You can also use **Settings → App → Check for updates**.

## What works offline

| Works offline | Needs a connection |
| --- | --- |
| Opening the app (cached app shell, icons, sounds) | Signing in or creating an account |
| Focus and break timers, alarm and Break Over overlay | Syncing between laptop and phone |
| Guest mode: check-ins, sleep, wins, goals, quests, activities | Push notifications to other devices |
| Signed in: the last data you saw, read-only | Saving changes in a signed-in account |

Personal data is never stored in the service-worker cache. API requests always
go to the network.

## Uninstalling

- **Android:** long-press the icon → **Uninstall** (or App info → Uninstall).
- **iPhone/iPad:** long-press the icon → **Remove App** → **Delete from Home Screen**.
- **Chrome/Edge desktop:** open FocusNest → window menu **⋮** → **Uninstall FocusNest**.
- **macOS Safari:** drag FocusNest out of the Dock / delete it from Applications.
