import { Suspense } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { findRoute } from '../../routes.jsx';
import { useAppStore } from '../../store/useAppStore.js';
import { OfflineBanner } from '../pwa/OfflineBanner.jsx';
import { CardSkeleton } from '../ui/Skeleton.jsx';
import { BottomNav } from './BottomNav.jsx';
import { Sidebar } from './Sidebar.jsx';
import { TopBar } from './TopBar.jsx';

/** Laptop: left sidebar. Tablet/phone: bottom navigation (doc 5.1). */
export function AppShell() {
  const { pathname } = useLocation();
  const user = useAppStore((s) => s.user);
  const route = findRoute(pathname);
  const resolve = (v) => (typeof v === 'function' ? v(user) : v);
  return (
    <div className="flex min-h-screen bg-gradient-to-br from-canvas-light via-[#EEF4FA] to-[#E6EEF8] dark:from-canvas-dark dark:via-canvas-dark dark:to-[#111c33]">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[90] focus:rounded-lg focus:bg-white focus:px-4 focus:py-2">Skip to content</a>
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar title={resolve(route?.title) || 'FocusNest'} subtitle={resolve(route?.subtitle)} />
        <OfflineBanner />
        <main id="main" tabIndex={-1} className="flex-1 px-4 pb-[calc(6.5rem+var(--safe-bottom))] pt-4 outline-none sm:px-6 lg:px-8 lg:pb-10">
          <Suspense fallback={<div className="page grid gap-5 md:grid-cols-2"><CardSkeleton lines={4} /><CardSkeleton lines={4} /></div>}>
            <Outlet />
          </Suspense>
        </main>
      </div>
      <BottomNav />
    </div>
  );
}
