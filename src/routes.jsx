import { lazy } from 'react';
import { Activity, BedDouble, ClipboardCheck, Download, Gauge, HeartHandshake, LifeBuoy, Lock, Settings, Smartphone, Target, Trophy, Users, Wind } from 'lucide-react';

const Dashboard = lazy(() => import('./pages/Dashboard.jsx'));
const Focus = lazy(() => import('./pages/Focus.jsx'));
const CheckIn = lazy(() => import('./pages/CheckIn.jsx'));
const Sleep = lazy(() => import('./pages/Sleep.jsx'));
const NightLock = lazy(() => import('./pages/NightLock.jsx'));
const Quests = lazy(() => import('./pages/Quests.jsx'));
const Wins = lazy(() => import('./pages/Wins.jsx'));
const Activities = lazy(() => import('./pages/Activities.jsx'));
const Campus = lazy(() => import('./pages/Campus.jsx'));
const Support = lazy(() => import('./pages/Support.jsx'));
const SettingsPage = lazy(() => import('./pages/Settings.jsx'));
const PhoneCompanion = lazy(() => import('./pages/PhoneCompanion.jsx'));
const Install = lazy(() => import('./pages/Install.jsx'));

const first = (u) => (u?.name || 'Friend').split(' ')[0];

/**
 * One page per screen (doc 5.4). `title`/`subtitle` feed the top bar,
 * `nav` decides where the link appears (sidebar / more sheet).
 */
export const appRoutes = [
  { path: '/', label: 'Dashboard', icon: Gauge, element: Dashboard, nav: 'main', title: (u) => `Hello, ${first(u)}!`, subtitle: 'Ready to focus today?' },
  { path: '/focus', label: 'Focus', icon: Target, element: Focus, nav: 'main', title: () => 'Focus & Break', subtitle: 'One task. One timer. Then a real break.' },
  { path: '/check-in', label: 'Check-in', icon: ClipboardCheck, element: CheckIn, nav: 'main', title: () => 'Daily Check-in', subtitle: 'Ten seconds. Just for you.' },
  { path: '/sleep', label: 'Sleep', icon: BedDouble, element: Sleep, nav: 'main', title: () => 'Sleep Mode', subtitle: (u) => `Ready for rest, ${first(u)}?` },
  { path: '/night-lock', label: 'Night Lock', icon: Lock, element: NightLock, nav: 'more', title: () => 'Night Lock', subtitle: 'Preview of the Android app feature' },
  { path: '/quests', label: 'Quests', icon: Trophy, element: Quests, nav: 'main', title: () => 'Your Progress & Achievements', subtitle: 'Celebrate consistency, not perfection.' },
  { path: '/wins', label: 'Wins', icon: HeartHandshake, element: Wins, nav: 'main', title: () => 'My Wins', subtitle: 'Compare yourself to yesterday, not to others.' },
  { path: '/activities', label: 'Activities', icon: Wind, element: Activities, nav: 'main', title: (u) => `Hello, ${first(u)}!`, subtitle: 'Bored? Try this' },
  { path: '/community', label: 'Community', icon: Users, element: Campus, nav: 'main', title: () => 'Community Hub', subtitle: 'Connection without the scroll.' },
  { path: '/support', label: 'Support', icon: LifeBuoy, element: Support, nav: 'main', title: () => 'Support', subtitle: "You don't have to figure it out alone." },
  { path: '/settings', label: 'Settings', icon: Settings, element: SettingsPage, nav: 'main', title: () => 'Settings', subtitle: 'Your app, your rules, your data.' },
  { path: '/phone', label: 'Phone view', icon: Smartphone, element: PhoneCompanion, nav: 'more', title: () => 'Phone Companion', subtitle: 'The same timer, on your phone.' },
  { path: '/install', label: 'Install app', icon: Download, element: Install, nav: 'more', title: () => 'Install FocusNest', subtitle: 'Add it to your home screen or desktop.' },
];

export const activityIcon = Activity;
export const findRoute = (pathname) => appRoutes.find((r) => r.path === pathname) || null;
